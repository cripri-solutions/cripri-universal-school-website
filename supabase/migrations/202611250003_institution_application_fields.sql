-- Add universal institution details to the existing application table.
-- Safe for existing installations: all columns are added only when absent.
-- Existing applications are treated as school applications by default.

alter table public.school_applications
  add column if not exists institution_type text not null default 'school',
  add column if not exists school_category text,
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists contact_role text,
  add column if not exists physical_address text;

comment on column public.school_applications.institution_type is
  'Applicant institution type: school, college, university, tvet, training_centre, or other.';

-- Anonymous applicants may submit these new institution fields as well.
-- Existing column-level INSERT grants remain in place for the original fields.
grant insert (institution_type, school_category, country, region, contact_role, physical_address)
  on public.school_applications to anon, authenticated;
