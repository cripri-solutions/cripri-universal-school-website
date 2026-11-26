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
assert 'id="schoolCategoryField">' in registration, "Institution category/level must be visible for every institution type."
assert 'school_category" name="school_category" required' in registration, "Institution category/level must be required."
category_select = re.search(r'<select id="school_category".*?</select>', registration, re.S)
assert category_select, "Institution category/level selector is missing."
expected_levels = {"Primary", "Secondary", "Primary and secondary", "College", "Other"}
form_levels = set(re.findall(r'<option value="([^"]+)"', category_select.group(0))) - {""}
assert form_levels == expected_levels, f"Category/level options differ: {sorted(form_levels)}"

# Catch case-sensitive category mismatches between the form and BOTH migrations.
for migration_path in (
    "supabase/migrations/202611250004_validate_institution_application_types.sql",
    "supabase/migrations/202611250006_institution_category_levels.sql",
):
    migration_sql = Path(migration_path).read_text(encoding="utf-8")
    category_constraint = re.search(
        r"school_category\\s+IS\\s+NULL\\s+OR\\s+school_category\\s+IN\\s*\\((.*?)\\)",
        migration_sql,
        re.S | re.I,
    )
    assert category_constraint, f"Category/level constraint missing from {migration_path}"
    database_levels = set(re.findall(r"'([^']+)'", category_constraint.group(1)))
    assert database_levels == form_levels, (
        f"Form/database category levels differ in {migration_path}: "
        f"form-only={sorted(form_levels-database_levels)}, "
        f"database-only={sorted(database_levels-form_levels)}"
    )
assert "school_category: document.getElementById('school_category').value" in payload.group(1), "Selected category/level must be submitted for every institution type."
assert "schoolCategory.required = true;" in registration, "Category/level must be required for every institution type."
assert "school_applications_school_category_check" in Path("supabase/migrations/202611250006_institution_category_levels.sql").read_text(encoding="utf-8"), "Independent category/level database migration is missing."
assert "other_institution_type IS NOT NULL" in extra, "Other Institution database description must not be null."

print(f"Registration contract passed: {len(form_types)} institution types and {len(payload_fields)} payload fields; pending-only RLS, INSERT grants, and Other detail verified.")
