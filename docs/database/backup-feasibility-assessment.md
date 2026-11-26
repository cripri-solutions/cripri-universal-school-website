# CRIPRI database backup feasibility assessment

**Assessment date:** 2026-11-26  
**Project:** `CRIPRI Platform` (`dudrolmymjwphwivrlko`)  
**Organization plan:** Supabase Free  
**Repository:** `cripri-solutions/cripri-universal-school-website` — public  
**Assessment type:** Read-only; no backup/export or configuration changes performed.

## Executive conclusion

A complete, independently restorable backup has **not** been created or verified. The connected Supabase tools available for this project provide SQL reads, schema/migration inspection, project management, and Edge Function operations, but no database export/dump or backup-download action.

Supabase's current documentation states that Free projects do not receive downloadable automatic database backups. The documented manual logical export uses the Supabase CLI and Docker. The CLI dump excludes Supabase-managed schemas such as `auth`, `storage`, and extension-created schemas by default; schema, data, and custom roles require separate dump operations. Storage object files are not included in a database dump.

The user's current workstation is Windows 8, and the user has no PostgreSQL tooling installed and has explicitly ruled out paid services or another computer. Therefore this assessment does not direct the user to install a current Docker Desktop/CLI stack on that machine.

## Verified project facts

- Supabase organization tier: `tier_free`.
- Project status: `ACTIVE_HEALTHY`.
- PostgreSQL version: `17.11.0.011`.
- Current database inventory counts (counts only; no user data exported):
  - `public` base tables: 20
  - `auth.users`: 2
  - `storage.buckets`: 1
  - `storage.objects`: 9
- The connected tool inventory has no backup export, dump, or backup download operation. A project restore action exists, but it is destructive and is not a backup mechanism; it was not called.
- GitHub repository visibility is **public**. It must never receive database dumps, credentials, access tokens, applicant/user records, or Storage files. No backup workflow should upload plaintext backup artifacts to this repository or its Actions artifacts.
- Existing GitHub workflow directory contains only the validation workflow. No backup workflow is configured.

## What does not qualify as a full backup

The following are not sufficient as the release backup gate:

- A list of migrations or schema definitions alone.
- SQL query results or CSV exports of selected public tables.
- A database dump that omits application data or custom roles.
- A database dump that omits Auth and Storage configuration/data.
- Storage metadata without the actual Storage object files.
- A GitHub commit, public repository artifact, or source-code snapshot.
- A statement that a backup exists without verifying the file, completeness, secure storage, and restore path.

## Safe options

### Option A — documented manual export (official path, but not currently executable here)

Supabase documents the following logical exports using its CLI and Docker:

1. Custom roles.
2. Database schema.
3. Database data.
4. Separate handling for Auth and Storage configuration/data as required.
5. Separate download/retention of actual Storage object files.
6. A restore rehearsal into an isolated target, followed by application/auth/storage verification.

This is the strongest self-managed route, but it requires a supported machine/runtime, database connection credentials, secure storage for the outputs, and a restore rehearsal. It is not currently available on the user's Windows 8-only setup.

### Option B — dashboard exports (partial safety copy only)

The Supabase dashboard may allow selected table data to be exported. This can help preserve a few critical records, but it does not create a complete restorable backup of schema, policies, functions, Auth, Storage files, roles, or project configuration. It must not be used to approve live migrations.

### Option C — GitHub Actions

A GitHub-hosted workflow could run the Supabase CLI without requiring a local installation, but this repository is public. Backups and artifacts must not be placed in this public repository or exposed to public workflow artifacts. A secure private destination, encryption/key handling, secrets setup, retention policy, and restore validation would be required. No such destination is currently configured or verified. Do not add a workflow that writes dumps to this repository.

## Release decision

**Backup gate remains BLOCKED.**

Until a full restorable backup is safely produced and independently verified:

- Do not apply pending live database migrations.
- Do not deploy the modified `send-school-notification` Edge Function.
- Do not merge PR #5 or publish the Cloudflare Worker changes.
- Keep the existing live notification function and database schema unchanged.

## Next safe step

The only immediate action within the current constraints is to continue read-only verification and prepare a concise inventory of critical records, Storage objects, Auth configuration, database objects, and project settings that a proper backup must preserve. A secure export destination and supported export runtime must be established before claiming backup completion.

## Official references

- Supabase Free-plan backups: https://supabase.com/kb/faqs/platform/free-plan-backups
- Database backups: https://supabase.com/docs/guides/platform/backups
- CLI database dump: https://supabase.com/docs/reference/cli/supabase-db-dump
- Backup and restore with CLI: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- Automated backups with GitHub Actions: https://supabase.com/docs/guides/deployment/ci/backups

**No backup was created. No database data was exported. No project settings, live functions, or database objects were changed. No cost was incurred.**

## 2026-11-26 follow-up verification

A fresh read-only check reconfirmed the organization plan as `free` / `tier_free`, the project as `ACTIVE_HEALTHY`, and the live migration ledger at 21 records. The Supabase Database Backups documentation states that automatic daily backups are provided for Pro, Team, and Enterprise projects; Free projects are directed to export data with the Supabase CLI. It also explicitly states that Storage API object bytes are not included in database backups.

The documentation describes a Management API endpoint for listing available backups, but the connected project tools do not expose that endpoint or a downloadable-backup operation. The available `restore_project` action is destructive restoration, not export, and remains unused. No paid add-on, project/branch creation, CLI installation, or other cost-bearing action was taken.

**Updated decision:** the current constraints still do not provide a verified no-cost, Windows 8-compatible route to a complete restorable package. The next actionable requirement is an owner-controlled, secure export runtime and destination that can handle database schema/data/roles, Auth, Storage object bytes, and restore verification. Until that exists, the backup gate remains blocked.
