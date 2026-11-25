-- Keep institution applications aligned with the institution types offered
-- by the public registration form. Existing applications default to 'school'.
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
        'school', 'college', 'university', 'tvet', 'training_centre',
        'church', 'mosque', 'ngo', 'company', 'association',
        'cooperative', 'government', 'union', 'other'
      )) NOT VALID;
  END IF;
END
$$;

-- Legacy school applications may have no category. New submissions are
-- required to provide one by the registration form. Non-school applications
-- must always store NULL for this school-specific field.
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
        (institution_type = 'school' AND (
          school_category IS NULL OR school_category IN (
            'Primary',
            'Secondary',
            'Primary and secondary',
            'College or other'
          )
        ))
        OR
        (institution_type <> 'school' AND school_category IS NULL)
      ) NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.school_applications
  VALIDATE CONSTRAINT school_applications_institution_type_check;
ALTER TABLE public.school_applications
  VALIDATE CONSTRAINT school_applications_school_category_check;
