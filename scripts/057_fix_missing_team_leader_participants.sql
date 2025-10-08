-- Fix missing team leader participants in team challenges
-- Root cause: Team leaders are stored in teams.team_leader_id but not always in team_members table
-- Solution: Ensure all team leaders have corresponding team_members records and update existing challenges

-- =============================================
-- 1. ENSURE ALL TEAM LEADERS ARE IN TEAM_MEMBERS TABLE
-- =============================================

-- Add missing team leaders to team_members table
INSERT INTO team_members (team_id, user_id, role, joined_at)
SELECT 
    t.id as team_id,
    t.team_leader_id as user_id,
    'leader' as role,
    t.created_at as joined_at
FROM teams t
LEFT JOIN team_members tm ON (tm.team_id = t.id AND tm.user_id = t.team_leader_id)
WHERE t.team_leader_id IS NOT NULL
AND t.is_active = true
AND tm.id IS NULL  -- Only insert if leader is not already in team_members
ON CONFLICT (team_id, user_id) DO NOTHING;

-- =============================================
-- 2. UPDATE EXISTING TEAM CHALLENGES TO INCLUDE MISSING LEADERS
-- =============================================

-- Add missing team leader participants to existing team challenges
DO $$
DECLARE
    team_challenge RECORD;
    missing_leader RECORD;
BEGIN
    -- Find team challenges and check for missing leader participants
    FOR team_challenge IN 
        SELECT DISTINCT 
            c.id as challenge_id, 
            cp.team_id,
            t.team_leader_id
        FROM challenges c
        JOIN challenge_participants cp ON c.id = cp.challenge_id
        JOIN teams t ON cp.team_id = t.id
        WHERE c.challenge_type = 'team' 
        AND c.is_active = true
        AND cp.team_id IS NOT NULL
        AND t.team_leader_id IS NOT NULL
    LOOP
        -- Check if team leader is missing from challenge participants
        IF NOT EXISTS (
            SELECT 1 FROM challenge_participants cp2
            WHERE cp2.challenge_id = team_challenge.challenge_id
            AND cp2.user_id = team_challenge.team_leader_id
        ) THEN
            -- Add the missing team leader as a participant
            INSERT INTO challenge_participants (
                challenge_id,
                user_id,
                team_id,
                current_progress,
                completed,
                joined_at
            ) VALUES (
                team_challenge.challenge_id,
                team_challenge.team_leader_id,
                team_challenge.team_id,
                0,
                false,
                NOW()
            ) ON CONFLICT (challenge_id, user_id) DO NOTHING;
            
            RAISE NOTICE 'Added missing team leader % to challenge %', 
                team_challenge.team_leader_id, team_challenge.challenge_id;
        END IF;
    END LOOP;
END $$;

-- =============================================
-- 3. UPDATE CREATE_TEAM_CHALLENGE_PARTICIPANTS FUNCTION
-- =============================================

-- Ensure the function includes team leaders by checking both team_members and teams.team_leader_id
CREATE OR REPLACE FUNCTION create_team_challenge_participants(
    p_challenge_id uuid,
    p_team_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert individual user records for each team member (including leaders)
    INSERT INTO challenge_participants (
        challenge_id,
        user_id,
        team_id,
        current_progress,
        completed,
        joined_at
    )
    SELECT DISTINCT
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
    
    UNION
    
    -- Also ensure team leader is included (in case they're not in team_members)
    SELECT DISTINCT
        p_challenge_id,
        t.team_leader_id,
        p_team_id,
        0,
        false,
        NOW()
    FROM teams t
    JOIN users u ON t.team_leader_id = u.id
    WHERE t.id = p_team_id
    AND t.team_leader_id IS NOT NULL
    AND t.is_active = true
    AND u.is_active = true
    
    ON CONFLICT (challenge_id, user_id) DO NOTHING;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_team_challenge_participants(uuid, uuid) TO authenticated;

-- =============================================
-- 4. CREATE TRIGGER TO ENSURE TEAM LEADERS ARE ALWAYS IN TEAM_MEMBERS
-- =============================================

-- Function to automatically add team leaders to team_members when teams are created/updated
CREATE OR REPLACE FUNCTION ensure_team_leader_in_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- When a team is created or team_leader_id is updated
    IF NEW.team_leader_id IS NOT NULL THEN
        INSERT INTO team_members (team_id, user_id, role, joined_at)
        VALUES (NEW.id, NEW.team_leader_id, 'leader', COALESCE(NEW.created_at, NOW()))
        ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'leader';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to ensure team leaders are always in team_members
DROP TRIGGER IF EXISTS ensure_team_leader_trigger ON teams;
CREATE TRIGGER ensure_team_leader_trigger
    AFTER INSERT OR UPDATE OF team_leader_id ON teams
    FOR EACH ROW
    EXECUTE FUNCTION ensure_team_leader_in_members();

-- =============================================
-- 5. VERIFICATION AND LOGGING
-- =============================================

DO $$
DECLARE
    team_count INTEGER;
    leader_count INTEGER;
    missing_count INTEGER;
BEGIN
    -- Count total teams
    SELECT COUNT(*) INTO team_count FROM teams WHERE is_active = true AND team_leader_id IS NOT NULL;
    
    -- Count team leaders in team_members
    SELECT COUNT(DISTINCT tm.team_id) INTO leader_count 
    FROM team_members tm 
    JOIN teams t ON tm.team_id = t.id 
    WHERE tm.user_id = t.team_leader_id 
    AND t.is_active = true 
    AND t.team_leader_id IS NOT NULL;
    
    missing_count := team_count - leader_count;
    
    RAISE NOTICE '=== TEAM LEADER PARTICIPANT FIX COMPLETED ===';
    RAISE NOTICE 'Total active teams with leaders: %', team_count;
    RAISE NOTICE 'Teams with leaders in team_members: %', leader_count;
    RAISE NOTICE 'Missing leaders fixed: %', missing_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '1. Added missing team leaders to team_members table';
    RAISE NOTICE '2. Added missing team leader participants to existing challenges';
    RAISE NOTICE '3. Updated create_team_challenge_participants function to ensure leaders are included';
    RAISE NOTICE '4. Created trigger to automatically add future team leaders to team_members';
    RAISE NOTICE '';
    RAISE NOTICE 'Team challenges should now show correct member counts including leaders!';
END $$;
