-- Fix team challenge participant creation
-- This script ensures team challenges create proper participant records

-- Update existing team challenge participants to have proper constraint compliance
UPDATE challenge_participants 
SET user_id = NULL 
WHERE team_id IS NOT NULL AND user_id IS NOT NULL;

-- Create a function to properly handle team challenge participant creation
CREATE OR REPLACE FUNCTION create_team_challenge_participants(
  p_challenge_id UUID,
  p_team_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Delete any existing participants for this challenge
  DELETE FROM challenge_participants 
  WHERE challenge_id = p_challenge_id;
  
  -- Insert a single team participant record (not individual user records)
  INSERT INTO challenge_participants (
    challenge_id,
    user_id,
    team_id,
    current_progress,
    completed,
    joined_at
  ) VALUES (
    p_challenge_id,
    NULL,
    p_team_id,
    0,
    false,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_team_challenge_participants(UUID, UUID) TO authenticated;
