-- Fix any remaining team_id column references in challenges table
-- The team_id should only exist in challenge_participants table

-- Update any views or functions that incorrectly reference challenges.team_id
DROP VIEW IF EXISTS challenges_public;

-- Recreate the challenges_public view without team_id reference
CREATE VIEW challenges_public AS
SELECT 
  id,
  title,
  description,
  challenge_type,
  category,
  start_date,
  end_date,
  reward_points,
  target_metric,
  target_value,
  reward_description,
  max_participants,
  is_active,
  created_by,
  created_at
  -- Removed updated_at column reference as it doesn't exist in challenges table
FROM challenges
WHERE is_active = true;

-- Grant appropriate permissions
GRANT SELECT ON challenges_public TO authenticated;

-- Update the safe_check_max_participants function to not reference team_id from challenges
CREATE OR REPLACE FUNCTION safe_check_max_participants(challenge_id_param UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  max_participants_count INTEGER;
  current_participants_count INTEGER;
BEGIN
  -- Get max participants from challenges table
  SELECT max_participants INTO max_participants_count
  FROM challenges 
  WHERE id = challenge_id_param;
  
  -- If no limit set, return a high number
  IF max_participants_count IS NULL THEN
    RETURN 999999;
  END IF;
  
  -- Count current participants
  SELECT COUNT(*) INTO current_participants_count
  FROM challenge_participants 
  WHERE challenge_id = challenge_id_param;
  
  -- Return remaining spots
  RETURN max_participants_count - current_participants_count;
END;
$$;
