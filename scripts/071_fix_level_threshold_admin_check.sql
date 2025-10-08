-- Fix the admin check in update_level_threshold function
-- The function was checking user_profiles.role = 'admin' but the app uses users.is_admin

-- Drop the existing function first
DROP FUNCTION IF EXISTS update_level_threshold(integer, integer, uuid);

-- Recreate the function with correct admin check using users.is_admin
CREATE OR REPLACE FUNCTION update_level_threshold(
  threshold_level integer,
  new_points_required integer,
  admin_user_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- Check if user is admin using users.is_admin instead of user_profiles.role
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = admin_user_id AND is_admin = true
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: Admin access required');
  END IF;

  -- Validate input parameters
  IF threshold_level < 1 OR threshold_level > 10 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid level: must be between 1 and 10');
  END IF;

  IF new_points_required < 0 OR new_points_required > 1000000 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid points: must be between 0 and 1,000,000');
  END IF;

  -- Update the specific level threshold with proper WHERE clause
  UPDATE level_thresholds 
  SET points_required = new_points_required,
      updated_at = now()
  WHERE level = threshold_level;

  -- Check if the update was successful
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Level threshold not found');
  END IF;

  -- Recalculate all user levels based on new thresholds
  PERFORM recalculate_all_user_levels();

  -- Return success response
  RETURN json_build_object(
    'success', true, 
    'message', 'Level threshold updated successfully',
    'level', threshold_level,
    'new_points_required', new_points_required
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION update_level_threshold(integer, integer, uuid) TO authenticated;
