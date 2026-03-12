-- Migration: Add auto-approval threshold setting for sustainability actions
-- Description: Actions with points_value below this threshold will be auto-approved
-- Actions above the threshold will require manual admin approval

-- Add the auto-approval threshold setting
INSERT INTO system_settings (key, setting_value, data_type, category, description, updated_at)
VALUES (
  'action_auto_approve_threshold',
  '0',
  'number',
  'actions',
  'Actions with points value at or below this threshold will be auto-approved. Set to 0 to require approval for all actions.'
  , NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Add a comment explaining the setting
COMMENT ON TABLE system_settings IS 'System-wide configuration settings including action_auto_approve_threshold for controlling auto-approval of logged actions';
