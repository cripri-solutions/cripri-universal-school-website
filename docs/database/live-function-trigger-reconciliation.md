# Live function and trigger dependency matrix

**Captured:** 2026-11-26  
**Project:** CRIPRI Platform (`dudrolmymjwphwivrlko`)  
**Branch:** `feature/universal-institution-manager`

## Safety and method

Read-only PostgreSQL catalog queries inspected function signatures, ownership, SECURITY DEFINER flags, execute privileges, trigger definitions, RLS policy expressions, and function source internally for authorization/dependency indicators. Function bodies were not copied into this report or committed. No application data, secrets, credentials, DDL, grants, policies, functions, or triggers were changed.

## Verified inventory

- 25 public functions/procedures.
- **22 SECURITY DEFINER** functions.
- **20 functions executable by authenticated** (19 SECURITY DEFINER functions plus the non-definer trigger function `set_school_content_item_audit`).
- **3 functions executable by anon**: `is_active_cripri_school(uuid)`, `is_school_website_subscription_valid(uuid)`, and the trigger function `set_school_content_item_audit()`. Trigger functions are not ordinary client RPC endpoints.
- 7 enabled, non-internal public triggers.

The previous draft of this report stated 20 SECURITY DEFINER functions. A fresh catalog count corrected that figure to **22**; use this corrected report.

## Dependency matrix

| Function / group | Verified dependency | Execute exposure | Authorization / risk observation |
|---|---|---|---|
| `is_institution_admin(uuid)` | Referenced by 12 RLS policy expressions | authenticated | Calls `auth.uid()`; core tenant-admin boundary. Do not revoke or change without policy tests |
| `is_school_member(uuid)` | Referenced by 5 RLS policy expressions; also used by `is_institution_member` | authenticated | Calls `auth.uid()`; core membership boundary |
| `is_active_cripri_school(uuid)` | Referenced by 1 RLS policy; called by `is_active_cripri_school_admin` | anon + authenticated | Public status helper; preserve while public-content policy depends on it |
| `is_active_cripri_school_admin(uuid)` | Referenced by 2 RLS policies | authenticated | Calls `auth.uid()`; admin/audit visibility boundary |
| `is_school_admin(uuid)` | Helper checks admin membership | authenticated | Calls `auth.uid()`; no direct policy reference found in current catalog query |
| `is_institution_member(uuid)` | Calls `is_school_member` | authenticated | Membership wrapper; nested dependency verified |
| `is_school_website_subscription_valid(uuid)` | Called by public institution website frontend (`school.html`) | anon + authenticated | Public page dependency; do not revoke anon execute without changing and testing the page |
| `review_school_application(uuid,text,text)` | Called by application review workflow; application status update fires review notification trigger | authenticated | Calls `auth.uid()`, checks active `platform_reviewers`, pending-only row lock, and writes review audit |
| `activate_school(uuid)`, `activate_school_demo_trial(uuid,int)`, `activate_school_subscription(uuid,uuid)`, `renew_school_subscription(uuid,uuid)`, `refresh_expired_school_subscriptions()` | Subscription lifecycle RPC group | authenticated | Catalog/source checks show `auth.uid()` and active `platform_reviewers` checks; keep payment/trial constraints intact |
| `activate_institution()`, `activate_principal_school()` | Institution/school activation group | authenticated | Source scan shows `auth.uid()` and `auth.users` references; reviewer/admin authorization semantics require detailed manual review before any permission change |
| `manage_institution_content_item(uuid,text,bool)` | Calls `manage_school_content_item` | authenticated | Delegates to school content manager; evaluate nested authorization in callee |
| `manage_school_content_item(uuid,text,bool)` | Called by institution content manager | authenticated | Calls `auth.uid()`; content-management security boundary |
| `manage_school_site_content(uuid,text,jsonb)` | Website content management RPC | authenticated | Calls `auth.uid()`; inspect role/tenant checks before any permission change |
| `get_my_cripri_schools()` | User-facing membership lookup | authenticated | Calls `auth.uid()`; returns current user's school association |
| `create_school_review_notification()` | Trigger on `school_applications` after status update | no direct anon/authenticated grant indicated | SECURITY DEFINER trigger function; retain trigger side-effect and validate notification writes |
| `audit_school_domain_onboarding_change()` | Trigger on `school_domain_onboarding` after insert/update | no direct anon/authenticated grant indicated | SECURITY DEFINER audit trigger |
| `enforce_school_subscription_payment()` | Trigger on `school_subscriptions` before insert/update | no direct anon/authenticated grant indicated | SECURITY DEFINER payment-enforcement trigger |
| `set_school_content_item_audit()` | Trigger on `school_content_items` before insert/update | catalog default grants make it visible in execute privilege checks | Non-SECURITY DEFINER trigger function; not a normal client RPC |
| `set_updated_at()`, `set_school_domain_onboarding_updated_at()` | Timestamp triggers | no direct authenticated grant | Non-SECURITY DEFINER trigger helpers |

