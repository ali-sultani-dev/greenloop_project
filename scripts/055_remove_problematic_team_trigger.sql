-- Remove the problematic auto_assign_team_challenge trigger and function
-- The API already handles team assignment through create_team_challenge_participants function

-- Drop the trigger first to avoid dependency errors
DROP TRIGGER IF EXISTS auto_assign_team_challenge_trigger ON challenges;

-- Drop the problematic function that tries to access NEW.team_id (which doesn't exist)
DROP FUNCTION IF EXISTS auto_assign_team_challenge();

-- Also drop the assign_team_to_challenge function since it's not needed
-- The API uses create_team_challenge_participants instead
DROP FUNCTION IF EXISTS assign_team_to_challenge(uuid, uuid);

-- Ensure the create_team_challenge_participants function exists and works correctly
-- This is the function the API actually calls
CREATE OR REPLACE FUNCTION create_team_challenge_participants(
    p_challenge_id uuid,
    p_team_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert individual user records for each team member
    -- This matches what the API expects and satisfies the constraint
    INSERT INTO challenge_participants (
        challenge_id,
        user_id,
        team_id,
        current_progress,
        completed,
        joined_at
    )
    SELECT 
        p_challenge_id,
        tm.user_id,
        p_team_id,
        0,
        false,
        NOW()
    FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    JOIN users u ON tm.user_id = u.id
    WHERE tm.team_id = p_team_id
    AND t.is_active = true
    AND u.is_active = true
    ON CONFLICT (challenge_id, user_id) DO NOTHING;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_team_challenge_participants(uuid, uuid) TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'Removed problematic auto_assign_team_challenge trigger and function!';
    RAISE NOTICE 'Team challenges now work through API-called create_team_challenge_participants function only.';
END $$;
