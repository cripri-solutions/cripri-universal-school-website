# Institution media isolation and public delivery audit

Date: 2026-11-26  
Repository: `cripri-solutions/cripri-universal-school-website`  
Branch: `feature/universal-institution-manager`

## Scope and safety

Read-only review of the live Supabase Storage bucket and policies, plus the development manager and public institution page. No files were uploaded, downloaded, deleted or changed. No live policies or bucket settings were changed.

## Live bucket

The live `school-media` bucket is public, has a 50 MiB per-file limit, and allows JPEG, PNG, WebP, GIF, MP4, WebM and PDF.

A public bucket means anyone who obtains a public object URL can retrieve that object without authenticating. This is appropriate only for assets intended for public display, such as published institution logos, banners, gallery images and published content attachments. Private records, confidential documents and internal working files must not be stored in this bucket.

The live bucket currently contains 9 objects. The audit confirmed that all 9 object names begin with a UUID-style institution folder prefix.

## Live Storage RLS policy review

The live `storage.objects` policies for `school-media` currently enforce:

- INSERT: authenticated members of an active institution can upload into the folder matching their own `school_id`.
- SELECT/list through the authenticated Storage API: active institution members can list objects only under their own institution folder.
- UPDATE: only active institution administrators can update objects under their own institution folder.
- DELETE: only active institution administrators can delete objects under their own institution folder.

The folder check uses `storage.foldername(objects.name)[1]` and matches it against the caller's membership `school_id`. This is the critical tenant-isolation boundary. The manager uses `currentSchool.id` as the first path segment for both profile and content uploads, and its current institution ID is populated from the selected `institutions.institution_id`.

Important distinction: the bucket is public, so public URL retrieval does not require membership and is not tenant-private. The policies protect authenticated listing and write operations; they do not make a public bucket's objects confidential.

## Development frontend review

- Profile uploads use an institution-specific UUID folder and the public bucket URL.
- Content uploads use the same institution-specific UUID folder.
- Uploads use `upsert:false`, preventing accidental replacement through a reused object path.
- Profile image input currently accepts JPEG, PNG, WebP and GIF.
- Content media types are validated against the manager's `ALLOWED_TYPES` list.
- Public institution content queries filter by the exact `institution_id` and only retrieve published content or scheduled content whose publish time has arrived.
- Public media rendering supports image, video and file-link presentation.
- Public profile logo and banner use the stored profile URLs.

## Findings and recommendations

1. **Tenant write isolation is present.** The storage policies require the first object path segment to match an active membership's institution ID. No evidence of cross-institution upload, update or delete permission was found in the inspected policies.
2. **Public assets are intentionally public.** Do not put identity documents, private applications, personnel records, student/patient records, confidential contracts or other restricted material in `school-media`.
3. **Upload is broader than administration.** Any active institution member can upload, while only administrators can update/delete. This may be intentional for content editors who publish media. Keep it unless product requirements explicitly restrict uploads to administrators; changing it could break content-editor workflows.
4. **No signed-URL/private bucket migration is recommended now.** Published websites need public media, and changing the bucket to private would require a coordinated frontend URL/signing design and could break existing live pages.
5. **Content moderation remains important.** A member's ability to upload does not automatically make an object public on the institution page; the content record must also pass the institution-specific publication query. However, because the bucket itself is public, anyone with the object's URL may retrieve it even before publication.
6. **Recommended future improvement:** separate public website media from private administrative documents into distinct buckets, with private bucket signed URLs and narrowly scoped policies. This should be a separate, tested project with object migration and rollback planning, not a quick policy edit.

## Verification status

- Live bucket visibility and limits: inspected read-only.
- Live Storage RLS policies: inspected read-only.
- Existing object folder prefixes: 9 of 9 use UUID-style prefixes.
- Manager upload paths: inspected.
- Public content query scoping and publication filtering: inspected.
- Cross-tenant upload attempt: not performed; no test accounts or safe non-production storage environment were available.
- Browser upload/download test: not performed.
- Production changes: none.

## Conclusion

The current Storage policies provide institution-folder isolation for authenticated uploads, updates, deletes and authenticated listing. The bucket remains public by design, so uploaded objects must be treated as public assets, not confidential files. No production change is warranted from this audit alone.