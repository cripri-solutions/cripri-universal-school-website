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

## Release decisions

1. Do not revoke EXECUTE from all SECURITY DEFINER functions as a blanket operation.
2. Do not change the four policy-referenced helper groups without RLS regression tests.
3. Preserve the public subscription-check RPC while public institution pages call it.
4. Inspect the full authorization logic of `activate_institution`, `activate_principal_school`, and the content-management RPCs before proposing individual permission changes.
5. Keep the review-notification trigger and subscription-payment enforcement trigger unless a tested replacement is explicitly approved.
6. Historical migration-source reconciliation and the absence of a verified full restorable backup remain release blockers.

## Next safe action

Use a restored or isolated non-production database to test the proposed review RPC replacement and notification claim workflow, then test tenant isolation and RLS for admin/member helpers. Do not change production permissions, functions, triggers, schema, or migration history during this work.
