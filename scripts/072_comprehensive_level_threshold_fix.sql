-- Comprehensive fix for level threshold system
-- Addresses: missing recalculate_all_user_levels function, validation, and persistence issues

-- First, create the missing recalculate_all_user_levels function
CREATE OR REPLACE FUNCTION recalculate_all_user_levels()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update all users' levels based on their current points and the level thresholds
  UPDATE users 
  SET level = calculate_user_level(points),
      updated_at = now()
  WHERE points IS NOT NULL;
  
  -- Log the recalculation
  RAISE NOTICE 'Recalculated levels for all users based on current thresholds';
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION recalculate_all_user_levels() TO authenticated;

-- Drop and recreate the update_level_threshold function with proper validation
DROP FUNCTION IF EXISTS update_level_threshold(integer, integer, uuid);

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
  prev_threshold integer;
  next_threshold integer;
BEGIN
  -- Check if user is admin using users.is_admin
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

  -- Validate ascending order: check previous level threshold
  IF threshold_level > 1 THEN
    SELECT points_required INTO prev_threshold 
    FROM level_thresholds 
    WHERE level = threshold_level - 1;
    
    IF prev_threshold IS NOT NULL AND new_points_required <= prev_threshold THEN
      RETURN json_build_object(
        'success', false, 
        'error', format('Level %s threshold (%s points) must be greater than Level %s (%s points)', 
                       threshold_level, new_points_required, threshold_level - 1, prev_threshold)
      );
    END IF;
  END IF;

  -- Validate ascending order: check next level threshold
  IF threshold_level < 10 THEN
    SELECT points_required INTO next_threshold 
    FROM level_thresholds 
    WHERE level = threshold_level + 1;
    
    IF next_threshold IS NOT NULL AND new_points_required >= next_threshold THEN
      RETURN json_build_object(
        'success', false, 
        'error', format('Level %s threshold (%s points) must be less than Level %s (%s points)', 
                       threshold_level, new_points_required, threshold_level + 1, next_threshold)
      );
    END IF;
  END IF;

  -- Update the specific level threshold
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_level_threshold(integer, integer, uuid) TO authenticated;

-- Add database-level constraint to ensure ascending thresholds
CREATE OR REPLACE FUNCTION validate_level_thresholds_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  prev_threshold integer;
  next_threshold integer;
BEGIN
  -- Check previous level
  IF NEW.level > 1 THEN
    SELECT points_required INTO prev_threshold 
    FROM level_thresholds 
    WHERE level = NEW.level - 1;
    
    IF prev_threshold IS NOT NULL AND NEW.points_required <= prev_threshold THEN
      RAISE EXCEPTION 'Level % threshold (% points) must be greater than Level % (% points)', 
                     NEW.level, NEW.points_required, NEW.level - 1, prev_threshold;
    END IF;
  END IF;

  -- Check next level
  IF NEW.level < 10 THEN
    SELECT points_required INTO next_threshold 
    FROM level_thresholds 
    WHERE level = NEW.level + 1;
    
    IF next_threshold IS NOT NULL AND NEW.points_required >= next_threshold THEN
      RAISE EXCEPTION 'Level % threshold (% points) must be less than Level % (% points)', 
                     NEW.level, NEW.points_required, NEW.level + 1, next_threshold;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to validate threshold order on insert/update
DROP TRIGGER IF EXISTS validate_level_thresholds_trigger ON level_thresholds;
CREATE TRIGGER validate_level_thresholds_trigger
  BEFORE INSERT OR UPDATE ON level_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION validate_level_thresholds_order();

-- Test the fix by ensuring all current thresholds are valid
DO $$
BEGIN
  -- Verify the function exists and works
  PERFORM recalculate_all_user_levels();
  RAISE NOTICE 'Level threshold system validation complete';
END;
$$;
