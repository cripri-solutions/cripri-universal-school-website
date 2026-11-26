# Frontend, Worker, and Edge Function Integration Audit

**Status:** Read-only integration review; no code or live service changes made.  
**Date:** 2026-11-26  
**Branch reviewed:** `feature/universal-institution-manager`  
**Supabase project:** `dudrolmymjwphwivrlko`

## Executive summary

The main frontend-to-database paths are connected to existing RPCs, views, and tables. The Cloudflare Worker is configured as a public GET/HEAD router and its unit tests cover key path and host cases. Three Supabase Edge Functions are active in the live project and their authentication settings are enabled.

Two release-control gaps remain:

1. The deployed Edge Function entrypoints have now been recovered into a separate dated archive. The active branch notification sender still differs from its deployed version, so release-source alignment remains outstanding.
2. `wrangler.jsonc` contains no declared Worker routes and an empty `previews` object. Dashboard-managed routing may exist, but it cannot be verified from this repository.

No function was redeployed, no Worker deployed, and no live permissions changed.

## Frontend integration map

### Institution registration

- `school-registration-preview.html` inserts a pending application into `school_applications`.
- The form submits institution type, category, contact, country/region, physical address and the optional `other_institution_type` value for the Other option.
- The database migration review has already confirmed the required column grants and allowlist changes are pending in PR #5.

### Institution manager

- `school-website.manager.html` reads and updates the `institutions` view.
- It reads/writes `institution_content_items` under the authenticated role and RLS policies.
- Content recovery, restoration and permanent deletion call `manage_institution_content_item(uuid,text,boolean)`.
- The public website reads the same institution view and published content view/table path.
- These are consistent with the reviewed SECURITY DEFINER inventory and the view's security-invoker setting.

### Public institution website

- `school.html` reads an active institution from `public.institutions`.
- It calls `is_school_website_subscription_valid(uuid)` before rendering.
- It reads published and due scheduled rows from `institution_content_items`.
- The subscription RPC must remain callable by `anon` unless this website flow is deliberately redesigned and tested.

### Super Admin frontend

- `super-admin-preview.html` calls `activate_school`, `review_school_application`, `refresh_expired_school_subscriptions`, `activate_school_demo_trial`, `activate_school_subscription`, and `renew_school_subscription`.
- Each of those RPC functions is currently authenticated-only and includes an active platform-reviewer check for its privileged operation.
- The page invokes the Edge Functions `send-school-notification` and `school-admin-management`.
- The administrator list and notifications also read/update tables protected by reviewer-specific RLS policies.

## Live Supabase Edge Functions

The project currently reports these three active functions; all have `verify_jwt=true`. A follow-up read-only comparison on 2026-11-26 retrieved each deployed `index.ts` and compared it with the feature branch:

| Function | Live version | Called by current frontend | Repository source |
|---|---:|---|---|
| `school-admin-management` | 2 | Yes — administrator role changes/removal/invitation | Exact source match; archived below |
| `send-school-notification` | 4 | Yes — send/retry application email | Branch source differs; exact live source archived below |
| `super-admin-administrators` | 3 | No direct call found in current `super-admin-preview.html` | Exact source match; archived below |

### Source recovery comparison (2026-11-26)

The exact deployed `index.ts` files were retrieved through the Supabase project connection. Their deployed SHA-256 values and versions are:

| Function | Live version | Deployed SHA-256 | Comparison with feature-branch source |
|---|---:|---|---|
| `school-admin-management` | 2 | `ac8f649ceb23696c4b9750bea0db75aeb53e967b3b6ef5aa3f7f039e5ec419a4` | Exact text match |
| `send-school-notification` | 4 | `02604f2bb496854608628aa4435375953d0c48cac754db60a37b846291a16a2e` | Not an exact match; branch version contains proposed idempotency changes not present in live version |
| `super-admin-administrators` | 3 | `4ee26bca8d2a9aa767a9ead88bf08e366e81a5dbbf4ef57ada2e97e44f2794bd` | Exact text match |

All three exact deployed entrypoint files have now been preserved separately in the repository:

- [school-admin-management live version 2](../../recovery/edge-functions/2026-11-26/school-admin-management/index.ts)
- [send-school-notification live version 4](../../recovery/edge-functions/2026-11-26/send-school-notification/index.ts)
- [super-admin-administrators live version 3](../../recovery/edge-functions/2026-11-26/super-admin-administrators/index.ts)

