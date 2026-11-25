-- Store the applicant's own description when they choose the independent
-- Other Institution category. Keep the database allowlist aligned for upgrades.
ALTER TABLE public.school_applications
  ADD COLUMN IF NOT EXISTS other_institution_type text;

GRANT INSERT (other_institution_type)
  ON public.school_applications TO anon, authenticated;

ALTER TABLE public.school_applications
  DROP CONSTRAINT IF EXISTS school_applications_institution_type_check;

ALTER TABLE public.school_applications
  ADD CONSTRAINT school_applications_institution_type_check
  CHECK (institution_type IN (
    'school', 'college', 'university', 'tvet', 'training_centre',
    'hospital', 'church', 'mosque', 'ngo', 'company', 'association',
    'cooperative', 'government', 'union', 'other'
  )) NOT VALID;

ALTER TABLE public.school_applications
  VALIDATE CONSTRAINT school_applications_institution_type_check;

ALTER TABLE public.school_applications
  DROP CONSTRAINT IF EXISTS school_applications_other_institution_type_check;

ALTER TABLE public.school_applications
  ADD CONSTRAINT school_applications_other_institution_type_check
  CHECK (
    (institution_type = 'other' AND other_institution_type IS NOT NULL AND length(trim(other_institution_type)) BETWEEN 2 AND 120)
    OR
    (institution_type <> 'other' AND other_institution_type IS NULL)
  ) NOT VALID;

ALTER TABLE public.school_applications
  VALIDATE CONSTRAINT school_applications_other_institution_type_check;
