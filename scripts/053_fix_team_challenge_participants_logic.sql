-- Fix team challenge participant assignment logic
-- This script fixes the check constraint violation by ensuring team challenges
-- only set team_id and leave user_id as NULL

-- Drop trigger first to avoid dependency error
DROP TRIGGER IF EXISTS auto_assign_team_challenge_trigger ON challenges;

-- Drop and recreate the assign_team_to_challenge function with correct logic
DROP FUNCTION IF EXISTS assign_team_to_challenge(uuid, uuid);

CREATE OR REPLACE FUNCTION assign_team_to_challenge(
    p_challenge_id uuid,
    p_team_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- For team challenges, insert one record per team with team_id set and user_id as NULL
    -- This satisfies the check constraint: (user_id IS NOT NULL AND team_id IS NULL) OR (user_id IS NULL AND team_id IS NOT NULL)
    INSERT INTO challenge_participants (challenge_id, user_id, team_id)
    VALUES (p_challenge_id, NULL, p_team_id)
    ON CONFLICT (challenge_id, user_id, team_id) DO NOTHING;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION assign_team_to_challenge(uuid, uuid) TO authenticated;

-- Update the auto_assign_team_challenge function to use the corrected logic
DROP FUNCTION IF EXISTS auto_assign_team_challenge();

CREATE OR REPLACE FUNCTION auto_assign_team_challenge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only auto-assign for team challenges
    IF NEW.challenge_type = 'team' AND NEW.team_id IS NOT NULL THEN
        -- Call the fixed assign function
        PERFORM assign_team_to_challenge(NEW.id, NEW.team_id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION auto_assign_team_challenge() TO authenticated;

-- Recreate the trigger after functions are ready
CREATE TRIGGER auto_assign_team_challenge_trigger
    AFTER INSERT ON challenges
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_team_challenge();
