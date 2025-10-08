-- Fix RLS policies to allow admin operations
-- This script adds admin override policies for the admin panel to work properly

-- Drop existing restrictive policies and add admin-friendly ones
DROP POLICY IF EXISTS "users_insert_own" ON "public"."users";
DROP POLICY IF EXISTS "teams_insert_authenticated" ON "public"."teams";

-- Allow admins to insert users (for user creation in admin panel)
CREATE POLICY "users_insert_admin_or_own" ON "public"."users" 
FOR INSERT 
WITH CHECK (
  auth.uid() = id OR 
  auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true AND is_active = true
  )
);

-- Allow admins to update any user
CREATE POLICY "users_update_admin_or_own" ON "public"."users" 
FOR UPDATE 
USING (
  auth.uid() = id OR 
  auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true AND is_active = true
  )
);

-- Allow admins to create teams for any user
CREATE POLICY "teams_insert_admin_or_leader" ON "public"."teams" 
FOR INSERT 
WITH CHECK (
  auth.uid() = team_leader_id OR 
  auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true AND is_active = true
  )
);

-- Allow admins to update any team
CREATE POLICY "teams_update_admin_or_leader" ON "public"."teams" 
FOR UPDATE 
USING (
  auth.uid() = team_leader_id OR 
  auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true AND is_active = true
  )
);

-- Allow admins to delete teams
CREATE POLICY "teams_delete_admin" ON "public"."teams" 
FOR DELETE 
USING (
  auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true AND is_active = true
  )
);

-- Allow admins to delete users
CREATE POLICY "users_delete_admin" ON "public"."users" 
FOR DELETE 
USING (
  auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true AND is_active = true
  )
);
