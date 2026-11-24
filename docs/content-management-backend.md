# Supabase public content management

This implementation targets Supabase (Postgres, Auth, RLS and Edge Functions), not Firebase.

## Content lifecycle

Records are stored in `public.school_site_content` and belong to a school UUID.
- `DRAFT`: saved but not public.
- `PUBLISHED`: readable publicly only while the school is ACTIVE.
- `WITHDRAWN`: immediately hidden from public reads.
- `RECOVERY`: retained and hidden; may be restored.
- Permanent deletion: allowed only from RECOVERY after explicit confirmation. The audit record remains.

Restoring returns an item to DRAFT; an administrator must publish it again.

## Role and school provisioning

The migration creates `cripri_content_schools` and `cripri_content_admins` as the content module's trusted access registry. A trusted CRIPRI provisioning process must create/update the school row and grant the verified administrator's Supabase Auth user UUID the `SCHOOL_ADMIN` membership. These tables are not writable by browser users; only the Supabase service role can provision them. Do not expose the service-role key in frontend code.

The Edge Function validates the caller's Supabase Auth session. The Postgres RPC independently checks `auth.uid()`, active school status, and the school-admin membership before every operation. Client-side direct writes to content and audit tables are denied by grants/RLS.

## Files

- `supabase/migrations/202611240001_content_management.sql`: tables, RLS policies and transactional RPC.
- `supabase/functions/manage-site-content/index.ts`: authenticated Edge Function entry point.
- `docs/content-management-backend.md`: this guide.

## Admin portal integration

`admin-content.html` is the first Supabase-connected administrator interface. It uses the public publishable key in the browser, signs in through Supabase Auth, discovers only the caller's active school memberships through `get_my_cripri_schools()`, reads records under RLS, and sends lifecycle changes through the authenticated `manage-site-content` Edge Function. The administrator interface must be served over HTTPS. The older `school-content-manager-preview.html` remains a browser-only demonstration and must not be used for real school data.

The admin portal must:
1. use the Supabase project URL and publishable/anon key (never service role);
2. sign in through Supabase Auth;
3. invoke `manage-site-content` with the selected school UUID and action;
4. query only published content for public pages; admins can query their own school content under RLS;
5. display returned errors and ask for confirmation before permanent deletion.

Photograph storage upload and consent evidence management are not yet implemented. This migration accepts only HTTPS image URLs and requires an explicit permission-confirmation flag; this is an attestation, not a substitute for retaining proof of consent. Configure a private Supabase Storage bucket, school-scoped upload policies, file-size/type checks and consent evidence before using real learner photographs.

## Apply and test

Apply the migration to a dedicated Supabase project only after reviewing its existing schema and confirming the project. Deploy the Edge Function after setting the Supabase project environment. Test with at least two schools and users:
- anonymous visitor can read published content only;
- anonymous visitor cannot read drafts, withdrawn or recovery content;
- school A admin cannot read or mutate school B content;
- non-admin and unauthenticated callers are denied;
- suspended school admin is denied;
- direct browser INSERT/UPDATE/DELETE to content and audit tables are denied;
- every successful lifecycle change writes its audit row in the same database transaction;
- deletion requires recovery status and explicit confirmation;
- restore returns content to draft;
- photograph publishing requires HTTPS media and permission attestation.

The frontend is configured with the supplied Supabase project URL and publishable key. This does not apply the database migration or deploy the Edge Function. The migration still requires review and application to the confirmed project; the Edge Function still requires deployment. Provision verified school/admin memberships before allowing real administrators to sign in. Do not treat this branch as production-ready until the tests above pass.

## Deployment runbook for project `dudrolmymjwphwivrlko`

These steps are intentionally manual because the repository connection does not grant access to apply SQL or deploy functions in the Supabase dashboard. Do not paste a service-role key into GitHub or the browser.

1. In the Supabase dashboard, open project `dudrolmymjwphwivrlko` and confirm it is the CRIPRI Universal Website project.
2. Review the existing database objects for naming conflicts, especially `public.school_site_content` and `public.school_content_audit`. The migration uses `create table if not exists`; an existing table with a different schema will not be altered to match.
3. Open SQL Editor and run `supabase/migrations/202611240001_content_management.sql`. Inspect the result for errors before proceeding.
4. From a trusted terminal with Supabase CLI installed, run:
   ```sh
   supabase login
   supabase link --project-ref dudrolmymjwphwivrlko
   supabase functions deploy manage-site-content
   ```
   The function config keeps JWT verification enabled. The deployed function uses the platform-provided `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables and forwards the caller's bearer token to Postgres.
5. In Supabase Authentication, configure the site's allowed redirect URLs and create/verify the intended administrator accounts. Do not enable public sign-up unless the platform has an approved onboarding process.
6. A trusted CRIPRI provisioning operator must insert the confirmed school UUID into `cripri_content_schools` with status `ACTIVE`, then add the administrator's verified Auth user UUID to `cripri_content_admins` with role `SCHOOL_ADMIN` and `active=true`. Perform this through a trusted server-side process or SQL Editor using verified identifiers, never through browser code.
7. Host `admin-content.html` on the intended HTTPS website and test the full checklist above with two schools, an admin, a non-admin and an anonymous visitor. Also verify the public website only renders published items.
8. Before real learner photographs are used, implement Supabase Storage upload restrictions and a consent evidence retention workflow. The current URL/checkbox fields are not a complete photo-consent system.

The repository key is a publishable client key. It is expected to be visible in browser code and is not a secret. Rotate it in Supabase if it is ever replaced or exposed outside its intended public use. Never expose the service-role/secret key.
