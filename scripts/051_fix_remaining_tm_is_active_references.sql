-- Fix remaining tm.is_active references in functions from script 049
-- This addresses the "column tm.is_active does not exist" error when creating team challenges

-- =============================================
-- FIX assign_team_to_challenge FUNCTION
-- =============================================

-- Drop and recreate the function with correct column references
DROP FUNCTION IF EXISTS assign_team_to_challenge(UUID, UUID);

CREATE OR REPLACE FUNCTION assign_team_to_challenge(
    challenge_uuid UUID,
    team_uuid UUID
)
RETURNS VOID AS $$
DECLARE
    team_member RECORD;
BEGIN
    -- Insert all team members as participants
    -- Fixed tm.is_active reference by joining with users table to check u.is_active
    FOR team_member IN 
        SELECT tm.user_id 
        FROM public.team_members tm
        JOIN public.teams t ON tm.team_id = t.id
        JOIN public.users u ON tm.user_id = u.id
        WHERE t.id = team_uuid 
        AND t.is_active = true
        AND u.is_active = true  -- Fixed: use u.is_active instead of tm.is_active
    LOOP
        INSERT INTO public.challenge_participants (
            challenge_id,
            user_id,
            team_id,
            current_progress,
            completed,
            joined_at
        ) VALUES (
            challenge_uuid,
            team_member.user_id,
            team_uuid,
            0,
            false,
            NOW()
        ) ON CONFLICT (challenge_id, user_id) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION assign_team_to_challenge(UUID, UUID) TO authenticated;

-- =============================================
-- FIX auto_assign_team_challenge FUNCTION
-- =============================================

-- Drop trigger first to avoid dependency error
DROP TRIGGER IF EXISTS auto_assign_team_challenge_trigger ON public.challenges;

-- Drop and recreate the function with correct column references
DROP FUNCTION IF EXISTS auto_assign_team_challenge();

CREATE OR REPLACE FUNCTION auto_assign_team_challenge()
RETURNS TRIGGER AS $$
DECLARE
    target_team_id UUID;
BEGIN
    -- Only process team challenges
    IF NEW.challenge_type = 'team' THEN
        -- Find the team this challenge should be assigned to
        -- Fixed tm.is_active reference by joining with users table to check u.is_active
        SELECT tm.team_id INTO target_team_id
        FROM public.team_members tm
        JOIN public.users u ON tm.user_id = u.id
        WHERE tm.user_id = NEW.created_by
        AND u.is_active = true  -- Fixed: use u.is_active instead of tm.is_active
        LIMIT 1;
        
        -- If creator is in a team, assign the whole team
        IF target_team_id IS NOT NULL THEN
            PERFORM assign_team_to_challenge(NEW.id, target_team_id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger after function is ready
CREATE TRIGGER auto_assign_team_challenge_trigger
    AFTER INSERT ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_team_challenge();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION auto_assign_team_challenge() TO authenticated;

-- =============================================
-- FIX create_team_challenge_participants FUNCTION
-- =============================================

-- Also fix the create_team_challenge_participants function if it exists and has the same issue
CREATE OR REPLACE FUNCTION create_team_challenge_participants(
    p_challenge_id UUID,
    p_team_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- Fixed potential tm.is_active reference by using proper user active status check
    INSERT INTO public.challenge_participants (
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
    FROM public.team_members tm
    JOIN public.teams t ON tm.team_id = t.id
    JOIN public.users u ON tm.user_id = u.id
    WHERE tm.team_id = p_team_id
    AND t.is_active = true
    AND u.is_active = true  -- Fixed: use u.is_active instead of tm.is_active
    ON CONFLICT (challenge_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_team_challenge_participants(UUID, UUID) TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'Fixed remaining tm.is_active references in functions!';
    RAISE NOTICE 'Updated functions:';
    RAISE NOTICE '- assign_team_to_challenge: now uses u.is_active via JOIN';
    RAISE NOTICE '- auto_assign_team_challenge: now uses u.is_active via JOIN';
    RAISE NOTICE '- create_team_challenge_participants: now uses u.is_active via JOIN';
    RAISE NOTICE 'Team challenge creation should now work without errors!';
END $$;
