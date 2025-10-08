-- Fix all issues preventing user action submission

-- 1. Add missing photo_url column to sustainability_actions table (nullable for admin flexibility)
ALTER TABLE public.sustainability_actions 
ADD COLUMN IF NOT EXISTS photo_url text;

COMMENT ON COLUMN public.sustainability_actions.photo_url IS 'URL of uploaded photo proof for user-submitted actions (nullable for admin-created templates)';

-- 2. Drop all conflicting RLS policies and create clean ones
DROP POLICY IF EXISTS "Users can create their own actions" ON public.sustainability_actions;
DROP POLICY IF EXISTS "Users can view active actions and own submissions" ON public.sustainability_actions;
DROP POLICY IF EXISTS "Users can update their rejected submissions" ON public.sustainability_actions;
DROP POLICY IF EXISTS "Admins can manage user submissions" ON public.sustainability_actions;
DROP POLICY IF EXISTS "sustainability_actions_admin_delete" ON public.sustainability_actions;
DROP POLICY IF EXISTS "sustainability_actions_admin_update" ON public.sustainability_actions;
DROP POLICY IF EXISTS "sustainability_actions_insert_policy" ON public.sustainability_actions;
DROP POLICY IF EXISTS "sustainability_actions_select_policy" ON public.sustainability_actions;

-- 3. Create clean, non-conflicting RLS policies
CREATE POLICY "sustainability_actions_select" ON public.sustainability_actions
FOR SELECT USING (
  -- Users can see active actions OR their own submissions OR if they're admin
  (is_active = true) OR 
  (is_user_created = true AND submitted_by = auth.uid()) OR 
  public.is_admin()
);

CREATE POLICY "sustainability_actions_insert" ON public.sustainability_actions
FOR INSERT WITH CHECK (
  -- Admins can insert any action OR users can submit their own actions
  public.is_admin() OR 
  (
    auth.uid() = submitted_by AND 
    is_user_created = true AND 
    is_active = false AND 
    verification_required = true
  )
);

CREATE POLICY "sustainability_actions_update" ON public.sustainability_actions
FOR UPDATE USING (
  -- Admins can update any action OR users can update their rejected submissions
  public.is_admin() OR 
  (
    is_user_created = true AND 
    submitted_by = auth.uid() AND 
    is_active = false AND 
    rejection_reason IS NOT NULL
  )
) WITH CHECK (
  -- Same conditions for the updated row
  public.is_admin() OR 
  (
    is_user_created = true AND 
    submitted_by = auth.uid() AND 
    is_active = false
  )
);

CREATE POLICY "sustainability_actions_delete" ON public.sustainability_actions
FOR DELETE USING (public.is_admin());

-- 4. Ensure proper grants for authenticated users
GRANT SELECT, INSERT, UPDATE ON public.sustainability_actions TO authenticated;
GRANT SELECT ON public.action_categories TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

-- 5. Create index for better performance on user submissions
CREATE INDEX IF NOT EXISTS idx_sustainability_actions_user_submissions 
ON public.sustainability_actions (submitted_by, is_user_created, is_active) 
WHERE is_user_created = true;
