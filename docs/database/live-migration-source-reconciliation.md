# Live Supabase Migration History — Source Reconciliation

**Assessment date:** 2026-11-26  
**Project:** CRIPRI Platform (`dudrolmymjwphwivrlko`)  
**Repository:** `cripri-solutions/cripri-universal-school-website`  
**Branch inspected:** `feature/universal-institution-manager`  
**Method:** Read-only comparison of Supabase migration history and GitHub migration directory trees.

## Executive finding

The live Supabase migration ledger contains **21 applied records**. The feature branch contains **8 SQL files** in `supabase/migrations/`; the `main` branch contains **1 SQL file**. None of the eight feature-branch filenames has an exact version match with any of the 21 live migration ledger versions.

Therefore the repository does not currently provide a complete, version-aligned source history for the live database. This is a release and disaster-recovery blocker. It does not mean the live database is corrupt, nor does it prove the original SQL cannot be recovered from another trusted location.

## 1. Live migration ledger (21 records)

| Version | Recorded migration name |
|---|---|
| 20261118092908 | allow_active_platform_reviewers_to_view_all_schools |
| 20261118150208 | add_domain_quotation_tracking |
| 20261119065553 | school_website_content_and_media |
| 20261119065603 | school_website_manager_access_grants |
| 20261119123610 | add_school_public_profile_fields |
| 20261122063221 | create_super_admin_payment_register |
| 20261122081508 | grant_platform_payment_register_access |
| 20261122112030 | enforce_confirmed_subscription_payment_before_activation |
| 20261122112330 | require_full_plan_amount_for_selected_activation_payment |
| 20261122113531 | add_authorized_30_day_demo_trial_activation |
| 20261122114504 | add_verified_subscription_renewal |
| 20261122114519 | prevent_demo_trial_from_being_renewed_as_paid_subscription |
| 20261122115015 | restrict_free_demo_trial_to_telwa_girls |
| 20261123051503 | enforce_public_school_website_subscription_access |
| 20261123080237 | school_approval_notifications |
| 20261123090236 | school_admin_management_audit |
| 20261123134619 | grant_school_profile_column_updates |
| 20261125145704 | extend_institution_types_for_universal_registration |
| 20261126081455 | align_institution_notifications_and_secure_subscription_rpc |
| 20261126081643 | revoke_direct_execution_of_subscription_trigger_functions |
| 20261126081812 | add_public_institution_profile_view |

## 2. SQL files currently in feature branch

| File | Status relative to live ledger |
|---|---|
| 202611040001_initial_schema.sql | No exact version match; historical baseline needs provenance review |
| 202611250002_universal_manager_write_permissions.sql | No exact version match; proposed feature migration |
| 202611250003_institution_application_fields.sql | No exact version match; proposed feature migration |
| 202611250004_validate_institution_application_types.sql | No exact version match; proposed feature migration |
| 202611250005_other_institution_type.sql | No exact version match; proposed feature migration |
| 202611250006_institution_category_levels.sql | No exact version match; proposed feature migration |
| 202611260001_preserve_institution_application_details.sql | No exact version match; proposed feature migration |
| 20261126120000_notification_email_send_claim.sql | No exact version match; proposed notification migration |

The feature branch tree contained exactly these eight SQL files. The main branch tree contained only `202611040001_initial_schema.sql`.

## 3. Interpretation and risks

- The 21 live ledger rows are the database's record of applied migration identifiers and names.
- GitHub's current migration directory is not a complete source archive for those applied migrations.
- Similar names or similar object effects do not establish that a SQL file is the original migration.
- Reconstructing SQL from current database definitions may produce a useful schema snapshot, but it is not the original historical migration and cannot safely be inserted into migration history as though it were.
- The seven feature migrations dated 2026-11-25/26 are proposed branch work; do not assume they are already applied to production.
- The notification claim migration must remain unapplied until its rollout prerequisites are met.
- Do not delete, rename, fake, repair, or replay migration ledger records to make the counts match.

## 4. Safe reconciliation plan

1. Preserve the live migration ledger exactly as it is.
2. Search trusted source locations: repository commit history, older branches/tags, original developer workstations or secure archives, and Supabase migration artifacts available to the project owner.
3. Recover each original SQL file only when its contents and version can be verified against trusted source evidence.
4. For any unrecoverable migration, document it as missing. If a current-state schema snapshot is later created, label it explicitly as a snapshot—not as the original migration.
5. Keep proposed feature migrations separate from historical applied migrations.
6. Validate the final source set against a fresh read-only export of the live schema before considering any release.
7. Obtain a full restorable backup and test restoration before applying any production migration.

## 5. Explicit non-actions

This audit did not:
- apply or roll back a database migration;
- edit the Supabase migration ledger;
- alter database schema, data, grants, policies, functions, or triggers;
- merge PR #5 or deploy the website, Worker, or Edge Functions;
- export personal data, credentials, secrets, or Storage file contents.

## 6. Release gate

**Status: BLOCKED pending source reconciliation and a verified full restorable backup.**

The next safe step is to search GitHub's accessible commit and branch history for the exact original migration SQL, beginning with the 21 live version identifiers and recorded names. Do not synthesize historical SQL or mark migrations as applied merely to make repository history appear complete.
