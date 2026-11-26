# Frontend-to-database workflow audit

**Date:** 2026-11-26  
**Scope:** Feature-branch landing page, registration form, institution manager, public institution page, and live Supabase views/storage policies.  
**Method:** Static source review and read-only live catalog queries. No production writes or test submissions.

## Confirmed integration points

- The landing page links to `school-registration-preview.html` and `school-website.manager.html`.
- Registration submits the expanded institution application payload to `school_applications`.
- The manager reads `institution_memberships`, `institutions`, and `institution_content_items` views.
- Live views map to `school_memberships`, `schools`, and `school_content_items` respectively.
- The public institution page reads the `institutions` view and calls `is_school_website_subscription_valid`.
- The live `school-media` bucket is public and has a 50 MiB upload limit, matching the manager's displayed 50 MB limit.

## Findings requiring correction or an explicit design decision

### 1. Storage upload policy is broader than the profile UI

The manager UI disables profile editing for `content_editor` and only enables profile upload for `school_admin` / `institution_admin`. However, the live Storage INSERT policy named `school members can upload to their school media folder` allows any authenticated member of an active school to upload objects into that school's `school-media` folder. It checks membership and active school status, but not the administrator roles.

This is not automatically a data-exposure vulnerability because the bucket is intentionally public for published media and the upload is confined to the member's school folder. It is a least-privilege mismatch: a content editor can bypass the UI and upload files directly. Decide whether content editors are meant to upload gallery/content media. If profile-only uploads must be administrator-only, use a separate narrowly scoped policy/path or bucket; do not simply remove all member uploads because content publishing may depend on them.

### 2. Registration requires a school category for every institution type

The registration form currently keeps `school_category` visible and required for every institution type. Its options are Primary, Secondary, Primary and secondary, College, and Other. This forces hospitals, churches, NGOs, unions and companies to select a school-oriented category.

The database allows the category to be nullable. Before changing the form, confirm the intended rule: whether category/level is school-only, whether colleges and other institutions use independent categories, and what should be stored for the remaining institution types. Do not silently assign arbitrary categories.

### 3. Manager HTML contains malformed heading markup

The dashboard contains `<h2 id="schoolNameDisplay">Institution</g/h2>`. The closing tag is malformed. Browsers may recover, but it should be corrected to `</h2>` and covered by HTML validation.

### 4. Public institution page uses school-centric copy

The public page dynamically resolves institution types and labels them, but some generic copy and navigation still refers to schools/learners/campus. This is a content-quality issue for hospitals, churches, NGOs and other non-school institutions. Review institution-type-specific wording before release.

## Recommended safe work order

1. Decide the category/level rules for non-school types before altering registration.
2. Decide whether content editors may upload media; then design a least-privilege Storage policy that preserves required gallery uploads.
3. Correct the malformed heading and run HTML validation.
4. Replace school-specific public-site labels and copy with institution-neutral wording or type-aware variants.
5. Run browser tests for one school, one college, one hospital and one non-school organisation in an isolated environment.
6. Verify that the Storage policy and public bucket behaviour are tested using separate admin/editor accounts.

## Release status

The feature branch frontend is wired to the live schema views, but the checks above show that source-level wiring alone is not sufficient to call the user journeys complete. No live policy, view, page or database object was changed by this audit.
