/**
 * CRIPRI Institution Website Host Router
 *
 * Deploy as a Cloudflare Worker and attach route:
 *   *.criprisolutions.co.ke/*
 *
 * Root requests serve the dynamic institution page. Static files (images, CSS,
 * JavaScript and other assets) are forwarded to their matching GitHub Pages
 * paths instead of incorrectly receiving school.html.
 */
const PAGES_ORIGIN = "https://cripri-solutions.github.io";
const PAGES_BASE = "/cripri-universal-school-website/";

function getInstitutionSlug(hostname) {
  const suffix = ".criprisolutions.co.ke";
  const host = hostname.toLowerCase();

  if (!host.endsWith(suffix)) return null;

  const slug = host.slice(0, -suffix.length);

  if (!slug || slug.includes(".") || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return null;
  }

  if (["www", "admin", "api", "mail", "ftp"].includes(slug)) return null;

  return slug;
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const slug = getInstitutionSlug(incoming.hostname);

    if (!slug) {
      return new Response("Institution website not found.", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }

    // Serve the institution website engine at the subdomain root. For every other path,
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

    // Pass the institution slug only to the dynamic HTML engine.
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
    headers.set("X-CRIPRI-Institution-Slug", slug);
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
