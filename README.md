# CRIPRI Universal School Website

The public landing page for the CRIPRI Universal School Website platform, maintained by CRIPRI Technologies.

## Live preview

https://cripri-solutions.github.io/cripri-universal-school-website/

## What this repository currently contains

- `index.html` — CRIPRI platform landing page explaining the service and school onboarding approach.
- `style.css` — responsive visual design shared by the public pages.
- `school-registration-preview.html` — demonstration of the proposed school application form; it is disabled and does not submit or store data.
- `portal-preview.html` — sample school administrator workspace; it has no login or database.
- `registration-review-preview.html` — fictional sample of CRIPRI's manual application review process; it is not a live staff console.
- `script.js` — reusable settings-driven school homepage script retained as a starter for future individual school sites.
- `firestore.rules` and `firebase.json` — an initial security-rules draft and Firebase configuration; not deployed.
- `docs/backend-security-plan.md` — proposed backend structure and security boundaries.

## Current hosting

The public static pages are hosted on GitHub Pages. Firebase is not currently connected. No existing CRIPRI Firebase project is used or modified.

## Important functionality boundary

This is currently a public website and set of interface previews. It does **not** yet:
- collect or transmit school applications;
- create school accounts or administrator logins;
- approve or reject applications;
- generate school IDs;
- save or publish school content from a dashboard;
- provide a private database.

Do not enter real school details, passwords, student information or confidential information into preview pages. The registration form is disabled and the review/dashboard pages use illustrative content only.

## Planned school onboarding

1. A school submits an application through a future secure form.
2. The application is stored as `PENDING_REVIEW`.
3. CRIPRI verifies the school and its authorised representative.
4. An authorised CRIPRI reviewer records approval or rejection.
5. Only after approval does a trusted process create the school identity and provision administrator access.

No school should be automatically activated simply because it submits an application.

## Hosting and cost approach

- Keep public static website hosting on GitHub Pages.
- Evaluate a separate Firebase project for the platform backend, starting with the no-cost Spark plan where supported.
- Do not enable billing, upgrade to Blaze, enable Cloud Build or deploy paid services without explicit approval.
- Secure role assignment and school activation must not be implemented in untrusted browser code. Any backend design must be tested before real applications are accepted.

## Individual school websites

The `script.js` and existing school-page styling provide a starting point for future individual school websites. Each school site should use its own approved public content and approved photographs. Do not publish identifiable learner photographs without the school's appropriate permissions and consent.

Built by CRIPRI Technologies.
