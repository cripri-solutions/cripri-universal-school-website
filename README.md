# CRIPRI Universal Institution Website Platform

A multi-tenant website platform maintained by CRIPRI Technologies. The shared platform supports schools and other institution types while retaining the existing school data model for backward compatibility.

## Application components

- `index.html` — CRIPRI public platform landing page.
- `school-website.manager.html` — authenticated institution manager for institution profiles and website content.
- `school.html` — public institution website rendered from the institution slug.
- `cloudflare-school-router.js` — Cloudflare Worker router for institution subdomains under `*.criprisolutions.co.ke`; serves the dynamic institution page and forwards static assets to GitHub Pages.
- `wrangler.jsonc` — Worker configuration, including preview configuration.
- `supabase/migrations/` — versioned SQL migrations. Apply them in order after reviewing the target database; committing a migration does not execute it against Supabase. The institution application fields and allowed-type/category constraints are in migrations `202611250003` and `202611250004`.
- `school-registration-preview.html` — public institution application form. It submits applications to `school_applications` using the Supabase publishable key and relies on database grants and row-level security.
- `portal-preview.html` and `registration-review-preview.html` — legacy illustrative preview pages; they are not the authenticated production manager or reviewer console.

## Institution model

The platform uses a shared institution model with an `institution_type` field. Supported types are defined by the database constraint and include schools, colleges, universities, TVET institutes, training centres, churches, mosques, NGOs, companies, associations, cooperatives, government institutions, unions and other institutions.

For compatibility, the underlying database retains legacy table names such as `schools`, `school_memberships`, and `school_content_items`. Universal views such as `institutions`, `institution_memberships`, and `institution_content_items` provide institution-oriented names to the application.

## Manager capabilities

The institution manager is connected to Supabase Auth and the universal database views. Its intended workflows include:

- Sign in with an institution manager account.
- Select an institution where the user has an active membership.
- View and update institution profile details.
- Create, edit, publish and schedule website content according to database role policies.
- Manage content recovery and restoration where the user's role permits it.
- Upload institution media to the configured Supabase Storage bucket.

Actual access is enforced by Supabase grants, row-level security policies, and trusted database functions—not by hiding controls in the browser.

## Public institution websites

The public website resolves an institution by its approved slug and displays public profile details and published content. The Cloudflare Worker routes institution subdomains to the shared public website engine and forwards static assets to the GitHub Pages project.

Illustrative facility artwork and sample copy must not be represented as verified photographs or facilities of a real institution. Replace them with institution-approved information and media before a client launch.

## Hosting and environment

- GitHub Pages hosts the repository's static website assets.
- Supabase provides authentication, database access, row-level security, and storage for the manager and public website.
- Cloudflare Workers routes institution subdomains when the Worker is deployed and the appropriate route and DNS are configured.

The Cloudflare Pages integration reports successful branch-preview deployments for feature-branch commits. This confirms the static Pages preview build, not the separate Cloudflare Worker deployment, custom-domain routing, or a live institution workflow. Verify those separately before testing with an institution account.

## Development and release safety

- Current development branch: `feature/universal-institution-manager`.
- Keep implementation and testing on the feature branch until reviewed.
- Do not merge to `main`, change production Worker routes, or deploy production without explicit approval.
- The initial schema migration creates the `public may submit applications` row-level security policy on `school_applications`, restricting public submissions to pending applications with no review timestamp. Migration `202611250003` grants anonymous and authenticated users `INSERT` access to the six added institution fields. A SQL migration committed to GitHub is not automatically applied to the live Supabase project: apply migrations through the intended Supabase release process, then verify that both the column grants and the original RLS policy are present on the target database.
- Test with a dedicated institution account and non-sensitive sample content before demonstrating the manager to a client.
- Never commit Supabase secret/service-role keys, passwords, access tokens, or client data. The browser may use only the project's publishable/anon key with appropriate RLS protection.
- Do not publish identifiable learner photographs or personal information without the institution's appropriate permissions and consent.

## Current verification boundary

The feature branch contains the universal institution manager, public institution website, Worker router, and universal-manager write-permissions migration. Supabase has confirmed the required authenticated profile and content write grants. The latest feature-branch commit has a successful Cloudflare Pages preview deployment and a successful registration/database contract validation. The preview has not yet completed an end-to-end browser smoke test; the live Supabase application-field migration and anonymous INSERT grants remain unverified, as do authenticated profile/content browser writes, storage uploads, and the separate Worker/custom-domain route. Complete these checks before a client launch.

Built by CRIPRI Technologies.
