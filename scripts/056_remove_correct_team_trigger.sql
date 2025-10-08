-- Remove the actual problematic trigger that's causing the team_id error
-- The trigger "trigger_auto_assign_team_members" calls auto_assign_team_members_to_challenge()
-- which tries to access NEW.team_id but challenges table doesn't have team_id column

-- Drop the trigger first
DROP TRIGGER IF EXISTS trigger_auto_assign_team_members ON challenges;

-- Drop the problematic function
DROP FUNCTION IF EXISTS auto_assign_team_members_to_challenge();

-- Ensure the create_team_challenge_participants function exists and works correctly
-- This is what the API actually calls for team challenges
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
    RAISE NOTICE 'Removed trigger_auto_assign_team_members trigger and auto_assign_team_members_to_challenge function!';
    RAISE NOTICE 'Team challenges now work through API-called create_team_challenge_participants function only.';
END $$;
