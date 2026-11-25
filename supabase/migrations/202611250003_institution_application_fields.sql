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
