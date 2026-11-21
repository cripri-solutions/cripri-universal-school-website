/**
 * CRIPRI School Website Host Router
 *
 * Deploy as a Cloudflare Worker and attach route:
 *   *.criprisolutions.co.ke/*
 *
 * Create a proxied wildcard DNS record for * on cr iprisolutions.co.ke.
 * This Worker serves the existing GitHub Pages school.html engine and
 * maps the first subdomain label to the school's registered slug.
 */
const PAGES_ORIGIN = "https://cripri-solutions.github.io";
const PAGES_BASE = "/cripri-universal-school-website/";

function getSchoolSlug(hostname) {
  const suffix = ".criprisolutions.co.ke";
  const host = hostname.toLowerCase();

  if (!host.endsWith(suffix)) return null;

  const slug = host.slice(0, -suffix.length);

  // Only one school subdomain label is supported.
  if (!slug || slug.includes(".") || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return null;
  }

  // Reserve platform hostnames; they must not resolve to school records.
  if (["www", "admin", "api", "mail", "ftp"].includes(slug)) return null;

  return slug;
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const slug = getSchoolSlug(incoming.hostname);

    if (!slug) {
      return new Response("School website not found.", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }

    const destination = new URL(
      PAGES_BASE + "school.html",
      PAGES_ORIGIN
    );
    destination.searchParams.set("slug", slug);

    // Preserve request method and headers while sending to the existing site engine.
    const upstreamRequest = new Request(destination.toString(), request);
    const upstreamResponse = await fetch(upstreamRequest);

    const headers = new Headers(upstreamResponse.headers);
    headers.set("X-CRIPRI-School-Slug", slug);
    headers.set("Cache-Control", "public, max-age=300");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers
    });
  }
};
