# Institution activation and legacy administrator workflow test plan

**Status:** Test plan prepared; live database inspected read-only; runtime integration tests not executed.
**Date:** 2026-11-26

## Safety boundary

Do not execute activation RPCs against production to test them. Do not create fake Auth users or applications in the live project. Run these cases only against a disposable restored database or isolated Supabase project with synthetic data.

## Live invariants verified

- `activate_institution()` requires `auth.uid()`, an existing Auth user, and a confirmed email.
- It only matches approved non-school applications whose contact email matches the confirmed Auth email.
- It requires exactly one matching application and one matching institution; ambiguous matches fail closed.
- It rejects suspended institutions and accounts already linked to a different institution.
- It creates or updates the caller's `institution_admin` membership and activates a pending institution.
- `activate_principal_school()` similarly requires a confirmed email, exactly one approved school application, a principal/headteacher/school-administrator contact role, and a matching school.
- It rejects suspended schools and accounts already linked to another school.
- The live `school_memberships` table has a unique index on `(school_id, user_id)`, which supports the membership upsert conflict target.
- The two legacy content-admin tables, `cripri_content_admins` and `cripri_content_schools`, have RLS enabled with no direct policies. Their ordinary-role access is fail-closed; management is performed through checked SECURITY DEFINER functions.

## Required activation test matrix

| Case | Expected result |
|---|---|
| Unauthenticated RPC call | Rejected |
| Authenticated user with unconfirmed email | Rejected |
| Confirmed email, no approved matching application | Rejected |
| Confirmed email, exactly one approved non-school application | Creates/updates institution-admin membership |
| Same confirmed email matches two approved non-school applications | Rejected as ambiguous; no membership changes |
| Matching institution is suspended | Rejected; remains suspended |
| User already belongs to a different institution | Rejected; existing membership unchanged |
| Retry activation for same institution and user | Idempotent membership upsert; no duplicate membership |
| School activation with contact role not matching approved role list | Rejected |
| School activation with two approved matching applications | Rejected as ambiguous |
| School activation for suspended school | Rejected |
| School activation retry for same school/user | Idempotent membership upsert |

## Required legacy content-admin tests

Use two synthetic schools, two administrators, and content belonging to each school.

1. Active administrator can save, edit, publish, withdraw, recover and restore content only for the assigned school.
2. Administrator A cannot read or mutate school B content by substituting B's school ID or content ID.
3. Inactive administrator is rejected.
4. Administrator assigned to an inactive school is rejected.
5. A user with a different role is rejected.
6. Photograph save/publish requires an HTTPS media URL and explicit consent.
7. Permanent deletion requires Recovery Bin status and explicit confirmation.
8. Every successful mutation writes an audit record with the correct school, content, actor and action.
9. Invalid actions and malformed payloads fail without partial content or audit changes.

## Transaction and rollback cases

- Force a failure after membership insertion but before institution activation; verify the whole RPC transaction rolls back.
- Force a failure during the legacy content audit insert; verify the content mutation also rolls back.
- Concurrently invoke activation twice for the same user/application; verify one membership row and consistent active status.
- Verify no test writes or notifications reach the production project.

## Exit criteria

The activation and legacy administrator workflows are considered verified only after all cases pass against an isolated database and the test evidence is attached to the release record. Static source review and this test plan do not count as integration-test completion.

## Result

No production RPCs were invoked and no production records were changed while preparing this plan.
