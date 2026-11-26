# SECURITY DEFINER function audit — read-only findings

**Status:** Read-only audit completed; no SQL changes made.  
**Database:** CRIPRI Platform (`dudrolmymjwphwivrlko`)  
**Date:** 2026-11-26  
**Purpose:** Identify SECURITY DEFINER functions, execution grants, database dependencies, and permission changes that must not be made without testing.

## Executive findings

The live `public` schema contains 22 SECURITY DEFINER functions.

- 2 are trigger functions and have no direct EXECUTE grant for `anon` or `authenticated`; they are invoked by their table triggers.
- 18 application/helper functions are executable by `authenticated` only (plus owner).
- 2 read/check functions are executable by both `anon` and `authenticated`: `is_active_cripri_school(uuid)` and `is_school_website_subscription_valid(uuid)`.
- No public-schema SECURITY DEFINER function in this inventory grants EXECUTE to `anon` unexpectedly beyond those two identified read/check functions.
- Public schema CREATE is false for `anon`, `authenticated`, and the PUBLIC pseudo-role, reducing the immediate risk from functions whose search path includes `public`.
- No blanket revoke is recommended. Several functions are used by RLS policies, other functions, frontend pages, or triggers.

## Inventory and classification

| Function | Current execution | Observed purpose/dependency | Audit disposition |
|---|---|---|---|
| `activate_institution()` | authenticated | Activates approved non-school institution membership; checks confirmed email and uniquely approved application | Retain authenticated; verify frontend flow |
| `activate_principal_school()` | authenticated | Activates school membership after approved application and confirmed email | Retain authenticated; verify frontend flow |
| `activate_school(uuid)` | authenticated | Platform-reviewer-only school activation | Retain; reviewer check present |
| `activate_school_demo_trial(uuid,integer)` | authenticated | Reviewer-only, fixed 30-day TELWA GIRLS demo trial | Retain only if this demo workflow is still intended; reviewer and target checks present |
| `activate_school_subscription(uuid,uuid)` | authenticated | Reviewer-only paid activation; checks confirmed linked payment and plan price | Retain; reviewer/payment checks present |
| `audit_school_domain_onboarding_change()` | owner only | Trigger audit for onboarding insert/update | Retain trigger-only |
| `create_school_review_notification()` | owner only | Trigger creates application review notifications | Retain trigger-only |
| `enforce_school_subscription_payment()` | owner only | Trigger blocks active subscription without qualifying payment | Retain trigger-only |
| `get_my_cripri_schools()` | authenticated | Returns only active school IDs associated with the caller | Retain; caller-scoped |
| `is_active_cripri_school(uuid)` | anon + authenticated | Used by public published-content RLS policy; also called by `is_active_cripri_school_admin(uuid)` | Preserve anon EXECUTE |
| `is_active_cripri_school_admin(uuid)` | authenticated | Used by RLS policies for school-site content and audit access; calls `is_active_cripri_school(uuid)` | Retain authenticated |
| `is_institution_admin(uuid)` | authenticated | Used by RLS policies on schools and content tables | Retain authenticated |
| `is_institution_member(uuid)` | authenticated | Wrapper around `is_school_member(uuid)` | Retain authenticated |
| `is_school_admin(uuid)` | authenticated | Membership/admin check | Retain pending wider caller inventory |
| `is_school_member(uuid)` | authenticated | Used by RLS policies for schools and content | Retain authenticated |
| `is_school_website_subscription_valid(uuid)` | anon + authenticated | Called by public `school.html` subscription gate | Preserve anon EXECUTE |
| `manage_institution_content_item(uuid,text,boolean)` | authenticated | Content management; role/member and active institution checks | Retain authenticated; test manager workflows |
| `manage_school_content_item(uuid,text,boolean)` | authenticated | Delegates to institution content manager | Retain authenticated; test manager workflows |
| `manage_school_site_content(uuid,text,jsonb)` | authenticated | Legacy/site content management; checks active CRIPRI school admin | Retain pending legacy frontend inventory |
| `refresh_expired_school_subscriptions()` | authenticated | Reviewer-only expiry refresh | Retain; reviewer check present |
| `renew_school_subscription(uuid,uuid)` | authenticated | Reviewer-only renewal; validates linked confirmed payment and plan | Retain; reviewer/payment checks present |
| `review_school_application(uuid,text,text)` | authenticated | Reviewer-only pending application decision and audit | Retain; reviewer and pending-row checks present |

## Confirmed database dependencies

### RLS policy dependencies

These functions are actively used by row-level security policies and must not be revoked or renamed without coordinated policy changes:

- `is_school_member` and `is_institution_admin`: policies on `school_content`, `school_content_items`, and `schools`.
- `is_active_cripri_school`: public read policy on `school_site_content`.
- `is_active_cripri_school_admin`: policies on `school_content_audit` and `school_site_content`.

### Function-to-function dependencies

- `is_active_cripri_school_admin` calls `is_active_cripri_school`.
- `is_institution_member` calls `is_school_member`.
- `manage_school_content_item` calls `manage_institution_content_item`.

The reference scan also returned substring matches for `activate_school` inside longer function names; those are not proof of direct calls.

### Trigger dependencies

- `create_school_review_notification` is attached to `school_applications` after status updates.
- `enforce_school_subscription_payment` is attached to `school_subscriptions` before insert/update.
- `audit_school_domain_onboarding_change` is attached to `school_domain_onboarding` after insert/update.

The trigger functions have owner-only EXECUTE and should remain that way.

### Frontend dependency already confirmed

- `school.html` calls `is_school_website_subscription_valid`; preserve anonymous execution for public website rendering.
- The earlier inspection of eight main frontend files found no direct call to `is_active_cripri_school`, but the database RLS and helper-function dependencies prove that it is required by the public content policy. Preserve anonymous execution.

## Search-path and privilege observations

- Functions using `SET search_path TO ''` explicitly qualify their database object references and are the preferred pattern in this inventory.
- A smaller group uses `SET search_path TO 'public', 'pg_temp'`. Their table references were inspected and use schema-qualified `public.*` names. The live database reports that `anon`, `authenticated`, and `PUBLIC` do not have CREATE on schema `public`.
- Do not mass-rewrite search paths in this project. Any future change should be a separately tested hardening migration.
- All inspected application functions use caller identity checks (`auth.uid()`) and/or active platform reviewer checks where privileged state changes occur. This audit is not a substitute for adversarial function testing.

## Follow-up items (not applied)

1. Inspect every frontend page and deployed worker route for calls to the authenticated functions, especially the legacy content manager and subscription administration paths.
2. Confirm whether the TELWA GIRLS demonstration trial function is still required before considering any change.
3. Test each manager and reviewer workflow in a safe environment with positive and negative authorization cases.
4. Keep trigger-function EXECUTE restricted to the owner.
5. Preserve anonymous execution for the two confirmed public-read helpers until their calling paths are deliberately redesigned and tested.
6. Do not revoke authenticated EXECUTE based solely on a lack of direct frontend references; RLS, wrappers, RPC calls, and administrative workflows may depend on them.
7. No migration should be applied until a full restorable backup exists and the change has explicit approval.

## Change status

This audit is documentation only. No grants, functions, policies, triggers, schema objects, or data were changed.
