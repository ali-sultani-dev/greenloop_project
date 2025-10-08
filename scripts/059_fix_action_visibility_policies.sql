-- Fix RLS policies for sustainability_actions to restore visibility of admin-created actions

-- Drop the conflicting policy that's preventing users from seeing admin-created actions
DROP POLICY IF EXISTS "Users can view their own submitted actions" ON "public"."sustainability_actions";

-- Create a new policy that allows users to see:
-- 1. All active admin-created actions (is_user_created = false AND is_active = true)
-- 2. Their own user-created actions regardless of status
CREATE POLICY "Users can view active actions and own submissions" ON "public"."sustainability_actions" 
FOR SELECT USING (
  (is_active = true) OR 
  (is_user_created = true AND submitted_by = auth.uid())
);

-- Also drop the old general select policy that might be conflicting
DROP POLICY IF EXISTS "sustainability_actions_select_all" ON "public"."sustainability_actions";
