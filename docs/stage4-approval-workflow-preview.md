# Stage 4 — Application review workflow (implementation preview)

This stage adds a controlled reviewer workflow to the dedicated **CRIPRI Platform** Supabase project.

## What it provides

- An authenticated CRIPRI reviewer can list pending applications.
- Only an active user in `platform_reviewers` can read the pending list or make a decision.
- Approval requires an existing Supabase Auth user for the school's first administrator.
- Approval creates the school, assigns its first `school_admin` membership, creates an unpublished content row, updates the application, and records an audit event in one database transaction.
- Rejection updates the application and records the decision without creating a school.
- A duplicate requested slug causes approval to fail safely; it does not silently rename the school.

## Not yet live

This migration is committed as a development-branch preview only. It has **not** been run in Supabase. The application UI is not yet connected to these RPC functions. No reviewer has been provisioned, and no school administrator invitation has been sent.

## Safe setup sequence (after review and explicit approval)

1. Review the migration and test it in a separate test project first.
2. Create/invite the intended CRIPRI reviewer through Supabase Auth.
3. As project owner, insert that reviewer's Auth UUID into `public.platform_reviewers` with `active = true`.
4. For an application, invite/create the intended first school administrator in Supabase Auth and obtain that user's Auth UUID.
5. The reviewer calls `list_pending_school_applications()`, then `review_school_application(application_id, 'approved', reason, initial_admin_user_id)` or the rejection equivalent.
6. Connect a reviewer dashboard and school admin login UI; test tenant isolation and publishing before accepting real applications.

## Security notes

- Never expose the Supabase service-role key in browser JavaScript or GitHub.
- The review functions use the signed-in user's identity and check reviewer membership in the database.
- The public application form still only has column-level insert access; it cannot set review status, reviewer identity, or audit rows.
- This is not production-ready until email verification, abuse protection, notifications, recovery, automated tests, and deployment configuration are complete.

Apply only to the dedicated CRIPRI Platform Supabase project, never to the CRIPRI Android/Firebase projects.
