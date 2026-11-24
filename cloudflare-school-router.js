/**
 * CRIPRI School Website Host Router
 *
 * Deploy as a Cloudflare Worker and attach route:
 *   *.criprisolutions.co.ke/*
 *
 * Root requests serve the dynamic school page. Static files (images, CSS,
 * JavaScript and other assets) are forwarded to their matching GitHub Pages
 * paths instead of incorrectly receiving school.html.
 */
const PAGES_ORIGIN = "https://cripri-solutions.github.io";
const PAGES_BASE = "/cripri-universal-school-website/";

// Public subdomains may differ from the canonical database school slug.
// Keep explicit aliases here so host routing resolves the correct tenant.
const HOST_TO_SCHOOL_SLUG = {
  telwa: "telwa-girls"
};

function isValidSchoolSlug(slug) {
  if (!slug || slug.includes(".") || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return false;
  }
  return !["www", "admin", "api", "mail", "ftp"].includes(slug);
}

function getSchoolSlug(hostname, searchParams) {
  const host = hostname.toLowerCase();
  const suffix = ".criprisolutions.co.ke";

  // Production school sites always derive their slug from the real hostname.
  if (host.endsWith(suffix)) {
    const hostSlug = host.slice(0, -suffix.length);
    const schoolSlug = HOST_TO_SCHOOL_SLUG[hostSlug] || hostSlug;
    return isValidSchoolSlug(schoolSlug) ? schoolSlug : null;
  }

  // Preview-only override: lets us test a tenant on the Cloudflare Workers
  // preview hostname without changing production hostname routing.
  if (host.endsWith(".workers.dev")) {
    const previewSlug = (searchParams.get("school") || "").toLowerCase();
    return isValidSchoolSlug(previewSlug) ? previewSlug : null;
  }

  return null;
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const slug = getSchoolSlug(incoming.hostname, incoming.searchParams);

    if (!slug) {
      return new Response("School website not found.", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }

    // Serve the school engine at the subdomain root. For every other path,
    // proxy the corresponding static asset from the GitHub Pages project.
    const requestedPath = incoming.pathname.replace(/^\/+/, "");
    const assetPath = requestedPath || "school.html";

    // Reject traversal attempts rather than allowing paths outside the site.
    const decodedPath = decodeURIComponent(assetPath);
    if (decodedPath.split("/").some(part => part === "." || part === "..")) {
      return new Response("Invalid asset path.", {
        status: 400,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }

    const destination = new URL(PAGES_BASE + assetPath, PAGES_ORIGIN);

    // Pass the school slug only to the dynamic HTML engine.
    if (assetPath === "school.html") {
      destination.searchParams.set("slug", slug);
    } else {
      incoming.searchParams.forEach((value, key) => {
        destination.searchParams.set(key, value);
      });
    }

    const upstreamRequest = new Request(destination.toString(), request);
    const upstreamResponse = await fetch(upstreamRequest);

    const headers = new Headers(upstreamResponse.headers);
    headers.set("X-CRIPRI-School-Slug", slug);
    headers.set(
      "Cache-Control",
      assetPath === "school.html" ? "public, max-age=300" : "public, max-age=3600"
    );

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers
    });
  }
};
