# CRIPRI Universal School Website

The public landing page and school website demonstration platform maintained by CRIPRI Technologies.

## Public preview

https://cripri-solutions.github.io/cripri-universal-school-website/

## Repository scope

This repository contains the CRIPRI Universal School Website project. It is separate from CRIPRI's Android applications and their Firebase projects.

The current repository includes:
- `index.html` — public CRIPRI platform landing page.
- `style.css` — shared responsive styling.
- `school-registration-preview.html` — disabled registration-form preview; it does not submit or store applications.
- `portal-preview.html` — illustrative school administrator workspace; no login or database connection.
- `registration-review-preview.html` — illustrative internal review screen; no authentication or approval actions.
- `school-replica-demo.html` — fictional school website demonstration.
- `script.js` — settings-driven school homepage starter; not yet connected to the backend.
- `supabase/migrations/` — versioned SQL schema migrations intended for the dedicated CRIPRI Platform Supabase project.
- `firebase.json` and `firestore.rules` — legacy Firebase draft files retained for review only; they are not the active backend configuration.
- `docs/backend-security-plan.md` — current Supabase backend status, boundaries and security work still required.

## Current hosting and backend status

- The public static preview is hosted on GitHub Pages.
- The intended backend for this platform is the separate Supabase project named **CRIPRI Platform**.
- A Supabase SQL migration exists in this repository, but the presence of a migration file does **not** mean it has been applied to the Supabase database.
- No live registration, login, approval workflow, school administrator dashboard, or database-backed school website should be assumed to be operational until each feature has been implemented and tested.
- This project must not connect to or modify the Firebase projects used by CRIPRI School Manager, Staff Manager, Student Biometric or License Manager.

## Current functionality boundary

The pages labelled preview/demo are illustrative only. They do not currently:
- submit or store real school applications;
- authenticate applicants, CRIPRI reviewers or school administrators;
- approve or reject applications;
- provision school IDs or administrator accounts;
- save or publish school content to Supabase;
- provide a production-ready private database workflow.

Do not enter real school details, passwords, learner information or confidential information into preview pages.

## Intended onboarding workflow

1. A school submits an application through a secure form.
2. The application is stored as pending review.
3. An authorised CRIPRI reviewer verifies the school and its representative.
4. A trusted backend operation records approval or rejection.
5. Only after approval does a trusted process create/activate the school record and provision its initial administrator.
6. The school administrator signs in and edits the school's approved public profile and website content.
7. Published content becomes visible on that school's public website link.

A public visitor or school applicant must never be able to approve an application, activate a school, assign roles, or grant themselves administrator access.

## Hosting and cost guardrails

- Keep the public static preview on GitHub Pages while it remains suitable.
- Use the existing Supabase Free plan within its current limits for development and evaluation.
- Do not enable paid Supabase features, add a payment method, upgrade a plan, or activate any paid cloud service without explicit approval.
- Do not enable Google Cloud Build or Firebase billing for this project.
- Before launch, verify the current free-plan quotas, backups/retention limits, authentication requirements and expected usage. Free-plan availability is not a guarantee of unlimited or permanent service.

## School website content and privacy

Each school website must use content approved by that school. Do not publish identifiable learner photographs or personal information without the school's appropriate permissions and consent. Private student, staff, parent, attendance, payment and biometric records are outside the scope of this public website platform.

## Development rule

Work on a separate review branch first. Do not merge changes into `main`, deploy production features, or apply database migrations until the change has been reviewed and explicitly approved.

Built by CRIPRI Technologies.
