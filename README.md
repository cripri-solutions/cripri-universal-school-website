# CRIPRI Universal School Website

Production platform source for CRIPRI Technologies.

## Canonical public origin
- Canonical domain: https://criprisolutions.co.ke
- GitHub repository: https://github.com/cripri-solutions/cripri-universal-school-website
- Supabase backend: CRIPRI Platform

Cloudflare Pages/Worker production deployment is part of the release process. Confirm the actual Pages deployment hostname in Cloudflare before changing the Worker upstream. Do not guess a `.pages.dev` hostname.

## Core routes
- `/` — current public platform homepage.
- `/school-registration.html` — live universal institution application form.
- `/school-website-manager.html` — institution administrator sign-in and content manager.
- `/super-admin-login.html` — CRIPRI platform administrator sign-in.
- `/super-admin-dashboard.html` — authenticated platform administration.
- `/super-admin-domain-onboarding.html` — authenticated domain onboarding workspace.
- School subdomains — dynamic public school pages served by `school.html`.

## Legacy route policy
Old preview/demo filenames are redirect-only compatibility routes. They must not render obsolete preview interfaces. New internal links use canonical production routes. The old GitHub Pages hostname is not a canonical destination.

## Backend
- Supabase project: CRIPRI Platform.
- Tables include school applications, schools, memberships, subscriptions, payments, content, content audits, domain onboarding and notifications.
- Edge Functions include super-admin-administrators, school-admin-management and send-school-notification.
- Browser code may contain a Supabase publishable key; never commit service-role keys, Resend secrets or other server secrets.

## Institution registration
The registration form submits the required `institution_type` using database-supported values:
`school`, `college`, `university`, `tvet`, `training_centre`, `church`, `mosque`, `union`, `association`, `ngo`, `cooperative`, `company`, `government`, `other`.
Applications remain pending until an authorised CRIPRI reviewer approves them. Submission must never auto-activate an institution.

## Release checklist
1. Deploy the branch after review and merge to the production branch.
2. Verify Cloudflare Pages serves the new homepage and route files.
3. Verify the Cloudflare Worker uses the confirmed Pages upstream and wildcard school-subdomain route.
4. Update Supabase Auth allowed redirect URLs to include `https://criprisolutions.co.ke/school-website-manager.html`.
5. Update Edge Function CORS and invitation redirect origins to the canonical domain.
6. Test registration, approval, invitation, sign-in, content CRUD, publishing, withdrawal, recovery, subscription gating and active school subdomains.
7. Run Supabase security/performance advisors and address the high-risk findings.

## Migration integrity
The live Supabase project has migrations beyond the SQL migration files currently tracked here. Reconstruct and commit missing migration SQL before treating this repository as a fully reproducible deployment source. Do not fabricate migration history from names alone.
