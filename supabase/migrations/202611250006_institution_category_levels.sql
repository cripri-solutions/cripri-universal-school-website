-- Keep institution type and category/level as independent registration fields.
-- Schools and colleges require a UI selection; other types may submit NULL.
ALTER TABLE public.school_applications
  DROP CONSTRAINT IF EXISTS school_applications_school_category_check;

ALTER TABLE public.school_applications
  ADD CONSTRAINT school_applications_school_category_check
  CHECK (
    school_category IS NULL
    OR school_category IN (
      'Primary',
      'Secondary',
      'Primary and secondary',
      'College',
      'Other'
    )
  ) NOT VALID;

ALTER TABLE public.school_applications
  VALIDATE CONSTRAINT school_applications_school_category_check;
