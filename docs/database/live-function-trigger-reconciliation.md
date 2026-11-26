# Live function and trigger reconciliation

**Captured:** 2026-11-26  
**Project:** CRIPRI Platform (`dudrolmymjwphwivrlko`)  
**Branch:** `feature/universal-institution-manager`  
**Method:** Read-only PostgreSQL catalog inspection and comparison with the two current feature migrations that touch application approval or notification state.

## Safety

Only catalog metadata was queried: function names/signatures, owners, security-definer flags, execute ACLs, trigger-to-function mappings, and trigger definitions. No function bodies, application data, secrets, or credentials were exported. No database object or permission was changed.

## Live inventory

- 25 public functions/procedures.
- 7 non-internal public triggers; all 7 are enabled.
- 20 of the 25 functions are marked SECURITY DEFINER (catalog count at capture time).
- Trigger functions include three SECURITY DEFINER functions:
  - `public.create_school_review_notification()`
  - `public.audit_school_domain_onboarding_change()`
  - `public.enforce_school_subscription_payment()`

The catalog also shows SECURITY DEFINER functions with authenticated EXECUTE grants for subscription activation/renewal, institution and school content management, reviewer approval, and membership/admin checks. The two public-facing subscription/status helpers `is_active_cripri_school(uuid)` and `is_school_website_subscription_valid(uuid)` have anon and authenticated EXECUTE grants.

**Do not apply blanket EXECUTE revocations.** Some helpers are called by other functions or by public institution pages. In particular, the current frontend calls `is_school_website_subscription_valid(uuid)` when rendering a public institution website, and `is_active_cripri_school(uuid)` is used by the admin helper. Removing these grants without dependency-aware testing could break production behaviour.

## Live trigger map

| Table | Trigger | Function | Event |
|---|---|---|---|
| `school_applications` | `trg_school_review_notification` | `create_school_review_notification()` | AFTER UPDATE OF status |
| `school_content` | `school_content_set_updated_at` | `set_updated_at()` | BEFORE UPDATE |
| `school_content_items` | `school_content_items_set_audit` | `set_school_content_item_audit()` | BEFORE INSERT OR UPDATE |
| `school_domain_onboarding` | `trg_school_domain_onboarding_audit` | `audit_school_domain_onboarding_change()` | AFTER INSERT OR UPDATE |
| `school_domain_onboarding` | `trg_school_domain_onboarding_updated_at` | `set_school_domain_onboarding_updated_at()` | BEFORE UPDATE |
| `school_subscriptions` | `trg_enforce_school_subscription_payment` | `enforce_school_subscription_payment()` | BEFORE INSERT OR UPDATE |
| `schools` | `schools_set_updated_at` | `set_updated_at()` | BEFORE UPDATE |

## Comparison with proposed feature migrations

### `202611260001_preserve_institution_application_details.sql`

This proposed migration replaces `public.review_school_application(uuid,text,text)` and adds institution detail columns/constraints plus fields to the `institutions` view.

The replacement function retains the core live security checks and review flow: authenticated caller, active platform reviewer, approved/rejected decision validation, pending-only row lock, creation of the institution on approval, and review audit insertion. It additionally copies category, other-type description, region, contact person/role, address, country, phone and email into the institution record.

The live trigger `trg_school_review_notification` is not dropped or replaced by this migration. Because it fires after application status updates, its interaction with the replacement review function must be tested in a non-production environment before release.

### `20261126120000_notification_email_send_claim.sql`

This proposed migration adds `email_claimed_at` and expands the email status constraint on `platform_notifications`. It does not define or replace a trigger or function. Its corresponding Edge Function rollout must therefore be checked separately for matching claim/finalization semantics and retry behaviour.

## Findings and risk decisions

1. **No missing trigger was silently inferred.** The seven live trigger definitions were enumerated directly from the catalog.
2. **The application review notification trigger is an important dependency.** Approval/rejection status updates invoke it; preserve it unless a separately tested replacement is explicitly planned.
3. **The proposed review RPC replacement is security-sensitive.** Retain the active-reviewer authorization, pending-only lock, and audit insertion exactly; verify the trigger side-effect and transaction behaviour in staging.
4. **Do not revoke function grants wholesale.** Review each SECURITY DEFINER function against frontend calls, RPC callers, RLS policy expressions, and function-to-function dependencies.
5. **The current branch migrations do not reconcile the full historical function/trigger source history.** The live migration ledger/source mismatch remains a separate release blocker.
6. **No production action is authorized.** A complete restorable backup and explicit approval of a specific migration/deployment remain mandatory.

## Recommended next safe step

Build a dependency matrix for SECURITY DEFINER functions (direct frontend/RPC callers, policy references, trigger references, nested function calls, execute grants, and authorization checks). Then test only the proposed review-function replacement and notification claim workflow against a restored or isolated non-production database. Do not alter live grants, functions, triggers, or migration history during this assessment.
