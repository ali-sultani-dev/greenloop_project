-- Add support for user-submitted actions and mandatory photo uploads

-- Add new columns to sustainability_actions table
ALTER TABLE sustainability_actions 
ADD COLUMN IF NOT EXISTS is_user_created boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS auto_logged_for_submitter boolean DEFAULT false;

-- Add photo_url column to user_actions table for mandatory photo uploads
ALTER TABLE user_actions 
ADD COLUMN IF NOT EXISTS photo_url text;

-- Create index for better performance on user-created actions
CREATE INDEX IF NOT EXISTS idx_sustainability_actions_user_created 
ON sustainability_actions(is_user_created, submitted_by) 
WHERE is_user_created = true;

-- Create index for pending user submissions
CREATE INDEX IF NOT EXISTS idx_sustainability_actions_pending_submissions 
ON sustainability_actions(is_user_created, is_active, submitted_by) 
WHERE is_user_created = true AND is_active = false;

-- Update RLS policies for user-created actions

-- Policy for users to create their own actions (inactive by default)
CREATE POLICY "Users can create their own actions" ON sustainability_actions
FOR INSERT WITH CHECK (
  auth.uid() = submitted_by AND 
  is_user_created = true AND 
  is_active = false AND
  verification_required = true
);

-- Policy for users to view their own submitted actions
CREATE POLICY "Users can view their own submitted actions" ON sustainability_actions
FOR SELECT USING (
  (is_active = true) OR 
  (is_user_created = true AND submitted_by = auth.uid())
);

-- Policy for users to update their own rejected submissions
CREATE POLICY "Users can update their rejected submissions" ON sustainability_actions
FOR UPDATE USING (
  is_user_created = true AND 
  submitted_by = auth.uid() AND 
  is_active = false AND
  rejection_reason IS NOT NULL
) WITH CHECK (
  is_user_created = true AND 
  submitted_by = auth.uid() AND 
  is_active = false
);

-- Admin policies for managing user submissions
CREATE POLICY "Admins can manage user submissions" ON sustainability_actions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'is_admin' = 'true'
  )
);

-- Update user_actions policies to require photo for new submissions
-- (This will be enforced in the application logic)

COMMENT ON COLUMN sustainability_actions.is_user_created IS 'True if this action was submitted by a user rather than created by admin';
COMMENT ON COLUMN sustainability_actions.submitted_by IS 'User ID who submitted this action (for user-created actions)';
COMMENT ON COLUMN sustainability_actions.rejection_reason IS 'Reason provided by admin if action was rejected';
COMMENT ON COLUMN sustainability_actions.auto_logged_for_submitter IS 'True if this action was automatically logged for the submitter when approved';
COMMENT ON COLUMN user_actions.photo_url IS 'URL of uploaded photo proof for the action';
