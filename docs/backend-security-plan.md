# CRIPRI Universal School Website — backend security plan

## Purpose and boundaries

This repository is the public website template and the reviewed starting point for a future school portal. The current GitHub Pages site is static. It does not authenticate users, process applications, or store school records.

The proposed backend is a **separate Firebase project dedicated to the website platform**. Do not reuse or change Firebase projects used by CRIPRI School Manager, Staff Manager, Student Biometric, or License Manager.

## Proposed Firestore collections

### `schoolApplications/{applicationId}`

A registration request submitted by an authenticated applicant. Suggested fields:

- `applicantUid`: Firebase Authentication UID of the applicant
- `schoolName`, `schoolCategory`, `country`, `region`
- `officialEmail`, `officialPhone`, `address`
- `contactName`, `contactRole`
- `status`: initially `PENDING_REVIEW`
- `submittedAt`: server timestamp

Only a trusted CRIPRI reviewer may read application records or make an approval decision. Do not expose an application queue on the public website.

### `schools/{schoolId}`

A school record created by a trusted CRIPRI process only. Suggested fields:

- `schoolId`: immutable unique identifier matching the document ID
- `officialName`
- `status`: `PENDING_SETUP`, `ACTIVE`, `SUSPENDED`, or `REJECTED`
- `publicProfileEnabled`
- `createdAt`, `approvedAt`, `approvedBy`

The school ID must never be supplied or changed by a school administrator. Generate it after approval in trusted server-side code and check for uniqueness.

### `schools/{schoolId}/siteContent/{contentId}`

Approved public website content such as the school's public profile, announcements and events. Only authorised members of that same active school may edit it. Public reads are allowed only for active schools and only for this public-content collection.

### `schools/{schoolId}/members/{uid}`

School membership metadata. Membership and role assignment are provisioned by trusted CRIPRI processes, not by users editing their own records.

### `users/{uid}`

Basic account metadata. School assignment and role claims are issued by trusted server-side processes. A user must never be able to promote themselves to school administrator or platform reviewer.

### `schools/{schoolId}/privateData/{document}`

Reserved for future confidential records. It is explicitly denied in the initial rules until a separate design, role model, validation plan and tests are approved.

## Approval workflow

1. Applicant signs in and submits an application.
2. Application is stored as `PENDING_REVIEW`.
3. A CRIPRI reviewer verifies the school and authorised representative outside the public client.
4. The reviewer records approval or rejection, reviewer UID, timestamp and reason in a controlled workflow.
5. On approval, trusted server-side code creates the school document, assigns a unique immutable School ID and provisions the initial administrator.
6. The administrator receives access only after their identity is verified and their account is assigned the correct school ID and role.
7. Suspension disables school access through the school status check.

## Security model

- Default deny: every collection not explicitly allowed is inaccessible.
- Platform reviewer authority uses a trusted Firebase Authentication custom claim: `platformAdmin: true`.
- School access uses trusted custom claims: `schoolId` and `role`.
- Supported initial website-editing roles: `SCHOOL_ADMIN` and `WEBSITE_EDITOR`.
- Custom claims must be set only by trusted server-side code using the Firebase Admin SDK. Never set them from browser JavaScript.
- School membership and role documents are not client-writable.
- School status is checked before school member access.
- Private student, staff, parent, attendance, payment and biometric data are out of scope and denied by these initial rules.
- Never put service-account JSON, private keys, passwords, student information or other secrets in this public GitHub repository.

## Important deployment warning

These rules are a conservative starting point, not a complete production backend. They must be tested in the Firebase Emulator Suite or an equivalent isolated test project before deployment. The initial rules deliberately deny private records and client-side approval decisions.

No Firebase project has been connected or changed by adding these files. Do not deploy until the dedicated website Firebase project ID is confirmed and the rules have been tested.

## Cost-conscious deployment approach

Use a dedicated Firebase project and check the current Firebase plan limits for the exact products required. Firestore and Authentication may be usable on the no-cost Spark plan within its quotas; do not enable billing, Cloud Build, paid extensions, or other paid Google Cloud services without an explicit decision. Hosting the static public website on GitHub Pages remains separate.