### RLS policy references confirmed from live catalog

- `is_institution_admin`: 12 policy expressions.
- `is_school_member`: 5 policy expressions.
- `is_active_cripri_school_admin`: 2 policy expressions.
- `is_active_cripri_school`: 1 policy expression.

The RLS policy scan also found admin/member helper usage across `schools`, `school_content`, `school_content_items`, `school_content_audit`, and `school_site_content`.

### Trigger map

| Table | Trigger | Function | Event |
|---|---|---|---|
| `school_applications` | `trg_school_review_notification` | `create_school_review_notification()` | AFTER UPDATE OF status |
| `school_content` | `school_content_set_updated_at` | `set_updated_at()` | BEFORE UPDATE |
| `school_content_items` | `school_content_items_set_audit` | `set_school_content_item_audit()` | BEFORE INSERT OR UPDATE |
| `school_domain_onboarding` | `trg_school_domain_onboarding_audit` | `audit_school_domain_onboarding_change()` | AFTER INSERT OR UPDATE |
| `school_domain_onboarding` | `trg_school_domain_onboarding_updated_at` | `set_school_domain_onboarding_updated_at()` | BEFORE UPDATE |
| `school_subscriptions` | `trg_enforce_school_subscription_payment` | `enforce_school_subscription_payment()` | BEFORE INSERT OR UPDATE |
| `schools` | `schools_set_updated_at` | `set_updated_at()` | BEFORE UPDATE |

## Proposed migration compatibility

### `202611260001_preserve_institution_application_details.sql`

Replaces `review_school_application(uuid,text,text)`. The proposed body preserves authentication, active platform-reviewer validation, decision validation, pending-only row locking and review audit insertion, and copies the new registration fields into `schools`.

The existing `trg_school_review_notification` remains attached to `school_applications`; it will still fire after the review function updates application status. Test the exact notification side-effect and rollback behaviour on an isolated/restored database before production rollout.

### `20261126120000_notification_email_send_claim.sql`

Adds `email_claimed_at` and expands the notification email status constraint. It does not define a trigger or replace a database function. The matching Edge Function must be reviewed for atomic claiming, idempotency, stale-claim recovery and finalization before rollout.

## Follow-up security-advisor and authorization review — 26 November 2026

### Security advisor snapshot

The latest live Supabase security advisor reports:

- 1 ERROR: `public.public_institution_profiles` is a SECURITY DEFINER view.
- 2 anonymous-executable SECURITY DEFINER RPCs: `is_active_cripri_school(uuid)` and `is_school_website_subscription_valid(uuid)`.
- 19 authenticated-executable SECURITY DEFINER functions.
- 2 INFO findings: `cripri_content_admins` and `cripri_content_schools` have RLS enabled but no policies.
- 1 Auth warning: leaked-password protection is disabled.
- The performance advisor reports 22 unindexed foreign keys, 7 unused indexes, and 9 multiple-permissive-policy findings. These are not automatic deletion or rewrite instructions.

### Public profile view: retain narrow public projection pending safer conversion

Live catalog checks reconfirmed:

- Owner: `postgres`; option: `security_barrier=true`.
- View columns are limited to public profile fields and rows are filtered to `schools.status = 'active'`.
- `anon` and `authenticated` have effective SELECT on the view and no effective INSERT, UPDATE or DELETE.
- The underlying `schools` table has RLS enabled and a public active-row SELECT policy.
- Authenticated has table-level SELECT on `schools`, but anon does not.

**Decision:** do not simply set `security_invoker=true`. An invoker view would require the caller to have SELECT on every referenced underlying column. Granting anon table-level SELECT on `schools` would expose additional columns through the direct table API, even with the active-row RLS filter. A safer future conversion would require carefully scoped column-level SELECT grants for only the view's projection, followed by public API/RLS regression tests. Until a restorable backup and test environment exist, retain the current limited projection and record the advisor finding as an accepted, bounded risk rather than making an unsafe change.

The unrelated extra view ACL grants are separately documented in `public-profile-permissions-review.md`; effective INSERT/UPDATE/DELETE checks are false for anon and authenticated.

### Individual SECURITY DEFINER function review

Read-only inspection of live definitions confirmed:

- `activate_institution()`: derives the caller from `auth.uid()`; requires a confirmed Auth email; matches exactly one approved non-school application and its audit-linked institution using that email; locks the relevant records; blocks suspended institutions and accounts already linked to a different institution; assigns the institution-admin membership; activates a pending institution. Uses an empty search path. No immediate authorization bypass was identified in the inspected body.
- `activate_principal_school()`: likewise requires an authenticated caller and confirmed email; matches exactly one approved school application whose recorded contact role matches principal/headteacher/school administrator; follows the approved audit link; locks application and school; blocks suspended schools and cross-institution membership; assigns school-admin membership. Uses an empty search path. No immediate authorization bypass was identified in the inspected body.
- `refresh_expired_school_subscriptions()`: checks `auth.uid()` against an active `platform_reviewers` row before expiring subscriptions; uses a fixed `public, pg_temp` search path. Its authenticated EXECUTE grant is consistent with the internal reviewer check, though unauthorized-call and reviewer-call tests remain required.

