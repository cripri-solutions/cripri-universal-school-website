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
assert "other_institution_type:" in payload.group(1), "Other institution type detail is not submitted."

print(f"Registration contract passed: {len(form_types)} institution types and {len(payload_fields)} payload fields; pending-only RLS, INSERT grants, and Other detail verified.")