The archive preserves the deployed entrypoint source only. Supabase reported `import_map=false` for all three functions and the retrieved deployment payload exposed only `index.ts`; this does not recover secret values, dashboard environment configuration, or any hidden platform configuration. Do not treat the archive as a complete deployment backup.

**Important notification discrepancy:** the branch's current `supabase/functions/send-school-notification/index.ts` includes an atomic claim/idempotency implementation, but the live version 4 does not. The live function currently performs a read/check, sends to Resend, and then updates the notification record. Do not deploy the branch version until its paired database migration, source review, and a verified recovery path are ready. Do not replace the branch source with the archived live file; keep both clearly distinguished.

### Edge Function security observations

- Both currently called functions verify the bearer token with Supabase Auth and check that the caller has an active `platform_reviewers` row.
- `school-admin-management` uses the service-role key after reviewer verification. It validates the institution exists and is active, limits assigned roles to `school_admin` or `content_editor`, and records audit events. Its service-role use is high impact and should remain reviewer-gated.
- `send-school-notification` verifies an active reviewer and reads/updates notifications using the authenticated caller client, subject to reviewer-only RLS.
- The notification sender checks whether a notification is already marked sent, then sends to Resend and updates the row. That check/send/update sequence is not an atomic claim. Concurrent retries could therefore send duplicate emails. This is a reliability risk to address later with an atomic claim/idempotency design; do not hot-edit the live function without repository source and tests.
- `super-admin-administrators` is a legacy/parallel service-role function. No current direct frontend invocation was found in the inspected Super Admin page. Keep it deployed until all references and operational dependencies are confirmed; do not delete it based only on this frontend scan.

### Relevant table access controls

- `platform_reviewers` has RLS enabled; authenticated users can read only their own active reviewer row.
- `platform_notifications` has RLS enabled; authenticated SELECT and UPDATE policies require an active platform reviewer.
- `school_memberships` has RLS enabled; members can read their own memberships and active reviewers can read the membership list.
- `school_admin_audit` has RLS enabled; active platform reviewers can read audit records.
- The table ACL for `platform_notifications` gives `anon` no SELECT/INSERT/UPDATE/DELETE, but it has extra non-data privileges (including REFERENCES, TRIGGER and TRUNCATE) that should be considered in a separate least-privilege review. RLS remains enabled. Do not make ACL changes without backup and regression tests.

## Cloudflare Worker and DNS/routing audit (2026-11-26)

### Repository configuration

- Worker name: `cripri-school-host`.
- Entrypoint: `cloudflare-school-router.js`.
- Compatibility date: `2026-11-21`.
- Expected production route is documented in the Worker source comment as `*.criprisolutions.co.ke/*`.
- `wrangler.jsonc` does **not** declare a `routes` entry or a `zone_name`/zone ID. A dashboard-managed route could still exist, but this repository does not prove that it does.
- `wrangler.jsonc` has an empty `previews` object. No preview hostname or preview URL is configured in this repository.
- No Cloudflare account/DNS connector is available in this workspace. Live zone status, DNS records, proxy state, Worker deployment version, route attachment, certificate status, and dashboard preview settings therefore remain **unverified**.

### Code-level findings

- The Worker accepts GET and HEAD only, validates one-label institution subdomains, and rejects the reserved labels `www`, `admin`, `api`, `mail`, and `ftp`.
- It rejects malformed percent-encoding and path traversal after repeated decoding, and restricts the upstream origin/path to the CRIPRI GitHub Pages project.
- It forwards only a small allowlist of request headers; cookies, Authorization and client-IP headers are not forwarded.
- Institution roots are rewritten to `school.html?slug=<slug>`; non-root asset query parameters are forwarded.
- Successful institution pages are assigned a 60-second cache lifetime; static assets 3,600 seconds; 404s 30 seconds; other upstream failures are marked no-store.
- Existing tests cover root routing, static assets, reserved host rejection, unsupported methods, upstream failures, and single/double-encoded traversal plus malformed encoding.
- The reserved-host list is a short hard-coded list. Before production routing, compare it with the actual CRIPRI subdomain/DNS inventory and add every operational hostname that must not be treated as an institution slug.
- The code comment's wildcard route is only an expectation; the source alone does not attach it. Cloudflare requires a DNS record for each proxied hostname used with a Worker route. Confirm a proxied wildcard DNS record and the exact route pattern in the live zone before enabling traffic.

### Routing and DNS decisions required

