/**
 * CRIPRI Universal Institution Website Host Router
 *
 * Deploy as a Cloudflare Worker and attach route:
 *   *.criprisolutions.co.ke/*
 *
 * Institution subdomain roots serve the dynamic website engine.
 * Static assets are forwarded to the matching GitHub Pages paths.
 */

const PAGES_ORIGIN = "https://cripri-solutions.github.io";
const PAGES_BASE = "/cripri-universal-school-website/";

function getInstitutionSlug(hostname) {
  const suffix = ".criprisolutions.co.ke";
  const host = hostname.toLowerCase();

  if (!host.endsWith(suffix)) return null;

  const slug = host.slice(0, -suffix.length);

  if (
    !slug ||
    slug.includes(".") ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    return null;
  }

  if (["www", "admin", "api", "mail", "ftp"].includes(slug)) {
    return null;
  }

  return slug;
}

function errorResponse(message, status, extraHeaders = {}) {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...extraHeaders
    }
  });
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const slug = getInstitutionSlug(incoming.hostname);

    if (!slug) {
      return errorResponse("Institution website not found.", 404);
    }

    // This public website router serves pages and assets only.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return errorResponse("Method not allowed.", 405, {
        "Allow": "GET, HEAD"
      });
    }

    const requestedPath = incoming.pathname.replace(/^\/+/, "");
    const assetPath = requestedPath || "school.html";

    // Reject malformed encoding and decoded path traversal attempts.
    let decodedPath = assetPath;

    // Decode nested percent-encoding before checking path segments. This
    // prevents traversal strings such as %252e%252e%252f from reaching origin.
    try {
      for (let i = 0; i < 5; i += 1) {
        if (!/%[0-9a-f]{2}/i.test(decodedPath)) break;
        const nextPath = decodeURIComponent(decodedPath);
        if (nextPath === decodedPath) break;
        decodedPath = nextPath;
        if (i === 4 && /%[0-9a-f]{2}/i.test(decodedPath)) {
          return errorResponse("Invalid asset path.", 400);
        }
      }
    } catch {
      return errorResponse("Invalid asset path.", 400);
    }

    if (decodedPath.split(/[\\/]/).some(part => part === "." || part === "..")) {
      return errorResponse("Invalid asset path.", 400);
    }

    const destination = new URL(PAGES_BASE + assetPath, PAGES_ORIGIN);

    // Ensure the resolved URL remains within the intended GitHub Pages project.
    if (
      destination.origin !== PAGES_ORIGIN ||
      !destination.pathname.startsWith(PAGES_BASE)
    ) {
      return errorResponse("Invalid destination.", 400);
    }

    // Pass the institution slug only to the dynamic website engine.
    if (assetPath === "school.html") {
      destination.searchParams.set("slug", slug);
    } else {
      incoming.searchParams.forEach((value, key) => {
        destination.searchParams.set(key, value);
      });
    }

    // Forward only headers needed for public asset negotiation.
    // Cookies, authorization credentials, API keys, and client IP headers
    // are deliberately not sent to the public GitHub Pages origin.
    const safeHeaders = new Headers();

    for (const name of [
      "accept",
      "accept-language",
      "cache-control",
      "if-modified-since",
      "if-none-match",
      "pragma",
      "range"
    ]) {
      const value = request.headers.get(name);
      if (value !== null) safeHeaders.set(name, value);
    }

    const upstreamRequest = new Request(destination.toString(), {
      method: request.method,
      headers: safeHeaders,
      redirect: "follow"
    });

    // Cache successful public responses at Cloudflare's edge so repeat visits
    // do not need to reach GitHub Pages on every request. The school page is
    // cached briefly; static assets can be cached longer. The slug remains in
    // the school.html query string, keeping institution page variants separate.
    const isInstitutionPage = assetPath === "school.html";
    const upstreamResponse = await fetch(upstreamRequest, {
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: {
          "200-299": isInstitutionPage ? 60 : 3600,
          "404": 30
        }
      }
    });
    const headers = new Headers(upstreamResponse.headers);

    headers.set("X-CRIPRI-Institution-Slug", slug);
    if (upstreamResponse.status >= 200 && upstreamResponse.status < 300) {
      headers.set(
        "Cache-Control",
        isInstitutionPage
          ? "public, max-age=60, s-maxage=60"
          : "public, max-age=3600, s-maxage=3600"
      );
    } else if (upstreamResponse.status === 404) {
      headers.set("Cache-Control", "public, max-age=30, s-maxage=30");
    } else {
      // Never let browsers or shared caches retain upstream failures.
      headers.set("Cache-Control", "no-store");
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers
    });
  }
};
