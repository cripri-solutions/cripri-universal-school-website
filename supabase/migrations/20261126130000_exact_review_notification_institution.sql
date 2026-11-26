-- Associate review notifications with the exact institution recorded by the
-- review transaction. The audit row must be inserted before the application
-- status UPDATE because its AFTER UPDATE trigger runs synchronously.

CREATE OR REPLACE FUNCTION public.create_school_review_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_school_id uuid;
  v_institution_label text;
  v_title text;
  v_message text;
  v_event text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('approved', 'rejected') THEN

    SELECT ara.school_id
    INTO v_school_id
    FROM public.application_review_audit ara
    WHERE ara.application_id = NEW.id
      AND ara.decision = NEW.status
    ORDER BY ara.created_at DESC, ara.id DESC
    LIMIT 1;

    v_institution_label := CASE NEW.institution_type
      WHEN 'school' THEN 'school'
      WHEN 'college' THEN 'college'
      WHEN 'university' THEN 'university'
      WHEN 'tvet' THEN 'TVET institution'
      WHEN 'training_centre' THEN 'training centre'
      WHEN 'hospital' THEN 'hospital'
      WHEN 'church' THEN 'church'
      WHEN 'mosque' THEN 'mosque'
      WHEN 'union' THEN 'union'
      WHEN 'association' THEN 'association'
      WHEN 'ngo' THEN 'NGO'
      WHEN 'cooperative' THEN 'cooperative'
      WHEN 'company' THEN 'company'
      WHEN 'government' THEN 'government institution'
      ELSE 'institution'
    END;

    v_event := CASE WHEN NEW.status = 'approved'
      THEN 'application_approved' ELSE 'application_rejected' END;
    v_title := CASE WHEN NEW.status = 'approved'
      THEN 'Institution application approved' ELSE 'Institution application update' END;
    v_message := CASE WHEN NEW.status = 'approved'
      THEN format('Your application for %s (%s) has been approved by CRIPRI. The next step is institution activation and onboarding.', NEW.school_name, v_institution_label)
      ELSE format('There is an update to your application for %s (%s). Please contact CRIPRI for further information.', NEW.school_name, v_institution_label)
    END;

    INSERT INTO public.platform_notifications
      (application_id, school_id, institution_type, event_type, title, message, recipient_email)
    VALUES
      (NEW.id, v_school_id, NEW.institution_type, v_event, v_title, v_message, NEW.contact_email)
    ON CONFLICT (application_id, event_type) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