These checks do not establish that every SECURITY DEFINER function is safe. The remaining subscription lifecycle, content-management, and helper RPCs still need individual source review and caller/dependency mapping. Do not revoke EXECUTE globally.

### Additional findings to retain

- `cripri_content_admins` and `cripri_content_schools` have RLS enabled without policies. This is fail-closed for ordinary roles, but inspect service-role/owner workflows before adding policies.
- The 19 authenticated SECURITY DEFINER findings require per-function authorization review, not blanket revocation.
- The two anonymous helper findings have known application/RLS dependencies. Preserve their current grants until the full dependency and API exposure review is complete.
- Leaked-password protection is an Auth configuration improvement. Do not change it blindly; first confirm the current sign-up/login flows and whether enabling it is available under the existing no-cost plan.

## Release decisions

1. Do not revoke EXECUTE from all SECURITY DEFINER functions as a blanket operation.
2. Do not change the four policy-referenced helper groups without RLS regression tests.
3. Preserve the public subscription-check RPC while public institution pages call it.
4. Inspect the full authorization logic of `activate_institution`, `activate_principal_school`, and the content-management RPCs before proposing individual permission changes.
5. Keep the review-notification trigger and subscription-payment enforcement trigger unless a tested replacement is explicitly approved.
6. Historical migration-source reconciliation and the absence of a verified full restorable backup remain release blockers.

## Next safe action

Use a restored or isolated non-production database to test the proposed review RPC replacement and notification claim workflow, then test tenant isolation and RLS for admin/member helpers. Do not change production permissions, functions, triggers, schema, or migration history during this work.


### Additional source review: content RPCs and review-notification trigger — 26 November 2026

Read-only inspection of the live definitions confirmed:

- `manage_school_content_item(uuid,text,bool)` requires an authenticated actor, joins the content item to its school and membership, requires the caller's membership role to be `school_admin` or `institution_admin`, and requires the school to be active. It locks the content row before recovery, restore, or permanent deletion and records an audit entry. Permanent deletion requires both Recovery Bin status and an explicit confirmation flag.
- `manage_school_site_content(uuid,text,jsonb)` requires an authenticated actor and an active `SCHOOL_ADMIN` assignment in `cripri_content_admins` joined to an ACTIVE row in `cripri_content_schools`. It scopes content reads/updates/deletes to the supplied school ID and records audit entries. Its separate admin tables have no RLS policies, so their intended access must remain tightly controlled through this SECURITY DEFINER function and service-role/admin workflows; do not add broad policies without mapping those workflows.
- `get_my_cripri_schools()` filters both admin and school rows to the current `auth.uid()`, active SCHOOL_ADMIN role and ACTIVE school status.
- `renew_school_subscription(uuid,uuid)` requires an active platform reviewer, locks the subscription, disallows non-active/non-expired states and demo-trial renewal, checks an active priced plan and a confirmed payment tied to the same subscription and school, and requires the payment amount to meet the plan price before extending the subscription.

#### Review-notification association issue — requires correction before rollout

The live `create_school_review_notification()` trigger currently finds `school_id` by matching the application name and institution type, then choosing the most recently created matching school. It does not use the exact `school_id` written by the review RPC into `application_review_audit`. If two applications use the same institution name and type, the notification can be associated with the wrong institution record. The notification still uses the correct application ID and recipient email, but its school association may be incorrect.

**Recommendation:** prepare a narrowly scoped replacement that resolves the school ID from the audit row for `NEW.id` and the corresponding approved decision, rather than matching on name/type. Preserve the unique `(application_id,event_type)` conflict protection. Add an isolated test with two approved applications sharing the same name and type to prove each notification references its own audit-linked school. Do not alter the live trigger/function until a restorable backup, test environment, and explicit production approval exist.

No production objects or data were changed during this inspection.


#### Follow-up verification — 26 November 2026

- GitHub Actions run 45812553362 completed successfully for commit `b7e4812c3081d76faec4566afc0473b924ec9c81` (workflow run 188).
- Read-only inspection of the live database confirmed the existing unique constraint `platform_notifications_application_event_unique` on `(application_id, event_type)`; the proposed trigger retains `ON CONFLICT (application_id, event_type) DO NOTHING`.
- The live `school_applications` AFTER UPDATE OF status trigger remains attached to `create_school_review_notification()`; the live function remains SECURITY DEFINER with an empty search_path. No live function or trigger was replaced.
- These checks establish that the proposed migration preserves the existing duplicate-notification key and trigger attachment. They do not prove the new trigger behaviour at runtime. An isolated integration test with two same-name/same-type applications and rollback verification remains outstanding.

No production database changes were made.
