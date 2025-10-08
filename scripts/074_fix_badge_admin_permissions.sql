-- Fix badge management RLS policies to allow admin operations
-- This script ensures admins can create, edit, and delete badges

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "user_badges_insert_system_only" ON public.user_badges;

-- Allow admins to manage badges table
CREATE POLICY "badges_admin_manage" ON public.badges
FOR ALL USING (is_admin())
WITH CHECK (is_admin());

-- Allow admins to manage user_badges table (for awarding badges)
CREATE POLICY "user_badges_admin_manage" ON public.user_badges
FOR ALL USING (is_admin())
WITH CHECK (is_admin());

-- Keep the existing select policies for regular users
-- badges_select_all and user_badges_select_all remain unchanged

-- Ensure badges table has RLS enabled
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
