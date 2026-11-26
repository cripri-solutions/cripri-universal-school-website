# Registration and approval migration safety review

**Review date:** 2026-11-26  
**Branch:** `feature/universal-institution-manager`  
**Scope:** Static review of the registration, institution-field, approval, notification, and facilities migrations. Live database was inspected read-only.  
**Execution status:** No SQL was applied to Supabase. No production configuration was changed.

## Executive result

The feature branch contains the expected migration sequence for universal institution registration, but it is **not approved for production execution**. The live database migration ledger and repository migration sources are not reconciled, a complete restorable backup has not been secured, and the migrations do not include verified down-migrations.

The branch migration files reviewed were:

- `202611250002_universal_manager_write_permissions.sql`
- `202611250003_institution_application_fields.sql`
- `202611250004_validate_institution_application_types.sql`
- `202611250005_other_institution_type.sql`
- `202611250006_institution_category_levels.sql`
- `202611260001_preserve_institution_application_details.sql`
- `20261126120000_notification_email_send_claim.sql`
- `20261126130000_exact_review_notification_institution.sql`
- `20261126150000_institution_facilities_services_content_type.sql`

The initial schema file was not treated as a safe replay candidate.

## Findings

### 1. Registration columns and privileges

The registration form submits `institution_type`, `other_institution_type`, `school_category`, `country`, `region`, `contact_role`, and `physical_address`, in addition to the original applicant fields.

The live schema inspection found that the `school_applications` table already contains several of the institution detail fields, but does not contain `other_institution_type`. The live column-level INSERT grants do not include `institution_type`. This is consistent with the previously observed incompatibility between the form payload and live database permissions.

Migrations `202611250003` and `202611250005` add/grant the missing fields. The first migration is idempotent for columns, but its grants must still be verified after any eventual application. Existing table-level INSERT being false is not by itself a failure: the policy and column-level grants must be assessed together.

### 2. Institution type and category constraints

The form offers `hospital`, while the live `schools` and `school_applications` constraints were found not to allow that value.

Migrations `202611250004` and `202611250005` replace the application institution-type allowlist, and `202611260001` updates the institution table allowlist. Migration `202611250006` makes category/level independent of institution type and permits NULL where it is not applicable.

Before execution, the actual live constraint names and definitions must be re-read immediately before migration. A conditional add in `202611250004` intentionally leaves an existing same-named constraint untouched; the subsequent `202611250005` replacement is therefore material to the final result.

### 3. Other institution validation

Migration `202611250005` adds `other_institution_type`, grants INSERT on it, and requires a trimmed 2–120 character description when `institution_type = 'other'`. It requires NULL for every other institution type.

Migration `202611260001` adds the corresponding institution column and check constraint. This is coherent with the current form payload, but existing production rows must be checked for compatibility immediately before execution. The current inventory showed three institution rows, all with type `school`; that count is only a point-in-time observation.

### 4. Approval data preservation

Migration `202611260001` adds the missing profile columns to `schools`, extends the `institutions` security-invoker view by appending columns, and replaces `review_school_application`.

The replacement function retains reviewer authorization and pending-only row locking, creates approved institutions in pending status, and copies institution type, category, Other description, region, contact person, contact role, address, country, phone, and email.

The function change is a critical production behavior change. It must be reviewed against the exact current live function definition and the live audit table schema before it is considered executable.

### 5. Approval audit and notification ordering

Migration `20261126130000` changes the notification trigger to look up the institution through `application_review_audit`. The approval function inserts the audit association before updating the application status, so the synchronous AFTER UPDATE trigger can read the exact association.

This pair must be treated as one release unit. Applying the trigger change without the corresponding approval function ordering, or vice versa, risks missing or incorrectly associated notifications. Confirm the audit table's nullability, uniqueness constraints, and trigger definition before release.

### 6. Email send-claim migration

Migration `20261126120000` adds `email_claimed_at` and extends the email status constraint with `sending`. This supports the proposed notification idempotency flow, but the database migration alone does not prove the deployed Edge Function uses the matching claim/release logic. The deployed function source and migration must be version-paired and tested together.

### 7. Facilities/services content type

Migration `20261126150000` replaces the content-type check to include `facility_service`. This is separate from registration approval and should be released independently after confirming the live constraint name and all existing content values. It is not required to fix the registration submission or approval data-loss issue.

## Release blockers

1. **No complete, verified restorable backup exists.** The inventory is metadata, not a database, Auth, Storage, and Edge Function backup.
2. **Live migration history is not reconciled to the branch source files.** The repository does not contain exact source for all historical live migration versions. Do not fabricate historical SQL or replay/synthesize ledger entries.
3. **No verified rollback package exists.** Several migrations replace constraints, a view, a trigger function, or a SECURITY DEFINER approval function. A generic `DROP COLUMN` rollback would risk data loss and is not acceptable.
4. **Live preconditions must be rechecked immediately before any future migration.** This includes column definitions, constraint names/definitions, grants, RLS policies, trigger dependencies, audit table constraints, and deployed Edge Function versions.
5. **End-to-end tests remain outstanding.** Registration submission, reviewer approval/rejection, notification association, institution activation, and account onboarding must be tested with dedicated non-sensitive test data.

## Safe future execution order (proposed, not authorization)

1. Reconcile the historical migration ledger and source files without altering the ledger.
2. Obtain and verify a complete no-cost backup/recovery route before production DDL.
3. Re-run read-only preflight queries against the exact target project.
4. Apply registration columns/grants and type/category constraints as a reviewed unit.
5. Apply institution profile columns/view and approval-function change.
6. Apply the matching audit/notification trigger change in the same controlled release.
7. Apply email send-claim migration only with the matching Edge Function release.
8. Apply facilities/services content-type change separately.
9. Verify schema, grants, RLS, triggers, audit records, and all user workflows using dedicated test accounts.
10. Record evidence and recovery steps before considering production release complete.

## Rollback and recovery policy

There is no automatic rollback approval in this review. Do not drop newly added columns if they contain data. Do not restore an older approval function or trigger from memory. Before any production change, capture exact pre-change definitions and prepare reviewed inverse SQL or a tested restore procedure. If a migration partially applies, stop and inspect the actual transaction outcome rather than blindly rerunning or reversing it.

## Final decision

**Status: HOLD — safe for continued branch review only.**

This review is documentation and static analysis, not a migration execution approval. Production database, PR merge, Worker routes, and production deployment remain untouched.
