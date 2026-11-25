-- Enable authenticated institution administrators to update institution profiles
-- through the security-invoker universal view. Row-level security on public.schools
-- remains the authority that limits updates to the user's own active institution.
GRANT UPDATE (motto, description, welcome_message, physical_address, county, country,
              contact_phone, contact_email, logo_path, banner_path, updated_at)
ON TABLE public.schools TO authenticated;

GRANT UPDATE (motto, description, welcome_message, physical_address, county, country,
              contact_phone, contact_email, logo_path, banner_path, updated_at)
ON TABLE public.institutions TO authenticated;

-- Enable authenticated members to create and edit content through the universal
-- security-invoker view. Existing RLS policies on school_content_items continue
-- to enforce institution membership, administrator permissions and draft-only
-- content-editor restrictions.
GRANT INSERT, UPDATE
ON TABLE public.institution_content_items TO authenticated;
