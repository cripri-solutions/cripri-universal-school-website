-- Preserve universal registration details when an application is approved.
-- Legacy schools remain valid; the existing schools table remains the storage
-- source for the security-invoker public.institutions compatibility view.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS school_category text,
  ADD COLUMN IF NOT EXISTS other_institution_type text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS contact_role text;

COMMENT ON COLUMN public.schools.school_category IS
  'Institution category/level selected at registration; independent of institution_type.';
COMMENT ON COLUMN public.schools.other_institution_type IS
  'Applicant-provided description when institution_type is other.';

-- Keep the institution table's allowlist aligned with the public registration
-- form, including hospitals. Existing institution types remain accepted.
ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_institution_type_check;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_institution_type_check
  CHECK (institution_type IN (
    'school', 'college', 'university', 'tvet', 'training_centre',
    'hospital', 'church', 'mosque', 'ngo', 'company', 'association',
    'cooperative', 'government', 'union', 'other'
  )) NOT VALID;

ALTER TABLE public.schools
  VALIDATE CONSTRAINT schools_institution_type_check;

-- Institution category/level remains independent of institution_type.
ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_school_category_check;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_school_category_check
  CHECK (
    school_category IS NULL
    OR school_category IN (
      'Primary', 'Secondary', 'Primary and secondary', 'College', 'Other'
    )
  ) NOT VALID;

ALTER TABLE public.schools
  VALIDATE CONSTRAINT schools_school_category_check;

ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_other_institution_type_check;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_other_institution_type_check
  CHECK (
    (institution_type = 'other' AND other_institution_type IS NOT NULL
      AND length(trim(other_institution_type)) BETWEEN 2 AND 120)
    OR
    (institution_type <> 'other' AND other_institution_type IS NULL)
  ) NOT VALID;

ALTER TABLE public.schools
  VALIDATE CONSTRAINT schools_other_institution_type_check;

-- Append new fields only; preserve the existing view column order for clients.
CREATE OR REPLACE VIEW public.institutions
WITH (security_invoker = true)
AS
SELECT
  id AS institution_id,
  name,
  slug,
  institution_type,
  status,
  motto,
  description,
  welcome_message,
  physical_address,
  county,
  country,
  contact_phone,
  contact_email,
  logo_path,
  banner_path,
  created_at,
  updated_at,
  school_category,
  other_institution_type,
  region,
  contact_person,
  contact_role
FROM public.schools;

GRANT SELECT ON public.institutions TO anon, authenticated;

-- Keep the existing reviewer authorization, approval audit, and pending
-- activation flow. The additional registration details now follow the
-- approved application into its institution record instead of being lost.
CREATE OR REPLACE FUNCTION public.review_school_application(
  p_application_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS public.school_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_reviewer_id uuid;
  v_decision text;
  v_application public.school_applications%ROWTYPE;
  v_institution_id uuid;
BEGIN
  v_reviewer_id := auth.uid();

  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.platform_reviewers pr
    WHERE pr.user_id = v_reviewer_id
      AND pr.active = true
  ) THEN
    RAISE EXCEPTION 'Active platform reviewer access required';
  END IF;

  v_decision := lower(btrim(coalesce(p_decision, '')));

  IF v_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;

  SELECT a.*
  INTO v_application
  FROM public.school_applications a
  WHERE a.id = p_application_id
    AND a.status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found or has already been reviewed';
  END IF;

  IF v_decision = 'approved' THEN
    INSERT INTO public.schools (
      name,
      slug,
      status,
      institution_type,
      school_category,
      other_institution_type,
      region,
      contact_person,
      contact_role,
      physical_address,
      country,
      contact_phone,
      contact_email
    )
    VALUES (
      v_application.school_name,
      v_application.requested_slug,
      'pending',
      v_application.institution_type,
      v_application.school_category,
      v_application.other_institution_type,
      v_application.region,
      v_application.contact_person,
      v_application.contact_role,
      v_application.physical_address,
      COALESCE(v_application.country, 'Kenya'),
      v_application.contact_phone,
      v_application.contact_email
    )
    RETURNING id INTO v_institution_id;
  END IF;

  -- Insert the audit association before changing status. The AFTER UPDATE
  -- notification trigger reads this exact application-to-institution mapping.
  INSERT INTO public.application_review_audit (
    application_id, school_id, reviewer_id, decision, reason
  )
  VALUES (
    v_application.id, v_institution_id, v_reviewer_id, v_decision,
    NULLIF(btrim(coalesce(p_reason, '')), '')
  );

  UPDATE public.school_applications
  SET status = v_decision,
      reviewed_at = now(),
      reviewed_by = v_reviewer_id,
      review_reason = NULLIF(btrim(coalesce(p_reason, '')), '')
  WHERE id = p_application_id
  RETURNING * INTO v_application;

  RETURN v_application;
END;
$function$;
