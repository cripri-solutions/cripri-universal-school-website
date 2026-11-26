# Registration-to-approval workflow audit

Date: 2026-11-26  
Repository: `cripri-solutions/cripri-universal-school-website`  
Branch: `feature/universal-institution-manager`

## Scope and safety

This review compared the development registration form and proposed migrations with read-only definitions and schema metadata from the live Supabase project. No live data, schema, policies, functions, triggers, or deployment settings were changed. No test application was submitted and no approval action was invoked against production.

## End-to-end field contract

The development registration form sends:

- `school_name`
- `institution_type`
- `other_institution_type` (only for the generic Other type)
- `school_category` (nullable where not applicable)
- `country`, `region`
- `contact_email`, `contact_phone`
- `physical_address`
- `contact_person`, `contact_role`
- `message`
- `requested_slug`

The registration contract validator checks that submitted payload fields are represented in the migration schema and that the public insert policy is pending-only. The development approval migration maps the application details into `public.schools`, including institution type, category, Other description, region, contact person and role, address, country, phone and email. It also appends the corresponding fields to the security-invoker `public.institutions` view.

## Confirmed live gaps

### 1. Approval currently drops submitted details

The live `public.review_school_application(uuid,text,text)` function was read directly from the database. Its approval INSERT currently writes only:

- `name`
- `slug`
- `status`
- `institution_type`

It does not copy the application category, Other institution description, region, contact person, contact role, physical address, country, contact phone or contact email into the new institution row.

The live `schools` table also lacks these proposed destination columns: `school_category`, `other_institution_type`, `region`, `contact_person`, and `contact_role`.

The live `school_applications` table lacks `other_institution_type`.

### 2. Notification association is ambiguous

The live `create_school_review_notification()` trigger function locates the institution by matching a trimmed, case-insensitive name and institution type, then choosing the most recently created match. This is not a unique application-to-institution relationship and can associate a notification with the wrong record when names and types repeat.

The live trigger is `AFTER UPDATE OF status` on `public.school_applications`. The current live approval function updates the application status before inserting its `application_review_audit` row. Therefore, the trigger cannot use the new audit association during that status update.

## Proposed development correction

The feature branch migrations address these two defects:

1. Add the missing institution destination fields and the missing application Other-description field.
2. Copy all submitted registration details into the institution on approval.
3. Insert the `application_review_audit` row before updating application status.
4. Resolve the notification's institution through the exact `application_id` and decision in that audit row, rather than a non-unique name lookup.
5. Preserve the pending-only review rule, active reviewer authorization, row lock, and notification idempotency constraint.

The approval and exact-notification migrations are a coupled change. The trigger migration must not be deployed without the matching audit-first approval function migration.

## Verification status

- Development registration contract: automated workflow passed for commit `8b71edf8502d3c43cbbaa20445b54b0a48d56516` (workflow run 208).
- Live approval RPC: inspected read-only; detail-loss gap confirmed.
- Live notification trigger: inspected read-only; ambiguous name matching and trigger/audit ordering gap confirmed.
- Live table columns: inspected read-only; missing columns confirmed.
- Existing review audit rows: inspected read-only; historical approved records have explicit application-to-institution IDs.
- Production end-to-end submission and approval test: not performed.
- Proposed migration execution: not performed.
- Production deployment and PR merge: not performed.

## Release blockers and safe next steps

- Reconcile the historical live migration ledger with recoverable source files before applying the proposed migration set. Do not fabricate historical migration SQL or replay mismatched versions.
- Secure and verify a restorable backup before any production schema or function change. Current inventory and feasibility notes are not backups.
- After those blockers are resolved and separately approved, test the complete flow in a safe non-production environment: submit a representative application, verify every field in `school_applications`, approve it, verify every mapped field in `schools`, confirm the audit row references that exact school ID, and confirm the notification references the same ID.
- Include rejection-path testing: rejected applications should have an audit row with a null school association and a correctly linked rejection notification.
- Verify duplicate institution names do not cause cross-linking.
- Only then consider production migration and deployment, with explicit approval.

## Conclusion

The development correction is aligned with the defects observed in the live approval and notification functions. It is not yet production-ready: historical migration-source reconciliation, a verified restorable backup, and an end-to-end test remain mandatory.