1. Confirm that `criprisolutions.co.ke` is an active Cloudflare zone and identify its authoritative nameservers.
2. Confirm the wildcard DNS record for `*.criprisolutions.co.ke`, its target, and that it is proxied (orange cloud) if using a Worker Route.
3. Confirm the deployed Worker service name is `cripri-school-host` and the live route is exactly `*.criprisolutions.co.ke/*`.
4. Confirm apex `criprisolutions.co.ke` and `www.criprisolutions.co.ke` are intentionally handled separately; the current slug parser rejects the apex and reserves `www`.
5. Confirm email-related DNS records (MX, SPF, DKIM, DMARC) remain intact and DNS-only where required. Do not replace or bulk-edit existing DNS records.
6. Configure a dedicated preview hostname separate from production, then test institution root, CSS/JS/images, 404s, cache isolation between two institution slugs, and upstream outage behavior.
7. Confirm TLS certificate coverage and redirect behavior for the wildcard hostnames.

Cloudflare's current documentation says Worker Routes require an existing DNS record for the hostname, and the record must be proxied for the Worker route to receive traffic. Cloudflare recommends Custom Domains when the Worker itself is the origin; Routes are appropriate when the Worker proxies to an external origin such as GitHub Pages. See [Routes documentation](https://developers.cloudflare.com/workers/configuration/routing/routes/) and [Custom Domains documentation](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

**No Cloudflare DNS records, routes, Worker deployments, or preview settings were changed.** No live DNS state has been inferred from the repository configuration.

## Required next actions

1. Recover and commit the exact currently deployed source for all three Edge Functions into `supabase/functions/<name>/index.ts`, preserving the deployed versions as the starting point. Do not redeploy them during source recovery.
2. Add tests for reviewer denial, invalid JWT, inactive institution, invalid role, invitation failure, audit failure, and duplicate notification-send attempts.
3. Resolve notification email idempotency before relying on retry under concurrent use.
4. Decide whether `super-admin-administrators` is retired or still used by another client before changing it.
5. Configure and test a Cloudflare Worker preview route; then test institution root, static assets, custom domains, cache behavior and failure handling.
6. Test registration, application review, institution activation, manager login, profile save, content publish/recovery, public rendering, administrator invitation/role changes, notification send, and subscription operations in a safe environment.
7. Do not apply pending migrations, redeploy Edge Functions, or merge PR #5 until the full restorable backup and explicit release approval are in place.

## Change status

Documentation only. No live database changes, Edge Function deployments, Cloudflare Worker deployments, email sends, or costs were incurred.


## Feature preview and automated smoke-check status (2026-11-26)

The latest audited feature-branch commit `2d85c2a9c54b58b9f4db81f6e27da26e394d2371` has the following verified CI/deployment results:

- Cloudflare Pages preview: **success**.
  - Commit preview: https://ecc632f8.cripri-universal-school-website.pages.dev/
  - Branch preview: https://feature-universal-institutio.cripri-universal-school-website.pages.dev/
- Cloudflare Worker preview build: **success** (build ID `77278bfc-5ea0-4260-a090-6e5f7244b7a6`). This is a preview build result, not proof that the production wildcard route is attached.
- Both GitHub validation runs: **success**.
  - Worker syntax validation: passed.
  - Worker routing behavior tests: passed.
  - Notification email idempotency tests: passed.
  - Registration/database contract validation: passed.
  - Inline JavaScript validation: passed.

### What is and is not proven

The checks above prove successful CI and preview build publication. They do not establish a successful real-browser walkthrough of the deployed preview, successful Supabase sign-in/profile/content writes, successful Storage upload, or production institution-subdomain routing. Those require browser-level checks with an authorized test account and live Cloudflare zone access.

The current preview environment has not been used to submit real institution applications, alter live records, upload media, or send notification emails. Do not test with real personal data.

### Safe browser smoke-check sequence still outstanding

1. Open the branch preview URL and confirm the landing page renders without a blank screen or JavaScript error.
2. Open the institution registration page; check that institution types and school category options render correctly. Do not submit a real application.
3. Open the public institution website without a slug and confirm the intended “not found / choose an institution” state is handled safely.
4. Open the manager and reviewer pages only to verify their unauthenticated state; do not attempt privileged actions.
5. In browser developer tools, check that the public page's CSS, JavaScript, fonts and images return successfully.
6. Use only a dedicated test account and test institution for authenticated workflows, after confirming the target preview points to the intended Supabase project and no production data will be changed.
7. Separately test the Worker using an authorized preview hostname; production wildcard DNS/route remains unverified.

**No production deployment, DNS change, database migration, or live data mutation was performed.**
