-- Comprehensive fix for challenge system issues
-- Addresses: infinite recursion, RLS violations, team assignment, admin permissions

-- =============================================
-- FIX INFINITE RECURSION IN CHALLENGE DELETION
-- =============================================

-- Drop all problematic challenge policies that cause infinite recursion
DROP POLICY IF EXISTS "challenges_delete_enhanced" ON public.challenges;
DROP POLICY IF EXISTS "challenge_participants_leave_enhanced" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_leave_safe" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_leave_final" ON public.challenge_participants;

-- Create safe challenge deletion policy without recursion
CREATE POLICY "challenges_delete_safe" ON public.challenges
FOR DELETE USING (
    -- Admin can delete any challenge
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND is_admin = true 
        AND is_active = true
    ) OR
    
    -- Users can delete their own personal challenges
    (auth.uid() = created_by AND challenge_type = 'individual') OR
    
    -- Team leaders can delete their team challenges
    (challenge_type = 'team' AND 
     EXISTS (
         SELECT 1 FROM public.teams t
         WHERE t.team_leader_id = auth.uid()
         AND t.is_active = true
     ))
);

-- Create safe challenge participants deletion policy without recursion
CREATE POLICY "challenge_participants_delete_safe" ON public.challenge_participants
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
);

-- =============================================
-- FIX TEAM CHALLENGE PARTICIPANT ASSIGNMENT
-- =============================================

-- Create function to safely assign team to challenge
CREATE OR REPLACE FUNCTION assign_team_to_challenge(
    challenge_uuid UUID,
    team_uuid UUID
)
RETURNS VOID AS $$
DECLARE
    team_member RECORD;
BEGIN
    -- Insert all team members as participants
    FOR team_member IN 
        SELECT tm.user_id 
        FROM public.team_members tm
        JOIN public.teams t ON tm.team_id = t.id
        WHERE t.id = team_uuid 
        AND t.is_active = true
        AND tm.is_active = true
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
-- FIX CHALLENGE PARTICIPANTS RLS POLICIES
-- =============================================

-- Drop and recreate challenge participants policies to fix RLS violations
DROP POLICY IF EXISTS "challenge_participants_join_enhanced" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_insert_own" ON public.challenge_participants;

-- Create safe challenge participants insert policy
CREATE POLICY "challenge_participants_insert_safe" ON public.challenge_participants
FOR INSERT WITH CHECK (
    -- Personal challenges: only creator can join
    (EXISTS (
        SELECT 1 FROM public.challenges c
        WHERE c.id = challenge_id
        AND c.challenge_type = 'individual'
        AND c.created_by = auth.uid()
        AND auth.uid() = user_id
    )) OR
    
    -- Team/Company challenges: any authenticated user can join
    (EXISTS (
        SELECT 1 FROM public.challenges c
        WHERE c.id = challenge_id
        AND c.challenge_type IN ('team', 'company')
        AND c.is_active = true
        AND c.end_date > NOW()
    ) AND auth.uid() = user_id) OR
    
    -- Admin can add anyone to any challenge
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND is_admin = true 
        AND is_active = true
    )
);

-- =============================================
-- CREATE TEAM CHALLENGE ASSIGNMENT TRIGGER
-- =============================================

-- Function to auto-assign team members when team challenge is created
CREATE OR REPLACE FUNCTION auto_assign_team_challenge()
RETURNS TRIGGER AS $$
DECLARE
    target_team_id UUID;
BEGIN
    -- Only process team challenges
    IF NEW.challenge_type = 'team' THEN
        -- Find the team this challenge should be assigned to
        -- This could be based on creator's team or specified team_id
        SELECT tm.team_id INTO target_team_id
        FROM public.team_members tm
        WHERE tm.user_id = NEW.created_by
        AND tm.is_active = true
        LIMIT 1;
        
        -- If creator is in a team, assign the whole team
        IF target_team_id IS NOT NULL THEN
            PERFORM assign_team_to_challenge(NEW.id, target_team_id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for team challenge assignment
DROP TRIGGER IF EXISTS auto_assign_team_challenge_trigger ON public.challenges;
CREATE TRIGGER auto_assign_team_challenge_trigger
    AFTER INSERT ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_team_challenge();

-- =============================================
-- FIX CHALLENGE VISIBILITY POLICIES
-- =============================================

-- Update challenge select policy for proper visibility
DROP POLICY IF EXISTS "challenges_select_enhanced" ON public.challenges;
DROP POLICY IF EXISTS "challenges_select_all" ON public.challenges;

CREATE POLICY "challenges_select_visibility" ON public.challenges
FOR SELECT USING (
    -- Company challenges: visible to all
    challenge_type = 'company' OR
    
    -- Team challenges: visible to team members only
    (challenge_type = 'team' AND (
        -- Admin can see all
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND is_admin = true 
            AND is_active = true
        ) OR
        -- Team members can see their team challenges
        EXISTS (
            SELECT 1 FROM public.challenge_participants cp
            WHERE cp.challenge_id = challenges.id
            AND cp.user_id = auth.uid()
        )
    )) OR
    
    -- Personal challenges: only creator and admin can see
    (challenge_type = 'individual' AND (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND is_admin = true 
            AND is_active = true
        )
    ))
);

-- =============================================
-- GRANT NECESSARY PERMISSIONS
-- =============================================

-- Ensure proper permissions for new functions
GRANT EXECUTE ON FUNCTION auto_assign_team_challenge() TO authenticated;

-- Update table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'Comprehensive challenge fixes applied successfully!';
    RAISE NOTICE 'Fixed issues:';
    RAISE NOTICE '- Infinite recursion in challenge deletion policies';
    RAISE NOTICE '- Team challenge participant assignment';
    RAISE NOTICE '- RLS policy violations';
    RAISE NOTICE '- Challenge visibility rules';
    RAISE NOTICE '- Admin permission handling';
END $$;
