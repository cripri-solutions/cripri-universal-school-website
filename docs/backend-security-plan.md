# CRIPRI Universal School Website — Supabase backend plan

## Purpose

This repository is the public landing page and school website demonstration platform maintained by CRIPRI Technologies. The intended backend is the separate Supabase project named **CRIPRI Platform**.

This backend is for the website platform only. It must remain separate from all CRIPRI Android applications and their Firebase projects. Do not access, modify, migrate or reuse those projects as part of this work.

## Verified repository/database boundary

- GitHub Pages currently serves the public static preview.
- A SQL migration is present at `supabase/migrations/202611040001_initial_schema.sql`.
- A migration file in GitHub is only source code. It does not prove that the SQL has been run in Supabase.
- No live workflow should be advertised until the database state, authentication, server-side functions, browser permissions and end-to-end tests have been verified.
- The older `firebase.json` and `firestore.rules` files are legacy drafts. They are not the active backend plan and must not be deployed as part of the Supabase implementation.

## Existing initial schema — what it provides

The checked-in initial migration defines:

- `school_applications`: public school application submissions with contact details, requested slug, message and review status.
- `schools`: school name, slug and lifecycle status.
- `school_memberships`: links authenticated users to a school with a role.
- `school_content`: one JSONB content document per school, with a published flag.
- Row Level Security (RLS) on these tables.
- A public insert path for pending applications.
- Public reads of active schools and published content.
- Authenticated users can read their own membership.
- A helper function to check whether an authenticated user belongs to an active school.

The migration does not, by itself, deliver the complete product. It does not create a CRIPRI reviewer console, a secure approval workflow, user invitation/onboarding, a fully working school editor, image storage policies, email notifications, spam controls, or a tested deployment pipeline.

## Security work required before real use

1. **Review application intake.** Validate required fields and slug format; add practical anti-spam/rate-limiting protection and avoid exposing application records to public visitors.
2. **Trusted approval.** Only a trusted server-side operation may approve/reject applications, create or activate schools, assign the first administrator, or suspend a school. Never place Supabase service-role credentials in browser JavaScript.
3. **Role-specific editing.** The current schema stores membership roles, but the initial content policy treats school members alike. Define and test the exact permissions for `school_admin` and `content_editor`.
4. **Editable school identity.** The product requirement is that an authorised school administrator can edit the public school name and profile. Implement this with narrowly scoped permissions; never let school users change their school ID, slug ownership, lifecycle status or membership roles unless a separate trusted workflow explicitly allows it.
5. **Tenant isolation.** Test that a user from one school cannot read, edit or publish another school's content, including by changing IDs in browser requests.
6. **Content publishing.** Define draft versus published content and ensure public visitors can read only published content for active schools.
7. **Image storage.** Define a private upload path and file-type/size controls for school logos and photographs. Public delivery should expose only approved published assets.
8. **Auditability.** Record who reviewed applications and who changed/published school content, with server-generated timestamps.
9. **Authentication and recovery.** Define secure reviewer and school-admin sign-in, invitation, password reset and account recovery before launch.
10. **Testing.** Test RLS and trusted operations against a non-production Supabase project before accepting real school data.

## Suggested platform roles

- **CRIPRI reviewer:** verifies applications and controls approval, activation, suspension and initial administrator provisioning.
- **School admin:** manages the school's public identity and all approved website content for that school.
- **Content editor:** edits permitted school content but cannot manage memberships, change protected school identity fields, or alter school status.
- **Public visitor:** reads published content for active schools only.

Role assignment must be performed by trusted administrative code. A browser user must never be able to grant themselves a role.

## Public school links

For the first release, prefer one GitHub Pages domain with a school-specific path or slug, for example:

`https://cripri-solutions.github.io/cripri-universal-school-website/schools/example-school/`

This is a proposed URL pattern, not a currently working dynamic route. GitHub Pages serves static files; dynamic school content must be loaded by the front-end from the approved public Supabase data. Custom domains and per-school subdomains can be considered later.

## Deployment and cost guardrails

- Keep the current static preview on GitHub Pages during development.
- Use Supabase Free only within its current published quotas and limitations.
- Do not enable paid Supabase features, add billing, upgrade plans, or deploy paid services without explicit approval.
- Do not activate Firebase billing, Google Cloud Build or other paid Google Cloud services for this project.
- Confirm current plan limits and operational implications before production use.

## Migration discipline

The existing initial migration is a versioned baseline. Do not paste it into the SQL Editor repeatedly or assume it has already run. First inspect the actual Supabase migration/database state. Any schema correction must be added as a new migration, reviewed for safe RLS and grants, tested, and applied only after explicit approval.

## Status

This document describes the intended architecture and outstanding work. It is not a declaration that the backend is deployed or production-ready.
