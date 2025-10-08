-- Create storage bucket and policies for action photos
-- This script handles the storage setup that needs admin privileges

-- Create the action-photos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'action-photos', 
  'action-photos', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Create storage policies for the action-photos bucket
-- Policy for uploading photos (users can upload to their own folder)
DROP POLICY IF EXISTS "Users can upload action photos" ON storage.objects;
CREATE POLICY "Users can upload action photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'action-photos' AND 
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for viewing photos (public read access)
DROP POLICY IF EXISTS "Public can view action photos" ON storage.objects;
CREATE POLICY "Public can view action photos" ON storage.objects
FOR SELECT USING (bucket_id = 'action-photos');

-- Policy for updating photos (users can update their own photos)
DROP POLICY IF EXISTS "Users can update their action photos" ON storage.objects;
CREATE POLICY "Users can update their action photos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'action-photos' AND 
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for deleting photos (users can delete their own photos, admins can delete any)
DROP POLICY IF EXISTS "Users can delete their action photos" ON storage.objects;
CREATE POLICY "Users can delete their action photos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'action-photos' AND 
  (
    (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text) OR
    public.is_admin()
  )
);
