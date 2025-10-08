-- Final fix for user action submission RLS policies
-- This addresses the 403 Unauthorized errors when users try to submit actions

-- 1. First, let's check if the photo_url column exists and add it if not
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sustainability_actions' 
        AND column_name = 'photo_url'
    ) THEN
        ALTER TABLE public.sustainability_actions 
        ADD COLUMN photo_url text;
        
        COMMENT ON COLUMN public.sustainability_actions.photo_url 
        IS 'URL of uploaded photo proof for user-submitted actions';
    END IF;
END $$;

-- 2. Drop ALL existing conflicting RLS policies to start fresh
DROP POLICY IF EXISTS "sustainability_actions_select" ON public.sustainability_actions;
DROP POLICY IF EXISTS "sustainability_actions_insert" ON public.sustainability_actions;
DROP POLICY IF EXISTS "sustainability_actions_update" ON public.sustainability_actions;
DROP POLICY IF EXISTS "sustainability_actions_delete" ON public.sustainability_actions;
DROP POLICY IF EXISTS "sustainability_actions_admin_insert" ON public.sustainability_actions;
DROP POLICY IF EXISTS "sustainability_actions_admin_update" ON public.sustainability_actions;
DROP POLICY IF EXISTS "sustainability_actions_admin_delete" ON public.sustainability_actions;
DROP POLICY IF EXISTS "Users can create their own actions" ON public.sustainability_actions;
DROP POLICY IF EXISTS "Users can view active actions and own submissions" ON public.sustainability_actions;
DROP POLICY IF EXISTS "Users can update their rejected submissions" ON public.sustainability_actions;
DROP POLICY IF EXISTS "Admins can manage user submissions" ON public.sustainability_actions;

-- 3. Create simple, working RLS policies
-- Allow users to see active actions and their own submissions
CREATE POLICY "sustainability_actions_select_policy" ON public.sustainability_actions
FOR SELECT USING (
  is_active = true OR 
  (submitted_by = auth.uid()) OR 
  public.is_admin()
);

-- Allow users to insert their own submissions and admins to insert anything
CREATE POLICY "sustainability_actions_insert_policy" ON public.sustainability_actions
FOR INSERT WITH CHECK (
  public.is_admin() OR 
  (
    submitted_by = auth.uid() AND 
    is_user_created = true AND 
    is_active = false AND 
    verification_required = true
  )
);

-- Allow admins to update anything, users to update their rejected submissions
CREATE POLICY "sustainability_actions_update_policy" ON public.sustainability_actions
FOR UPDATE USING (
  public.is_admin() OR 
  (
    submitted_by = auth.uid() AND 
    is_user_created = true AND 
    is_active = false
  )
) WITH CHECK (
  public.is_admin() OR 
  (
    submitted_by = auth.uid() AND 
    is_user_created = true AND 
    is_active = false
  )
);

-- Only admins can delete
CREATE POLICY "sustainability_actions_delete_policy" ON public.sustainability_actions
FOR DELETE USING (public.is_admin());

-- 4. Ensure proper grants
GRANT SELECT, INSERT, UPDATE ON public.sustainability_actions TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 5. Create storage bucket for action photos if it doesn't exist
-- Note: This needs to be run in Supabase dashboard or via admin client
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('action-photos', 'action-photos', true)
-- ON CONFLICT (id) DO NOTHING;

-- 6. Create storage policies for action-photos bucket
-- Note: These policies need to be created in the storage schema
-- CREATE POLICY "Users can upload action photos" ON storage.objects
-- FOR INSERT WITH CHECK (
--   bucket_id = 'action-photos' AND 
--   auth.uid()::text = (storage.foldername(name))[1]
-- );

-- CREATE POLICY "Public can view action photos" ON storage.objects
-- FOR SELECT USING (bucket_id = 'action-photos');

-- 7. Ensure the is_admin function exists and works correctly
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = COALESCE(user_uuid, auth.uid())
    AND is_admin = true 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- 8. Add helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_sustainability_actions_user_submissions 
ON public.sustainability_actions (submitted_by, is_user_created, is_active) 
WHERE is_user_created = true;

CREATE INDEX IF NOT EXISTS idx_sustainability_actions_active 
ON public.sustainability_actions (is_active, verification_required) 
WHERE is_active = true;
