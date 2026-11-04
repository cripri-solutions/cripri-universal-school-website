-- CRIPRI UNIVERSAL SCHOOL WEBSITE
-- STAGE 3: REGISTRATION DETAILS AND REVIEW SECURITY FOUNDATION
-- Applied successfully to the dedicated CRIPRI Platform Supabase project.
-- Stages 1 and 2 were already installed before this migration.
--
-- This migration records the schema change that was applied manually
-- through the Supabase SQL Editor. Do not rerun it on the already-updated
-- project; ADD COLUMN IF NOT EXISTS is safe, but the constraint/grants
-- are intended as a migration record and must be reviewed before reuse.

ALTER TABLE public.school_applications
  ADD COLUMN IF NOT EXISTS school_category text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS physical_address text,
  ADD COLUMN IF NOT EXISTS contact_role text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_reason text;

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
      'College or other'
    )
  );

CREATE TABLE IF NOT EXISTS public.platform_reviewers (
  user_id uuid PRIMARY KEY
    REFERENCES auth.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_reviewers
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_reviewers
  FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.application_review_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL
    REFERENCES public.school_applications(id) ON DELETE RESTRICT,
  school_id uuid
    REFERENCES public.schools(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE RESTRICT,
  decision text NOT NULL
    CHECK (decision IN ('approved', 'rejected')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
  application_review_audit_application_idx
ON public.application_review_audit (
  application_id,
  created_at DESC
);

ALTER TABLE public.application_review_audit
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.application_review_audit
  FROM anon, authenticated;

REVOKE INSERT (
  school_name,
  contact_person,
  contact_email,
  contact_phone,
  requested_slug,
  message
)
ON public.school_applications
FROM anon, authenticated;

GRANT INSERT (
  school_name,
  contact_person,
  contact_email,
  contact_phone,
  requested_slug,
  message,
  school_category,
  country,
  region,
  physical_address,
  contact_role
)
ON public.school_applications
TO anon, authenticated;
