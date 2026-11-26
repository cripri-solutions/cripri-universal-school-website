# Live database schema snapshot (read-only)

**Captured:** 2026-11-26 11:20 UTC  
**Supabase project:** `dudrolmymjwphwivrlko` (CRIPRI Platform)  
**Purpose:** Record a sanitized, read-only schema inventory to support reconciliation of live database state with the feature-branch migrations.

## Scope and safety

- Queried PostgreSQL catalog and `information_schema` metadata only.
- No application rows, authentication records, storage object metadata, secret values, or function bodies were exported.
- No DDL, grants, policy changes, migration execution, deployment, or data modification was performed.
- This document is a schema audit note, **not a database backup or a restorable dump**.
- Full raw catalog output was not committed; it includes Supabase-managed schemas and security-sensitive metadata that should not be placed in the public repository.

## Public schema inventory

| Object | Count |
|---|---:|
| Base tables | 20 |
| Views | 4 |
| RLS policies | 42 |
| Non-internal triggers | 7 |
| Functions / procedures | 25 |

## Registration schema findings

### `public.school_applications`

Present columns include:
`id`, `school_name`, `contact_person`, `contact_email`, `contact_phone`, `requested_slug`, `message`, `status`, `reviewed_at`, `created_at`, `school_category`, `country`, `region`, `physical_address`, `contact_role`, `reviewed_by`, `review_reason`, `institution_type`.

Not present:
- `other_institution_type`

The live `institution_type` CHECK constraint currently allows:
`school`, `college`, `university`, `tvet`, `training_centre`, `church`, `mosque`, `union`, `association`, `ngo`, `cooperative`, `company`, `government`, `other`.

**Important:** `hospital` is not currently in the live allowlist. The live schema also has no `other_institution_type` field or conditional constraint.

### `public.schools`

Present columns include:
`id`, `name`, `slug`, `motto`, `status`, `created_at`, `updated_at`, `description`, `welcome_message`, `physical_address`, `county`, `country`, `contact_phone`, `contact_email`, `logo_path`, `banner_path`, `institution_type`.

Not present:
- `school_category`
- `other_institution_type`
- `region`
- `contact_person`
- `contact_role`

The live `institution_type` CHECK constraint has the same allowlist as `school_applications` and does not include `hospital`.

## Existing view surface

The four public views are:
- `institution_content_items`
- `institution_memberships`
- `institutions`
- `public_institution_profiles`

The live `institutions` view currently exposes institution identity and profile fields from `schools`, but does not include the proposed category, region, contact-person, contact-role, or other-institution-type fields.

The `public_institution_profiles` view filters to active schools and exposes a limited public profile projection. Its security mode and ACL remain subject to the separate security review; this snapshot did not change them.

## Relevant existing RLS policy names

- `school_applications`: public insert; platform-owner select and update.
- `schools`: public active-school select; active school-member select; active platform-reviewer select; school-admin update.
- `school_content_items`: public published-content select; member select; content-editor draft insert/update; school-admin insert/update.

Policy expressions and function bodies were deliberately excluded from this public report. The full policy and function security review remains a separate task.

## Reconciliation and release impact

This live snapshot confirms that the universal-institution schema changes in the feature branch are **not yet present in production**. In particular:
1. `hospital` is rejected by the current live institution-type constraints.
2. The live application table lacks `other_institution_type`.
3. The live schools table lacks the new institution category and contact-detail columns.
4. The live `institutions` view has not yet been extended with those fields.

These findings are consistent with the earlier migration-source reconciliation: the feature branch contains proposed changes, but its migration filenames do not match the recorded live migration ledger. Do not attempt to apply, replay, or fabricate historical migrations to resolve that discrepancy.

## Safe next step

Continue with source reconciliation and a reviewed migration plan. Before any production DDL or Edge Function deployment, obtain and verify a complete restorable backup (including database, Auth configuration/data, Storage object bytes, Edge Function source/configuration, and required secrets/configuration), then obtain explicit approval for the exact production change. No production change is authorized by this audit.
