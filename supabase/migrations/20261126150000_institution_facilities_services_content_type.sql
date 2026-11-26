-- Add institution-specific facilities and services to the existing content pipeline.
-- This is a development-branch migration only; do not apply to production until
-- the historical migration ledger and backup blockers are resolved.
ALTER TABLE public.school_content_items
  DROP CONSTRAINT IF EXISTS school_content_items_content_type_check;

ALTER TABLE public.school_content_items
  ADD CONSTRAINT school_content_items_content_type_check
  CHECK (
    content_type = ANY (
      ARRAY[
        'announcement',
        'event',
        'vacancy',
        'gallery',
        'live_update',
        'live_stream',
        'facility_service'
      ]::text[]
    )
  );
