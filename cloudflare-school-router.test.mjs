import test from "node:test";
import assert from "node:assert/strict";
import worker from "./cloudflare-school-router.js";

const originalFetch = globalThis.fetch;

function mockFetch(response = new Response("upstream", { status: 200 })) {
  let captured;
  globalThis.fetch = async (request, options) => {
    captured = { request, options };
    return response;
  };
  return () => captured;
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("routes an institution root to the shared website with its slug", async () => {
  const getCaptured = mockFetch();
  const response = await worker.fetch(new Request(
    "https://green-valley.criprisolutions.co.ke/"
  ));

  const captured = getCaptured();
  const target = new URL(captured.request.url);

  assert.equal(target.origin, "https://cripri-solutions.github.io");
  assert.equal(target.pathname, "/cripri-universal-school-website/school.html");
  assert.equal(target.searchParams.get("slug"), "green-valley");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-CRIPRI-Institution-Slug"), "green-valley");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=60, s-maxage=60");
  assert.equal(captured.options.cf.cacheTtlByStatus["200-299"], 60);
});

test("forwards static asset paths and safe query parameters", async () => {
  const getCaptured = mockFetch();
  await worker.fetch(new Request(
    "https://green-valley.criprisolutions.co.ke/assets/site.css?v=4",
    { headers: { accept: "text/css", cookie: "session=secret", authorization: "Bearer secret" } }
  ));

  const captured = getCaptured();
  const target = new URL(captured.request.url);

  assert.equal(target.pathname, "/cripri-universal-school-website/assets/site.css");
  assert.equal(target.searchParams.get("v"), "4");
  assert.equal(captured.request.headers.get("accept"), "text/css");
  assert.equal(captured.request.headers.has("cookie"), false);
  assert.equal(captured.request.headers.has("authorization"), false);
  assert.equal(captured.options.cf.cacheTtlByStatus["200-299"], 3600);
});

test("rejects reserved or invalid hosts without contacting the origin", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("unexpected"); };

  const response = await worker.fetch(new Request(
    "https://admin.criprisolutions.co.ke/"
  ));

  assert.equal(response.status, 404);
  assert.equal(called, false);
});

test("rejects methods other than GET and HEAD", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("unexpected"); };

  const response = await worker.fetch(new Request(
    "https://green-valley.criprisolutions.co.ke/",
    { method: "POST" }
  ));

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, HEAD");
  assert.equal(called, false);
});

test("does not cache upstream failures", async () => {
  mockFetch(new Response("upstream failure", { status: 503 }));
  const response = await worker.fetch(new Request(
    "https://green-valley.criprisolutions.co.ke/assets/missing.js"
  ));

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("rejects URL-encoded path traversal before contacting the origin", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("unexpected"); };

  const response = await worker.fetch(new Request(
    "https://green-valley.criprisolutions.co.ke/%2e%2e/private.txt"
  ));

  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("rejects malformed percent encoding before contacting the origin", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response("unexpected"); };

  const response = await worker.fetch(new Request(
    "https://green-valley.criprisolutions.co.ke/%E0%A4%A"
  ));

  assert.equal(response.status, 400);
  assert.equal(called, false);
});
