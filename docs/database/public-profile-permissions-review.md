# Public institution profile permissions review

**Status:** Read-only audit finding and proposed change only.  
**Target:** `public.public_institution_profiles`  
**Live database changes:** None.  
**Migration status:** No executable migration is included in this document.

## Verified live definition

The view is owned by `postgres`, has `security_barrier=true`, and selects only these columns from `public.schools` where `status = 'active'`:

- `id`, `name`, `slug`, `institution_type`, `status`
- `motto`, `description`, `welcome_message`
- `county`, `country`, `logo_path`, `banner_path`

The live ACL is:

```
{postgres=arwdDxtm/postgres,anon=rDxtm/postgres,authenticated=rDxtm/postgres,service_role=Dxtm/postgres}
```

In PostgreSQL 17 this includes privileges beyond the intended public read access for `anon` and `authenticated`. The view is not marked `security_invoker=true`; it is therefore important not to alter its owner or view security mode as part of this narrow permissions proposal.

## Follow-up live verification — 26 November 2026

A second read-only check reconfirmed the view definition and effective privileges:

- Owner remains `postgres`; option remains `security_barrier=true`.
- The view still returns only the 12 listed public-profile fields for rows where `schools.status = 'active'`.
- `anon` and `authenticated` both have effective `SELECT`.
- Neither role has effective `INSERT`, `UPDATE`, or `DELETE` on this view.
- The catalog ACL / information-schema grants still list unnecessary `REFERENCES`, `TRIGGER`, and `TRUNCATE` privileges for both roles.

This distinction matters: the extra catalog grants are a least-privilege cleanup finding, not evidence that anonymous users can currently modify institution profile rows. No permission was changed during this check. The cleanup remains deferred until a restorable backup and a safe read-path test are available.

## Dependency and safety findings

- Public institution pages need to read active institution profiles. Preserve `SELECT` for `anon` and `authenticated`.
- The view exposes a limited public-profile projection and filters to active institutions.
- The current ACL grants `anon` and `authenticated` more than `SELECT`. Those extra privileges are unnecessary for reading the public profiles and should be removed after a controlled test.
- This proposal deliberately does not change the view definition, owner, security-barrier option, underlying `schools` policies, or any function privileges.
- The separate `public.institutions` view is not the target of this proposal.

## Proposed narrow SQL (not yet approved or applied)

Run only after a restorable backup exists, the change is approved, and the public profile read path has been tested in a safe environment:

```sql
BEGIN;

REVOKE ALL PRIVILEGES
ON TABLE public.public_institution_profiles
FROM anon, authenticated;

GRANT SELECT
ON TABLE public.public_institution_profiles
TO anon, authenticated;

-- Verify the intended access before committing.
SELECT
  has_table_privilege('anon', 'public.public_institution_profiles', 'SELECT') AS anon_can_select,
  has_table_privilege('authenticated', 'public.public_institution_profiles', 'SELECT') AS authenticated_can_select,
  has_table_privilege('anon', 'public.public_institution_profiles', 'INSERT') AS anon_can_insert,
  has_table_privilege('anon', 'public.public_institution_profiles', 'UPDATE') AS anon_can_update,
  has_table_privilege('anon', 'public.public_institution_profiles', 'DELETE') AS anon_can_delete,
  has_table_privilege('authenticated', 'public.public_institution_profiles', 'INSERT') AS authenticated_can_insert,
  has_table_privilege('authenticated', 'public.public_institution_profiles', 'UPDATE') AS authenticated_can_update,
  has_table_privilege('authenticated', 'public.public_institution_profiles', 'DELETE') AS authenticated_can_delete;

-- Expected: both SELECT values true; all six write values false.
-- COMMIT only after verifying the expected result and testing public reads.
-- Otherwise ROLLBACK.
ROLLBACK;
```

The final `ROLLBACK` is intentional in this review document: the SQL is a rehearsal template, not a live change. A future migration must replace it with a separately reviewed transactional migration and include a tested rollback plan.

## Required pre/post checks

1. Confirm a full, restorable backup exists and its restore path is understood.
2. Confirm the public website can read active profile rows anonymously before and after the permission change.
3. Confirm authenticated profile reads continue to work.
4. Confirm anon/authenticated cannot insert, update, or delete through this view.
5. Confirm service-role and owner privileges remain unchanged.
6. Re-run the Supabase security advisor and inspect the view's ACL after the change.

## Related function dependency finding

The database function `public.is_active_cripri_school_admin(uuid)` calls `public.is_active_cripri_school(uuid)`. Therefore the latter is not unused, despite no direct call being found in the eight inspected frontend files. Do not revoke its anonymous execution until all database, external, and application dependencies have been checked.

The website's `school.html` calls `public.is_school_website_subscription_valid(uuid)`; preserve its public execution unless the public website is redesigned and tested without it.
