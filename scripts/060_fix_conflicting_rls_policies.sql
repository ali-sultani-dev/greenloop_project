-- Fix conflicting RLS policies for sustainability_actions table
-- The issue is that there are two INSERT policies that conflict

-- First, drop the conflicting admin-only insert policy
DROP POLICY IF EXISTS "sustainability_actions_admin_insert" ON "public"."sustainability_actions";

-- Update the user insert policy to be more comprehensive
DROP POLICY IF EXISTS "Users can create their own actions" ON "public"."sustainability_actions";

-- Create a single comprehensive insert policy that handles both admin and user inserts
CREATE POLICY "sustainability_actions_insert_policy" ON "public"."sustainability_actions" 
FOR INSERT WITH CHECK (
  -- Allow admins to insert any action
  (public.is_admin()) OR 
  -- Allow users to insert their own user-created actions with proper constraints
  (
    auth.uid() = submitted_by AND 
    is_user_created = true AND 
    is_active = false AND 
    verification_required = true
  )
);

-- Also ensure the select policy allows users to see active actions and their own submissions
DROP POLICY IF EXISTS "sustainability_actions_select_all" ON "public"."sustainability_actions";
DROP POLICY IF EXISTS "Users can view their own submitted actions" ON "public"."sustainability_actions";

CREATE POLICY "sustainability_actions_select_policy" ON "public"."sustainability_actions" 
FOR SELECT USING (
  -- Allow authenticated users to see active actions
  (auth.role() = 'authenticated' AND is_active = true) OR
  -- Allow users to see their own submissions (active or pending)
  (auth.uid() = submitted_by AND is_user_created = true) OR
  -- Allow admins to see everything
  (public.is_admin())
);
