from pathlib import Path
import re

registration = Path("school-registration-preview.html").read_text(encoding="utf-8")
initial = Path("supabase/migrations/202611040001_initial_schema.sql").read_text(encoding="utf-8")
fields = Path("supabase/migrations/202611250003_institution_application_fields.sql").read_text(encoding="utf-8")
types = Path("supabase/migrations/202611250004_validate_institution_application_types.sql").read_text(encoding="utf-8")
extra = Path("supabase/migrations/202611250005_other_institution_type.sql").read_text(encoding="utf-8")

# The form's selectable institution types must exactly match the database allowlist.
select = re.search(r'<select id="institution_type".*?</select>', registration, re.S)
assert select, "Institution type selector is missing."
form_types = set(re.findall(r'<option value="([^"]+)"', select.group(0))) - {""}
constraint = re.search(r"school_applications_institution_type_check.*?CHECK\s*\(institution_type\s+IN\s*\((.*?)\)\s*\)", types, re.S | re.I)
assert constraint, "Institution type database constraint is missing."
db_types = set(re.findall(r"'([^']+)'", constraint.group(1)))
assert form_types == db_types, f"Form/database institution types differ: form-only={sorted(form_types-db_types)}, database-only={sorted(db_types-form_types)}"

# Preserve the anonymous submission policy and least-privilege INSERT column grants.
assert re.search(r'create\s+policy\s+"public may submit applications"\s+on\s+public\.school_applications\s+for\s+insert\s+to\s+anon,\s*authenticated\s+with\s+check\s*\(\s*status\s*=\s*\'pending\'\s+and\s+reviewed_at\s+is\s+null\s*\)', initial, re.I | re.S), "Public pending-only application RLS policy is missing."
assert re.search(r'grant\s+insert\s*\(\s*school_name\s*,\s*contact_person\s*,\s*contact_email\s*,\s*contact_phone\s*,\s*requested_slug\s*,\s*message\s*\)\s*on\s+public\.school_applications\s+to\s+anon,\s*authenticated', initial, re.I | re.S), "Original application INSERT column grant is missing."
assert re.search(r'grant\s+insert\s*\(\s*institution_type\s*,\s*school_category\s*,\s*country\s*,\s*region\s*,\s*contact_role\s*,\s*physical_address\s*\)\s*on\s+public\.school_applications\s+to\s+anon,\s*authenticated', fields, re.I | re.S), "Universal institution INSERT column grant is missing."

# Every submitted payload field must be represented in the schema/migration.
payload = re.search(r'const application\s*=\s*\{(.*?)\n\s*\};', registration, re.S)
assert payload, "Application payload is missing."
payload_fields = set(re.findall(r'^\s*([a-z_]+)\s*:', payload.group(1), re.M))
schema_fields = {"id", "school_name", "contact_person", "contact_email", "contact_phone", "requested_slug", "message", "status", "reviewed_at", "created_at"}
schema_fields.update(re.findall(r'add\s+column\s+if\s+not\s+exists\s+([a-z_]+)', fields, re.I))
schema_fields.update(re.findall(r'add\s+column\s+if\s+not\s+exists\s+([a-z_]+)', extra, re.I))
missing = payload_fields - schema_fields
assert not missing, f"Application payload fields missing from migrations: {sorted(missing)}"

assert re.search(r"grant\s+insert\s*\(\s*other_institution_type\s*\)", extra, re.I | re.S), "Other institution type INSERT grant is missing."
assert 'id="otherInstitutionTypeField" hidden' in registration, "Other institution type detail field is missing."
assert 'id="other_institution_type" name="other_institution_type" minlength="2" maxlength="120"' in registration, "Other institution description length must match the database."
assert "other_institution_type:" in payload.group(1), "Other institution type detail is not submitted."
assert '<option value="college">College</option>' in select.group(0), "College must be an independent institution type."
assert '<option value="other">Other Institution</option>' in select.group(0), "Other Institution must be an independent institution type."
assert '<option value="hospital">Hospital / Health Facility</option>' in select.group(0), "Hospital must be available as an institution type."
assert "otherInstitutionType.required = isOther;" in registration, "Other Institution description must be required only for Other."
assert 'id="schoolCategoryField">' in registration, "Institution category/level field must be available."
category_select = re.search(r'<select id="school_category".*?</select>', registration, re.S)
assert category_select, "Institution category/level selector is missing."
assert 'school_category" name="school_category"' in category_select.group(0), "Category/level must retain its submitted field name."
assert "const isSchool = type === 'school';" in registration and "const isCollege = type === 'college';" in registration, "Category logic must distinguish schools and colleges."
assert "schoolCategory.required = isSchool || isCollege;" in registration, "Only school and college categories should be mandatory."
assert "['Primary', 'Primary']" in registration and "['Secondary', 'Secondary']" in registration and "['Primary and secondary', 'Primary and Secondary']" in registration, "School level choices are incomplete."
assert "[['College', 'College']]" in registration, "College must receive its own fixed category."
assert "[['Other', 'Other']]" in registration, "Other institution types must offer Other."
assert "school_category: document.getElementById('school_category').value || null" in payload.group(1), "An unneeded category must be submitted as NULL."
assert "schoolCategory.value = isCollege ? 'College' : '';" in registration, "Category must reset when institution type changes."

