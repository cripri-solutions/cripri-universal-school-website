# CRIPRI live database recovery inventory

**Audit date:** 2026-11-26  
**Supabase project:** CRIPRI Platform (`dudrolmymjwphwivrlko`)  
**Database:** PostgreSQL 17.11  
**Region:** eu-west-1  
**Method:** Read-only Supabase metadata/catalog inventory

## Safety and scope

This is a recovery inventory, not a backup or a restorable export. It contains metadata and object counts only. No personal records, credentials, password hashes, tokens, secret values, or storage object bytes are included.

No live schema, data, policy, grant, migration ledger, function, trigger, or Edge Function was changed. No migration was applied. No production deployment was performed.

## Live project status

- Project status at audit: `ACTIVE_HEALTHY`.
- Database engine: PostgreSQL 17.11.
- Live migration ledger: 21 records.
- Public base tables: 20.
- Public views: 4 (previous read-only inventory; confirm again during export).
- Public table rows: 49.
- Auth users: 2.
- Auth identities: 2.
- Auth sessions: 1.
- Auth refresh-token rows: 1.
- Storage buckets: 1.
- Storage objects: 9.
- Active Edge Functions: 3.

Counts are point-in-time observations and can change as the application is used.

## Public tables and row counts

| Table | Rows |
|---|---:|
| school_applications | 3 |
| schools | 3 |
| school_memberships | 1 |
| school_content | 0 |
| platform_reviewers | 1 |
| application_review_audit | 3 |
| school_domain_onboarding | 1 |
| school_domain_onboarding_audit | 14 |
| school_content_items | 10 |
| website_subscription_plans | 3 |
| school_subscriptions | 1 |
| platform_payments | 0 |
| platform_notifications | 3 |
| platform_settings | 2 |
| school_admin_audit | 0 |
| cripri_content_schools | 0 |
| cripri_content_admins | 0 |
| school_site_content | 0 |
| school_content_audit | 0 |
| school_content_item_audit | 4 |

All 20 listed public base tables have RLS enabled.

## Storage inventory

- Buckets: 1.
- Objects: 9.
- Storage metadata tables are managed by Supabase.
- A public bucket means objects can be retrieved by public URL. This inventory does not contain object bytes.
- A complete recovery package must separately export the actual object bytes and preserve object paths, MIME types, cache settings, bucket privacy, size limits and policies.

## Edge Functions

| Function | Active version | JWT verification |
|---|---:|---|
| school-admin-management | 2 | enabled |
| send-school-notification | 4 | enabled |
| super-admin-administrators | 3 | enabled |

A restorable package must include the exact deployed source for each function, configuration, dependency/import map and deployment settings. Secret values must be handled separately in a secure owner-controlled store and must never be committed to Git.

## Installed extensions observed

| Extension | Version | Schema |
|---|---|---|
| pgcrypto | 1.3 | extensions |
| plpgsql | 1.0 | pg_catalog |
| pg_stat_statements | 1.11 | extensions |
| uuid-ossp | 1.1 | extensions |
| supabase_vault | 0.3.1 | vault |

This is the installed-extension subset returned by the project metadata tool, not a complete extension configuration dump.

## Migration history

The live migration ledger contains 21 records. The repository source reconciliation report records that the current GitHub migration directory does not contain version-aligned original SQL for the full live ledger, including three specifically missing source files.

- Do not delete or rewrite live ledger rows.
- Do not invent original migration SQL.
- Do not mark reconstructed SQL as historical source.
- Keep proposed feature migrations unapplied until source reconciliation and a verified recovery path exist.

See [live migration source reconciliation](./live-migration-source-reconciliation.md) and [migration history reconciliation](./migration-history-reconciliation.md).

## Recovery scope still missing

This inventory is not a complete backup. A complete recoverable package must include and verify:

1. Full database schema and data, including sequences, constraints, indexes, functions, triggers, views, grants and RLS policies.
2. Migration source files and the exact live migration ledger, reconciled without fabricating history.
3. Auth configuration and recoverable user/account information through supported secure export procedures. Never store password hashes or tokens in this repository.
4. Storage bucket metadata, policies and all 9 actual object bytes.
5. Exact deployed Edge Function source and non-secret configuration.
6. Secret names and rotation/recovery procedures; secret values kept in a secure owner-controlled location, never in Git.
7. DNS, Cloudflare Worker/routes and hosting configuration needed to restore public access.
8. A documented restore procedure and a successful restore test in a safe, isolated environment.

## Constraints and next safe action

The current operator environment is Windows 8, without PostgreSQL command-line tools. No additional computer or paid service is assumed. The available connected Supabase tools expose project metadata and SQL execution, but they have not produced a complete portable database dump or a verified restore.

The next safe action is to preserve and reconcile source/configuration artifacts that can be recovered without exporting sensitive data, then determine whether the project dashboard provides a supported full backup download under the current plan. CSV/table exports are not a substitute for a full database backup.

**Release status: BLOCKED.** Do not apply production migrations, merge the release PR, or deploy until the migration history and a verified restorable backup are resolved.


## Additional PostgreSQL catalog inventory

A second read-only catalog pass recorded these object totals:

| Object | Count |
|---|---:|
| Public functions/procedures | 25 |
| Public SECURITY DEFINER functions | 22 |
| Public views | 4 |
| Public RLS policies | 42 |
| Public non-internal triggers | 7 |
| Public constraints | 128 |
| Public foreign-key constraints | 38 |
| Public indexes | 43 |

The 7 public triggers observed were:

| Trigger | Table | Function |
|---|---|---|
| school_content_items_set_audit | school_content_items | set_school_content_item_audit |
| school_content_set_updated_at | school_content | set_updated_at |
| schools_set_updated_at | schools | set_updated_at |
| trg_enforce_school_subscription_payment | school_subscriptions | enforce_school_subscription_payment |
| trg_school_domain_onboarding_audit | school_domain_onboarding | audit_school_domain_onboarding_change |
| trg_school_domain_onboarding_updated_at | school_domain_onboarding | set_school_domain_onboarding_updated_at |
| trg_school_review_notification | school_applications | create_school_review_notification |

These counts are catalog observations, not exported object definitions. A complete recovery export still needs the full SQL definitions, dependencies, ownership and grants.

## Security advisory snapshot

The Supabase security advisor returned these items during this audit:

- **ERROR:** `public.public_institution_profiles` is reported as a security-definer view. This needs a deliberate view-owner/RLS review; do not change it blindly because public institution pages depend on it.
- **WARN:** two SECURITY DEFINER helpers are executable by anon: `is_active_cripri_school(uuid)` and `is_school_website_subscription_valid(uuid)`. Existing public website behavior depends on the latter; do not revoke without a tested replacement.
- **WARN:** 19 SECURITY DEFINER functions are executable by authenticated users. Review each function's authorization logic and call sites individually; do not apply blanket revocations.
- **WARN:** leaked-password protection is disabled in Auth. This is a configuration hardening item, not a recovery-export result.
- **INFO:** `cripri_content_admins` and `cripri_content_schools` have RLS enabled but no policies. This appears fail-closed for ordinary API roles; do not add policies without confirming intended access paths.

No security advisor remediation was applied in this inventory pass. See the linked Supabase remediation guidance in the project advisor for each finding.
