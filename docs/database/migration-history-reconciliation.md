# Live migration-history reconciliation

**Audit date:** 2026-11-26  
**Supabase project:** CRIPRI Platform (`dudrolmymjwphwivrlko`)  
**Repository branch reviewed:** `feature/universal-institution-manager`

## Purpose and safety boundary

This document records a read-only comparison between the live Supabase migration history and the repository migration directory. It is not an executable migration and does not authorize applying, deleting, renaming, or replaying any migration.

No live database changes were made during this audit. No migration was applied. The repository's existing migration files were not modified.

## Live history entries without matching repository source files

The live database reports these entries:

| Version | Migration name |
|---|---|
| `20261126081455` | `align_institution_notifications_and_secure_subscription_rpc` |
| `20261126081643` | `revoke_direct_execution_of_subscription_trigger_functions` |
| `20261126081812` | `add_public_institution_profile_view` |

The feature branch tree currently contains seven migration files, but no files matching these three migration names. Exact-name commit searches also did not identify source commits in this repository.

**Important:** absence from the checked branch and commit search does not prove that the original SQL never existed elsewhere. Recover original SQL from a trusted repository backup or deployment record if available. Do not fabricate an executable replacement and do not delete or replay the live history entries.

## Live object definitions observed

### Institution application notification

The live trigger is:

- Table: `public.school_applications`
- Trigger: `trg_school_review_notification`
- Timing: after update of `status`
- Function: `public.create_school_review_notification()`

The function is `SECURITY DEFINER` with an empty `search_path`. It creates one notification when an application transitions to `approved` or `rejected`, looks up a matching institution, and inserts into `public.platform_notifications`. It uses the unique key `(application_id, event_type)` with `ON CONFLICT DO NOTHING`.

The notification table currently contains application/institution references, event type, title, message, recipient email, email delivery state, provider message ID/error, and created/sent/read timestamps. Its event-type check currently allows `application_approved` and `application_rejected`. Its institution-type check does not currently include `hospital`; assess this alongside the pending universal-registration migrations before any future change.

Direct execution of `create_school_review_notification()` is currently not granted to `anon` or `authenticated`. The trigger can still invoke it as configured by PostgreSQL.

### Subscription payment enforcement

The live trigger is:

- Table: `public.school_subscriptions`
- Trigger: `trg_enforce_school_subscription_payment`
- Timing: before insert or update
- Function: `public.enforce_school_subscription_payment()`

The function is `SECURITY DEFINER`, with `search_path = public, pg_temp`. When a subscription is set to `active`, it requires a plan, a positive plan price, a confirmed payment linked to the same subscription and institution with a nonblank transaction reference, a payment amount at least equal to the plan price, and valid start/end dates.

Direct execution of `enforce_school_subscription_payment()` is currently not granted to `anon` or `authenticated`. Do not weaken or replace this trigger without a separate payment-integrity review.

### Public institution profile view

The live view is `public.public_institution_profiles`. Its current definition selects:

- `id`, `name`, `slug`, `institution_type`, `status`
- `motto`, `description`, `welcome_message`
- `county`, `country`, `logo_path`, `banner_path`

It filters to `status = 'active'`, is owned by `postgres`, and currently has `security_barrier=true` without `security_invoker=true`. `anon` and `authenticated` have SELECT access. The exposed columns are public-profile fields; application contact-person and review data are not selected.

The view's owner/RLS interaction must be deliberately assessed before changing it. Do not switch it to `security_invoker` until public reads are tested against the underlying `schools` RLS policies and the deployed frontend.

## Public subscription RPC dependency

The feature-branch `school.html` calls:

```js
supabase.rpc("is_school_website_subscription_valid", {
  p_school_id: school.institution_id
});
```

Therefore, public execution of `public.is_school_website_subscription_valid(uuid)` is currently a frontend dependency. Do not revoke its `anon` execute permission without first replacing the public check with an equally secure supported design and testing institution website rendering.

The other public boolean helper, `public.is_active_cripri_school(uuid)`, also has `anon` and `authenticated` execution grants. Its complete caller inventory remains to be confirmed before any permission change.

## Current permission observations

| Function | SECURITY DEFINER | anon EXECUTE | authenticated EXECUTE |
|---|---:|---:|---:|
| `create_school_review_notification()` | yes | no | no |
| `enforce_school_subscription_payment()` | yes | no | no |
| `is_active_cripri_school(uuid)` | yes | yes | yes |
| `is_school_website_subscription_valid(uuid)` | yes | yes | yes |

The public profile view has SELECT granted to `anon` and `authenticated`. The audit also observed extra non-SELECT table privileges on that view for these roles; those grants should be reviewed and reduced to least privilege in a separately tested change. They were not changed in this audit.

## Remaining work before release

1. Recover the original SQL for the three history entries from a trusted source, if possible.
2. If original SQL cannot be recovered, prepare a separately reviewed *reconciliation-only* source migration based on verified live definitions. It must be idempotent where appropriate and must not be applied to the live project merely to repair repository history.
3. Complete a caller inventory for `is_active_cripri_school(uuid)` and `is_school_website_subscription_valid(uuid)`.
4. Review the public view's grants and owner/RLS behavior; test public profile reads before any security-mode change.
5. Complete browser tests for registration, login, profile updates, content publication, public rendering, and storage uploads.
6. Secure a verified, restorable full backup before any live migration.
7. Keep PR #5 unmerged and do not deploy until Cloudflare Worker coordination and live workflow smoke tests are complete.

## Explicit non-actions

- No SQL was executed that changed schema, data, functions, grants, triggers, or views.
- No migration was applied or removed.
- No pull request was merged.
- No deployment was performed.
- No paid service was used.
