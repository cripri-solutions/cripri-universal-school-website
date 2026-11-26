# Notification idempotency rollout and release gate

**Status:** Prepared rollout plan only. Not applied to the live database or Edge Function.  
**Date:** 2026-11-26  
**Branch:** `feature/universal-institution-manager`

## Verified live preflight

The live `public.platform_notifications` table currently has:

- Constraint `platform_notifications_email_status_check`, allowing `pending`, `sent`, `failed`, and `skipped`.
- No `email_claimed_at` column yet.
- 2 pending notifications, 1 sent notification, and 0 sending notifications.
- Existing RLS policies restrict authenticated notification reads/updates to active platform reviewers.
- `authenticated` has UPDATE and SELECT on the table; `anon` has no data read/write grant.
- No notification rows need conversion to the new `sending` state.

The proposed migration adds nullable `email_claimed_at` and extends the existing status check to include `sending`. It does not modify notification rows or send email.

## Files prepared on the feature branch

- `supabase/migrations/20261126120000_notification_email_send_claim.sql`
- `supabase/functions/send-school-notification/index.ts`
- `supabase/functions/send-school-notification/notification-idempotency.js`
- `supabase/functions/send-school-notification/notification-idempotency.test.mjs`
- Updated `super-admin-preview.html` to show the in-progress state.
- Updated GitHub Actions to run the idempotency tests.

## Required release order

### Gate 0 — backup and approval

- Obtain and verify a full restorable database backup, including schema, data, and required roles.
- Confirm the backup restore procedure and recovery point.
- Obtain explicit approval for the live database migration and the subsequent Edge Function deployment.
- Until then, do not execute the migration or deploy the function.

### Gate 1 — migration preflight

Before applying the migration, verify:

1. The live constraint still has the expected name and definition.
2. `email_claimed_at` does not already exist, or if it does, confirm its type and intended semantics.
3. There are no unknown `email_status` values.
4. Notification RLS and authenticated reviewer UPDATE privileges remain as audited.
5. No notification is currently in an active send attempt.

Apply only the single migration after the backup gate is satisfied.

### Gate 2 — post-migration verification

Read-only checks must confirm:

- `email_claimed_at` exists as nullable `timestamptz`.
- The status check allows exactly `pending`, `sending`, `sent`, `failed`, and `skipped`.
- Existing notification counts and recipient details are unchanged.
- RLS policies and grants are unchanged.
- No notification row was sent or otherwise modified by the migration.

If any check fails, stop. Do not deploy the Edge Function.

### Gate 3 — Edge Function deployment

Only after Gate 2 succeeds:

- Deploy `send-school-notification` from the reviewed repository source, including the helper module.
- Preserve JWT verification.
- Confirm required secrets exist without printing their values: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`.
- Confirm the deployed function version increments and the other two Edge Functions remain unchanged.

### Gate 4 — controlled smoke test

- Use a designated test notification and a controlled test recipient authorized for this purpose.
- Verify one send succeeds and the row becomes `sent`, with provider message ID and `sent_at`.
- Invoke the same notification again; verify the handler reports already sent and does not send a second email.
- Exercise two concurrent requests against a separate test notification; exactly one request should claim it.
- Test an invalid JWT and a non-reviewer; both must be denied and must not change a notification row.
- Do not use real applicant recipients for initial testing.

### Gate 5 — release closeout

- Verify Super Admin displays `Send in progress` while a notification is claimed.
- Verify failed sends remain retryable and stale claims can be recovered only with a matching claim timestamp.
- Record deployed function version, migration version, test results, and rollback steps.
- Only then mark this feature ready for production use.

## Rollback considerations

- If the migration is applied but the Edge Function is not deployed, the old function should continue to use existing statuses. The additional nullable column and allowed status are backward-compatible.
- If the new function fails after deployment, redeploy the previously captured live function source (version 4 source restored to the repository before modification). Do not remove the new column or status constraint while a row may be in `sending`.
- If Resend accepts an email but the database finalization fails, do not blindly reset the row and resend. Check Resend delivery using the stable idempotency key/provider record first.
- A rollback of the schema must be a separately reviewed migration after confirming no `sending` rows remain and all application code has been reverted.

## Current state

- GitHub Actions passed for the code and unit tests.
- No live migration has been applied.
- No Edge Function has been redeployed.
- No emails have been sent by this change.
- PR #5 remains open and unmerged.
- No costs have been incurred.
