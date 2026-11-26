# CRIPRI Platform — Backup Scope and Recovery Inventory

**Assessment date:** 2026-11-26  
**Supabase project:** CRIPRI Platform (`dudrolmymjwphwivrlko`)  
**Region:** `eu-west-1`  
**Database:** PostgreSQL 17.11  
**Purpose:** Read-only inventory to define a no-cost, complete recovery plan. This document is not a backup and contains no credentials or personal records.

## 1. Current verified inventory

Read-only checks against the live project returned:

| Area | Verified inventory |
|---|---:|
| Public base tables | 20 |
| Public views | 4 |
| Public table rows (total) | 49 |
| Auth schema tables | 27 |
| Auth users | 2 |
| Auth identities | 2 |
| Auth sessions | 1 |
| Auth refresh-token rows | 1 |
| Storage schema tables | 10 |
| Storage buckets | 1 |
| Storage objects | 9 |
| Realtime schema tables | 3 |
| Supabase migrations schema tables | 1 |
| Vault schema tables | 1 |
| Vault secret rows | 0 |
| Active deployed Edge Functions | 3 |

Public tables contain 49 rows in total at the time of the inventory. The count is not a data export. The Auth counts are aggregate counts only; no user emails, password hashes, tokens, or personal data were copied into this document.

The 20 public tables are:
- application_review_audit
- cripri_content_admins
- cripri_content_schools
- platform_notifications
- platform_payments
- platform_reviewers
- platform_settings
- school_admin_audit
- school_applications
- school_content
- school_content_audit
- school_content_item_audit
- school_content_items
- school_domain_onboarding
- school_domain_onboarding_audit
- school_memberships
- school_site_content
- school_subscriptions
- schools
- website_subscription_plans

Schema table counts reported by the database inventory: `auth=27`, `public=20`, `realtime=3`, `storage=10`, `supabase_migrations=1`, `vault=1`. These are table counts, not a claim that every Supabase-managed schema should be independently restored by hand.

## 2. Recovery scope — all components must be covered

A database-only dump is not a complete platform backup. The recovery package must account for each of these layers:

1. **Application database:** user-created schemas, tables, data, sequences, constraints, indexes, views, materialized views, functions, triggers, RLS policies, grants, and publication/configuration objects where applicable.
2. **Migration history and source:** all live migration versions and the exact corresponding SQL source files. The live project currently reports 21 migration records. Three live migration names were previously found without matching source files in the feature branch; these must be reconciled from trusted source before claiming a reproducible rebuild.
3. **Authentication:** Auth users and identities, relevant Auth configuration, templates, providers, hooks, and settings. A database dump alone may not reproduce dashboard-managed Auth configuration. Password hashes and token tables are sensitive and must never be committed to Git.
4. **Storage metadata and binary objects:** bucket configuration, object metadata, and the actual file bytes. A Postgres dump of Storage metadata does not back up the 9 stored object files.
5. **Edge Functions:** exact source for all 3 deployed functions, dependency/import-map files, deployment settings, and JWT verification settings. Function source is present in the repository according to the earlier source recovery; verify against live versions before any restore.
6. **Secrets and environment configuration:** function secrets, SMTP/Resend credentials, API keys, OAuth secrets, and other environment values. Record names and configuration dependencies only; do not place secret values in GitHub or this document.
7. **Platform configuration:** project region/runtime versions, enabled extensions, API exposure settings, Auth settings, custom domains, DNS, Cloudflare Worker routes/configuration, and external provider configuration.
8. **Verification evidence:** checksums, export timestamps, object counts, row counts, migration version list, restore logs, and a successful isolated restore test.

## 3. What is and is not currently backed up

- This assessment is a **metadata inventory only**.
- No database dump has been created or downloaded.
- No Auth export has been created.
- No Storage object bytes have been downloaded.
- No secrets have been exported.
- No restore test has been performed.
- GitHub source control is not a backup of live database data, Auth state, Storage files, or secrets.
- A CSV export of selected tables would not be a complete, transactionally consistent, restorable backup.

## 4. No-cost recovery route to investigate

The normal self-managed route is a client-side export using the Supabase CLI and database connection, followed by a separate export of Storage object bytes and a secure record of non-secret platform configuration. CLI v3 changed defaults: database commands target the local stack by default, and hosted operations require explicit remote targeting and confirmation. Do not copy old CLI commands into a runbook without checking the installed CLI version and its current `--help`.

For this project owner’s current Windows 8-only environment, a compatible, supported local CLI/Docker workflow has not been established. The connected Supabase tools expose project inspection, SQL, migrations, and Edge Function operations, but no database dump, Auth export, Storage binary export, or project-secret export action was available in the tool inventory at assessment time.

Do not:
- create a paid Supabase branch or project as a substitute for a backup;
- use the destructive project restore operation as a backup method;
- put database exports, Auth data, Storage files, service-role keys, or secrets in the public GitHub repository;
- run migrations or deploy changed functions before a recoverable backup exists.

## 5. Release gate

Live migrations, notification-function deployment, PR merge, and production deployment remain blocked until:
- a complete recovery package is obtained through a supported route;
- the package is stored outside the public repository with access restricted;
- export integrity is checked;
- the three unmatched live migration records are reconciled;
- a restore is tested in a safe environment without creating unexpected cost;
- the owner explicitly approves the specific production change.

## 6. Next safe action

Continue with a source-control and configuration completeness audit: compare all live migration versions, deployed Edge Function versions, extension inventory, and Cloudflare configuration against the feature branch. This remains read-only and does not require Windows software installation, paid services, or production changes.
