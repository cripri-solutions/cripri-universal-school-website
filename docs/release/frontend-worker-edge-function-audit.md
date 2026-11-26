# Frontend, Worker, and Edge Function Integration Audit

**Status:** Read-only integration review; no code or live service changes made.  
**Date:** 2026-11-26  
**Branch reviewed:** `feature/universal-institution-manager`  
**Supabase project:** `dudrolmymjwphwivrlko`

## Executive summary

The main frontend-to-database paths are connected to existing RPCs, views, and tables. The Cloudflare Worker is configured as a public GET/HEAD router and its unit tests cover key path and host cases. Three Supabase Edge Functions are active in the live project and their authentication settings are enabled.

Two release-control gaps remain:

1. The deployed Edge Function source files are not present in the reviewed GitHub feature branch. The live functions can be read from Supabase, but the repository has no `supabase/functions/<name>/index.ts` source for any of the three active functions. This creates source-control and reproducibility drift.
2. `wrangler.jsonc` contains an empty `previews` object. There is no configured Cloudflare Worker preview deployment, consistent with the existing PR deployment gate.

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

The project currently reports these three active functions; all have `verify_jwt=true`:

| Function | Live version | Called by current frontend | Repository source |
|---|---:|---|---|
| `school-admin-management` | 2 | Yes — administrator role changes/removal/invitation | Missing from reviewed branch |
| `send-school-notification` | 4 | Yes — send/retry application email | Missing from reviewed branch |
| `super-admin-administrators` | 3 | No direct call found in current `super-admin-preview.html` | Missing from reviewed branch |

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

## Cloudflare Worker

- `cloudflare-school-router.js` accepts only GET/HEAD requests.
- It validates institution subdomains, rejects reserved labels, rejects malformed and nested-encoded traversal paths, and forwards only selected non-sensitive headers.
- It routes the institution root to `school.html?slug=<institution-slug>`.
- Its test file covers normal root routing, static asset routing, reserved hosts, method rejection, upstream failure caching, and encoded traversal.
- `wrangler.jsonc` has `previews: {}`; preview deployment is not configured.
- Do not merge/publish the Worker-dependent route until Cloudflare preview and production routing have been tested with the GitHub Pages deployment.

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
