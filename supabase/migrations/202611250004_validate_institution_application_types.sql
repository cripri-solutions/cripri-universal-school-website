-- Keep institution applications aligned with the institution types offered
-- by the public registration form. Existing applications default to 'school'.
-- NOT VALID avoids blocking deployment if legacy rows need review; PostgreSQL
-- still enforces the constraint for all new or updated rows immediately.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'school_applications_institution_type_check'
      AND conrelid = 'public.school_applications'::regclass
  ) THEN
    ALTER TABLE public.school_applications
      ADD CONSTRAINT school_applications_institution_type_check
      CHECK (institution_type IN (
        'school',
        'college',
        'university',
        'tvet',
        'training_centre',
        'church',
        'mosque',
        'ngo',
        'company',
        'association',
        'cooperative',
        'government',
        'union',
        'other'
      )) NOT VALID;
  END IF;
END
$$;

-- The school category is only meaningful for school applications.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'school_applications_school_category_check'
      AND conrelid = 'public.school_applications'::regclass
  ) THEN
    ALTER TABLE public.school_applications
      ADD CONSTRAINT school_applications_school_category_check
      CHECK (
        (institution_type = 'school' AND school_category IN (
          'Primary',
          'Secondary',
          'Primary and secondary',
          'College or other'
        ))
        OR
        (institution_type <> 'school' AND school_category IS NULL)
      ) NOT VALID;
  END IF;
END
$$;

-- Validate existing rows after installing both safeguards.
ALTER TABLE public.school_applications
  VALIDATE CONSTRAINT school_applications_institution_type_check;
ALTER TABLE public.school_applications
  VALIDATE CONSTRAINT school_applications_school_category_check;
