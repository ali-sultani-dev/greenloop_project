-- Migration: Fix auto-approval threshold visibility for all users
-- Problem: action_auto_approve_threshold has is_public = false, so non-admin users
--          cannot read it via RLS. This causes the /api/actions/log route to fall
--          back to threshold = 0, disabling auto-approval for all regular users.
-- Fix: Mark the setting as public (read-only for all authenticated users) so the
--      action logging API can read it regardless of who is submitting the action.

UPDATE public.system_settings
SET is_public = true
WHERE key = 'action_auto_approve_threshold';

-- Also ensure the row exists with the correct value if it was somehow missing
INSERT INTO public.system_settings (key, setting_value, data_type, category, description, is_public, updated_at)
VALUES (
  'action_auto_approve_threshold',
  '0',
  'number',
  'actions',
  'Actions with points value at or below this threshold will be auto-approved. Set to 0 to require approval for all actions.',
  true,
  NOW()
)
ON CONFLICT (key) DO UPDATE
  SET is_public = true,
      updated_at = NOW();
