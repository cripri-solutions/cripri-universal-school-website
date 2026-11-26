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

# Institution manager must load, display, and save the details preserved by approval.
manager = Path("school-website.manager.html").read_text(encoding="utf-8")
manager_fields = {
    "school_category": "profileCategory",
    "other_institution_type": "profileOtherType",
    "region": "profileRegion",
    "contact_person": "profileContactPerson",
    "contact_role": "profileContactRole",
}
for column, element_id in manager_fields.items():
    assert f'id="{element_id}"' in manager, f"Manager profile control missing for {column}."
    assert re.search(r"currentSchool\." + column + r"\s*\|\|", manager), (
        f"Manager must load existing {column} value."
    )
    assert re.search(r"\b" + column + r"\s*:\s*\$\('" + element_id + r"'\)\.value", manager), (
        f"Manager must save {column} from its profile control."
    )
manager_selects = re.findall(r"\.select\('([^']+)'\)", manager)
expected_manager_columns = set(manager_fields) | {
    "institution_id", "name", "slug", "status", "institution_type",
    "motto", "description", "welcome_message", "physical_address",
    "county", "country", "contact_phone", "contact_email", "logo_path",
    "banner_path"
}
assert any(expected_manager_columns.issubset(set(columns.split(","))) for columns in manager_selects), (
    "Manager institution profile query must load every preserved registration field."
)
assert "$('profileForm').querySelectorAll('input,select,textarea,button')" in manager, (
    "View-only manager role must disable the added select controls too."
)
print("Institution manager contract passed: preserved registration details are loaded, editable and saved.");

# Public institution website must read the preserved fields and display category and region safely.
public_page = Path("school.html").read_text(encoding="utf-8")
public_query = re.search(r'from\("institutions"\)\.select\("([^"]+)"\)', public_page)
assert public_query, "Public institution profile query is missing."
public_columns = set(public_query.group(1).split(","))
assert {"school_category", "other_institution_type", "region"}.issubset(public_columns), (
    "Public institution profile query must load category, Other description and region."
)
assert 'text("contactCategory",category)' in public_page, "Public institution category is not rendered."
assert 'school.institution_type==="other"?school.other_institution_type:null' in public_page, (
    "Public profile must show the supplied Other institution description when no category applies."
)
assert "school.county||school.region" in public_page, "Public profile must fall back to submitted region when county is absent."

# Universal public page must not retain school-only calls to action or section labels.
for school_only in ("Discover our school", "School calendar", "School gallery", "Schools should replace these examples"):
    assert school_only not in public_page, f"School-specific public wording remains: {school_only}"

# Hard-coded demonstration facilities must not be exposed on public institution websites.
# Institution-specific facilities and services use the existing content pipeline.
manager_page = Path("school-website.manager.html").read_text(encoding="utf-8")
assert 'data-page="services"' in manager_page
assert 'id="servicesList"' in manager_page
assert 'data-create="facility_service"' in manager_page
assert '<option value="facility_service">Facility / Service</option>' in manager_page
assert "facility_service:'Facility / Service'" in manager_page
assert "page === 'services'" in manager_page
assert "renderCategory('facility_service','servicesList')" in manager_page
assert 'id="servicesList"' in public_page
assert 'rows.filter(r=>r.content_type==="facility_service")' in public_page

# Database content-type allowlist must include the facilities/services type used by both pages.
facility_migration = Path("supabase/migrations/20261126150000_institution_facilities_services_content_type.sql").read_text(encoding="utf-8")
assert "school_content_items_content_type_check" in facility_migration
assert "'facility_service'" in facility_migration
assert "ALTER TABLE public.school_content_items" in facility_migration
assert 'id="services"' in public_page
assert 'if(facilitiesSection) facilitiesSection.remove();' in public_page, (
    "Unverified demonstration facilities must be hidden from public institution websites."
)
assert 'const facilitiesLink=document.querySelector(\'#nav a[href="#facilities"]\');' in public_page, (
    "Facilities navigation must be removed when the demonstration section is hidden."
)




# The new profile fields require column-level UPDATE grants on both the base table and view.
profile_migration = Path("supabase/migrations/202611260001_preserve_institution_application_details.sql").read_text(encoding="utf-8")
for relation in ("public.schools", "public.institutions"):
    grant = re.search(
        r"GRANT\s+UPDATE\s*\((.*?)\)\s*ON\s+TABLE\s+" + re.escape(relation) + r"\s+TO\s+authenticated",
        profile_migration,
        re.I | re.S,
    )
    assert grant, f"Manager UPDATE grant is missing on {relation}."
    granted_columns = set(re.findall(r"[a-z_]+", grant.group(1), re.I))
    assert set(manager_fields).issubset(granted_columns), (
        f"Manager UPDATE grant on {relation} omits preserved registration fields."
    )


