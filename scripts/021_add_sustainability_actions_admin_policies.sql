-- Add missing RLS policies for sustainability_actions table
-- This fixes the issue where admins cannot create, update, or delete sustainability actions

-- Allow admins to update sustainability actions
-- Updated to use correct permission types: super_admin, system_admin, and manage_content
CREATE POLICY "sustainability_actions_update_admin" ON public.sustainability_actions
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_permissions 
      WHERE permission_type IN ('super_admin', 'system_admin', 'manage_content') AND is_active = true
    )
  );

-- Allow admins to insert sustainability actions  
CREATE POLICY "sustainability_actions_insert_admin" ON public.sustainability_actions
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.admin_permissions 
      WHERE permission_type IN ('super_admin', 'system_admin', 'manage_content') AND is_active = true
    )
  );

-- Allow admins to delete sustainability actions
CREATE POLICY "sustainability_actions_delete_admin" ON public.sustainability_actions
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_permissions 
      WHERE permission_type IN ('super_admin', 'system_admin', 'manage_content') AND is_active = true
    )
  );

-- Also add policies for action_categories table if they don't exist
-- Allow admins to manage action categories
CREATE POLICY "action_categories_insert_admin" ON public.action_categories
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.admin_permissions 
      WHERE permission_type IN ('super_admin', 'system_admin', 'manage_content') AND is_active = true
    )
  );

CREATE POLICY "action_categories_update_admin" ON public.action_categories
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_permissions 
      WHERE permission_type IN ('super_admin', 'system_admin', 'manage_content') AND is_active = true
    )
  );

CREATE POLICY "action_categories_delete_admin" ON public.action_categories
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_permissions 
      WHERE permission_type IN ('super_admin', 'system_admin', 'manage_content') AND is_active = true
    )
  );