# The database allowlist remains broad enough for per-type UI selection.
expected_database_levels = {"Primary", "Secondary", "Primary and secondary", "College", "Other"}
for migration_path in (
    "supabase/migrations/202611250004_validate_institution_application_types.sql",
    "supabase/migrations/202611250006_institution_category_levels.sql",
):
    migration_sql = Path(migration_path).read_text(encoding="utf-8")
    category_constraint = re.search(
        r"school_category\s+IS\s+NULL\s+OR\s+school_category\s+IN\s*\((.*?)\)",
        migration_sql,
        re.S | re.I,
    )
    assert category_constraint, f"Category/level constraint missing from {migration_path}"
    database_levels = set(re.findall(r"'([^']+)'", category_constraint.group(1)))
    assert database_levels == expected_database_levels, (
        f"Database category allowlist differs in {migration_path}: "
        f"expected={sorted(expected_database_levels)}, actual={sorted(database_levels)}"
    )
assert "school_category: document.getElementById('school_category').value || null" in payload.group(1), "Category must be submitted as its selected value or NULL."

assert "school_applications_school_category_check" in Path("supabase/migrations/202611250006_institution_category_levels.sql").read_text(encoding="utf-8"), "Independent category/level database migration is missing."
assert "other_institution_type IS NOT NULL" in extra, "Other Institution database description must not be null."


# Approval must preserve every submitted institution detail and its authorization boundary.
approval = Path("supabase/migrations/202611260001_preserve_institution_application_details.sql").read_text(encoding="utf-8")
assert re.search(r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.review_school_application", approval, re.I), "Institution review RPC replacement is missing."
assert re.search(r"SECURITY\s+DEFINER", approval, re.I), "Review RPC security mode changed; require explicit security review."
assert "v_reviewer_id := auth.uid();" in approval, "Review RPC must derive reviewer identity from the authenticated session."
assert re.search(r"pr\.user_id\s*=\s*v_reviewer_id\s+AND\s+pr\.active\s*=\s*true", approval, re.I), "Review RPC must require an active platform reviewer."
assert re.search(r"a\.status\s*=\s*'pending'\s+FOR\s+UPDATE", approval, re.I), "Review RPC must lock only a pending application."
for column in (
    "institution_type", "school_category", "other_institution_type", "region",
    "contact_person", "contact_role", "physical_address", "country",
    "contact_phone", "contact_email",
):
    assert re.search(r"v_application\." + column + r"\b", approval), (
        f"Approved institution must preserve application field: {column}"
    )
assert re.search(r"INSERT\s+INTO\s+public\.application_review_audit", approval, re.I), "Review decisions must remain auditable."
assert re.search(r"UPDATE\s+public\.school_applications\s+SET\s+status\s*=\s*v_decision", approval, re.I), "Review RPC must record the final decision."

# Notification claim schema must match the sender's in-flight state.
notification_schema = Path("supabase/migrations/20261126120000_notification_email_send_claim.sql").read_text(encoding="utf-8")
notification_sender = Path("supabase/functions/send-school-notification/index.ts").read_text(encoding="utf-8")
assert re.search(r"ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+email_claimed_at\s+timestamptz", notification_schema, re.I), "Notification claim timestamp column is missing."
for status in ("pending", "sending", "sent", "failed", "skipped"):
    assert re.search(r"'" + status + r"'::text", notification_schema), f"Notification email status missing: {status}"
assert "claimNotification" in notification_sender and "reclaimStaleNotification" in notification_sender and "finalizeNotification" in notification_sender, "Notification sender must claim, recover and finalize sends."

print(f"Registration contract passed: {len(form_types)} institution types and {len(payload_fields)} payload fields; pending-only RLS, INSERT grants, and Other detail verified.")


# Review audit association must exist before the AFTER UPDATE notification trigger fires.
assert approval.index("INSERT INTO public.application_review_audit") < approval.index("UPDATE public.school_applications"), "Review audit must be inserted before status update triggers notification."
notification_trigger = Path("supabase/migrations/20261126130000_exact_review_notification_institution.sql").read_text(encoding="utf-8")
assert "FROM public.application_review_audit ara" in notification_trigger, "Review notification must resolve institution through the exact audit row."
assert "ara.application_id = NEW.id" in notification_trigger and "ara.decision = NEW.status" in notification_trigger, "Notification audit lookup must match application and decision."
assert "lower(btrim(s.name))" not in notification_trigger, "Notification must not associate institutions by non-unique name."
assert "ON CONFLICT (application_id, event_type) DO NOTHING" in notification_trigger, "Notification duplicate protection must remain."
print("Review notification association contract passed: audit-first ordering, exact application/decision mapping, and idempotent insert verified.")
