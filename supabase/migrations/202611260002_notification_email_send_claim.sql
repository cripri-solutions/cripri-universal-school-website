-- Add an explicit in-flight state so concurrent Super Admin retries
-- cannot both send the same application-review notification.
ALTER TABLE public.platform_notifications
  ADD COLUMN IF NOT EXISTS email_claimed_at timestamptz;

ALTER TABLE public.platform_notifications
  DROP CONSTRAINT IF EXISTS platform_notifications_email_status_check;

ALTER TABLE public.platform_notifications
  ADD CONSTRAINT platform_notifications_email_status_check
  CHECK (email_status = ANY (ARRAY[
    'pending'::text,
    'sending'::text,
    'sent'::text,
    'failed'::text,
    'skipped'::text
  ]));
