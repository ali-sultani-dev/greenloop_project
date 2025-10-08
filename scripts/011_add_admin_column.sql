-- Add admin column to users table
-- This script adds the missing is_admin column that the application expects

-- Add is_admin column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create an index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users(is_admin) WHERE is_admin = TRUE;

-- Add a comment to document the column
COMMENT ON COLUMN public.users.is_admin IS 'Indicates if the user has administrative privileges';
