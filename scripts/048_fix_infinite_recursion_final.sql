-- Final fix for infinite recursion in challenge_participants policy
-- This script replaces the problematic policy with a safe version

-- =============================================
-- FIX INFINITE RECURSION IN CHALLENGE_PARTICIPANTS
-- =============================================

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "challenge_participants_leave_enhanced" ON public.challenge_participants;

-- Create a new safe policy for leaving challenges without self-referencing subqueries
CREATE POLICY "challenge_participants_leave_safe" ON public.challenge_participants
FOR DELETE USING (
    -- Can leave own participation
    auth.uid() = user_id OR
    
    -- Admin can remove anyone
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND is_admin = true 
        AND is_active = true
    )
    -- Note: Team leader removal logic moved to application level to prevent recursion
);

-- =============================================
-- CREATE SAFE TEAM CHALLENGE FUNCTIONS
-- =============================================

-- Function to safely check if user can leave team challenge
CREATE OR REPLACE FUNCTION can_leave_team_challenge(
    participant_user_id UUID,
    challenge_uuid UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    challenge_type TEXT;
    user_team_id UUID;
    challenge_team_id UUID;
    is_team_leader BOOLEAN := FALSE;
BEGIN
    -- Get challenge type and team
    SELECT c.challenge_type, cp.team_id INTO challenge_type, challenge_team_id
    FROM public.challenges c
    LEFT JOIN public.challenge_participants cp ON c.id = cp.challenge_id
    WHERE c.id = challenge_uuid
    AND cp.user_id = participant_user_id
    LIMIT 1;
    
    -- If not a team challenge, allow leaving
    IF challenge_type != 'team' THEN
        RETURN TRUE;
    END IF;
    
    -- Get user's team
    SELECT tm.team_id INTO user_team_id
    FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
    LIMIT 1;
    
    -- Check if user is team leader of the challenge team
    IF challenge_team_id IS NOT NULL AND user_team_id = challenge_team_id THEN
        SELECT EXISTS (
            SELECT 1 FROM public.teams 
            WHERE id = challenge_team_id 
            AND team_leader_id = auth.uid()
        ) INTO is_team_leader;
        
        -- Team leaders can remove team members
        IF is_team_leader THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    -- Regular team members can only leave their own participation
    RETURN auth.uid() = participant_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_leave_team_challenge(UUID, UUID) TO authenticated;

-- =============================================
-- UPDATE CHALLENGE PARTICIPANTS POLICY
-- =============================================

-- Drop and recreate the leave policy with application-level team logic
DROP POLICY IF EXISTS "challenge_participants_leave_safe" ON public.challenge_participants;

CREATE POLICY "challenge_participants_leave_final" ON public.challenge_participants
FOR DELETE USING (
    -- Can leave own participation
    auth.uid() = user_id OR
    
    -- Admin can remove anyone
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND is_admin = true 
        AND is_active = true
    ) OR
    
    -- Use safe function for team challenge logic
    can_leave_team_challenge(user_id, challenge_id)
);

DO $$
BEGIN
    RAISE NOTICE 'Fixed infinite recursion in challenge_participants policy!';
    RAISE NOTICE 'Created safe team challenge functions';
    RAISE NOTICE 'Team leader logic moved to safe function to prevent recursion';
END $$;
