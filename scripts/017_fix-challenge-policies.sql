-- Fix challenge RLS policies to allow admin operations
-- This ensures admins can create challenges for any user

-- Drop existing restrictive challenge policies
DROP POLICY IF EXISTS "challenges_insert_authenticated" ON "public"."challenges";
DROP POLICY IF EXISTS "challenges_update_creator" ON "public"."challenges";

-- Allow admins to create challenges for any user
CREATE POLICY "challenges_insert_admin_or_creator" ON "public"."challenges" 
FOR INSERT 
WITH CHECK (
  auth.uid() = created_by OR 
  auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true AND is_active = true
  )
);

-- Allow admins to update any challenge
CREATE POLICY "challenges_update_admin_or_creator" ON "public"."challenges" 
FOR UPDATE 
USING (
  auth.uid() = created_by OR 
  auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true AND is_active = true
  )
);

-- Allow admins to delete challenges
CREATE POLICY "challenges_delete_admin" ON "public"."challenges" 
FOR DELETE 
USING (
  auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true AND is_active = true
  )
);
