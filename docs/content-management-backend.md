# Secure public content management — implementation notes

## Lifecycle

Content records live under `schools/{schoolId}/siteContent/{contentId}`. Supported types are `PHOTOGRAPH` and `COMMUNICATION`.

- `DRAFT`: saved but not visible to public visitors.
- `PUBLISHED`: visible to visitors while the school is active.
- `WITHDRAWN`: immediately hidden from public reads.
- `RECOVERY`: removed from public reads and retained for restoration.
- Permanent deletion: allowed only from `RECOVERY`, after explicit confirmation. An audit entry is retained.

Restoring a withdrawn or recovered item returns it to `DRAFT`; an administrator must explicitly publish it again. This prevents accidental re-publication.

## Authorisation

Callable functions require Firebase Authentication and trusted custom claims:
- `role: "SCHOOL_ADMIN"`
- `schoolId: "<assigned school document ID>"`

The function checks that the school exists and has `status: "ACTIVE"`. Claims must be assigned only by trusted CRIPRI provisioning using the Firebase Admin SDK. A user must never be able to assign their own role or school ID.

No `WEBSITE_EDITOR` claim is accepted for these lifecycle actions. Firestore client writes to public content and audit records are denied. Functions use the Admin SDK to make each content change and its audit record in one Firestore transaction.

## Callable functions

- `saveSiteContent`: create a draft or amend an existing record.
- `publishSiteContent`: publish an eligible draft.
- `withdrawSiteContent`: hide an item from public reads.
- `moveSiteContentToRecovery`: retain an item in the Recovery Bin.
- `restoreSiteContent`: return withdrawn/recovered content to draft.
- `permanentlyDeleteSiteContent`: delete only from Recovery Bin with explicit confirmation.

Photograph saves require an HTTPS image URL and an explicit permission-confirmation flag. This is an administrative attestation, not a substitute for retaining the underlying consent record and verifying the rights to publish the image.

## Public website integration still required

The current GitHub Pages pages are static. They do not call these functions or query Firestore. A future authenticated admin application must:
1. Sign in using Firebase Authentication.
2. invoke the callable functions using the signed-in session.
3. query only `status == "PUBLISHED"` records for the public website.
4. render the content returned from Firestore, not from browser local storage.
5. handle callable errors and show confirmation before permanent deletion.

Photograph file upload and secure media storage are not implemented by this change. Before using real photographs, configure Firebase Storage in the dedicated project with school-scoped upload permissions, validate file type/size, and preserve consent evidence. Do not use arbitrary public image URLs for confidential or unapproved images.

## Required tests before deployment

Use a separate Firebase Emulator Suite or isolated test project. Verify:
- unauthenticated calls are rejected;
- SCHOOL_ADMIN for school A can manage school A only;
- SCHOOL_ADMIN for school A cannot access school B;
- WEBSITE_EDITOR and ordinary users cannot call lifecycle functions;
- suspended schools cannot manage content;
- public reads return published items only;
- withdrawn and recovery items are not publicly readable;
- direct client writes to siteContent and contentAudit are denied;
- audit rows are created for every successful lifecycle operation and cannot be changed by clients;
- permanent deletion fails without explicit confirmation and unless the item is in RECOVERY;
- restore returns content to DRAFT, not directly to public view;
- a photograph cannot be published without the permission attestation.

## Deployment boundary

This is backend source and a rules draft only. No Firebase project is selected, connected, deployed, or billed by this change. Keep production deployment blocked until CRIPRI confirms the dedicated website Firebase project ID, tests pass, and the project owner approves deployment and any cost implications.
