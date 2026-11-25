
/**
 * CRIPRI Universal Institution Website Host Router
 *
 * Deploy as a Cloudflare Worker and attach route:
 *   *.criprisolutions.co.ke/*
 *
 * Institution subdomain roots serve the dynamic website engine.
 * Static assets are forwarded to the GitHub Pages project.
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

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const slug = getInstitutionSlug(incoming.hostname);

    if (!slug) {
      return new Response("Institution website not found.", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8"
        }
      });
    }

    // This Worker serves public website pages and assets only.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed.", {
        status: 405,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "Allow": "GET, HEAD"
        }
      });
    }

    const requestedPath = incoming.pathname.replace(/^\/+/, "");
    const assetPath = requestedPath || "school.html";

    // Safely decode and reject malformed or traversal paths.
    let decodedPath;

    try {
      decodedPath = decodeURIComponent(assetPath);
    } catch {
      return new Response("Invalid asset path.", {
        status: 400,
        headers: {
          "content-type": "text/plain; charset=utf-8"
        }
      });
    }

    if (
      decodedPath.split("/").some(
        part => part === "." || part === ".."
      )
    ) {
      return new Response("Invalid asset path.", {
        status: 400,
        headers: {
          "content-type": "text/plain; charset=utf-8"
        }
      });
    }

    const destination = new URL(
      PAGES_BASE + assetPath,
      PAGES_ORIGIN
    );

    // Ensure the destination remains inside the intended project.
    if (
      destination.origin !== PAGES_ORIGIN ||
      !destination.pathname.startsWith(PAGES_BASE)
    ) {
      return new Response("Invalid destination.", {
        status: 400,
        headers: {
          "content-type": "text/plain; charset=utf-8"
        }
      });
    }

    // Pass the institution slug only to the dynamic website engine.
    if (assetPath === "school.html") {
      destination.searchParams.set("slug", slug);
    } else {
      incoming.searchParams.forEach((value, key) => {
        destination.searchParams.set(key, value);
      });
    }

    // Do not forward cookies or authentication credentials
    // to the public GitHub Pages origin.
    const safeHeaders = new Headers(request.headers);

    safeHeaders.delete("cookie");
    safeHeaders.delete("authorization");
    safeHeaders.delete("proxy-authorization");
    safeHeaders.delete("host");

    const upstreamRequest = new Request(destination.toString(), {
      method: request.method,
      headers: safeHeaders,
      redirect: "follow"
    });

    const upstreamResponse = await fetch(upstreamRequest);

    const headers = new Headers(upstreamResponse.headers);

    headers.set("X-CRIPRI-Institution-Slug", slug);

    headers.set(
      "Cache-Control",
      assetPath === "school.html"
        ? "public, max-age=300"
        : "public, max-age=3600"
    );

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers
    });
  }
};
