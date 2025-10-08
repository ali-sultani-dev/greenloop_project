-- Emergency fix for broken challenge visibility after script 49
-- Addresses: circular dependency in RLS policies, challenge visibility issues

-- =============================================
-- FIX CHALLENGE VISIBILITY (MAIN ISSUE)
-- =============================================

-- Drop the problematic visibility policy that created circular dependency
DROP POLICY IF EXISTS "challenges_select_visibility" ON public.challenges;

-- Create proper challenge visibility policy without circular dependency
CREATE POLICY "challenges_select_proper" ON public.challenges
FOR SELECT USING (
    -- Company challenges: visible to all authenticated users
    challenge_type = 'company' OR
    
    -- Team challenges: visible to all team members (automatically participants)
    (challenge_type = 'team' AND (
        -- Admin can see all
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND is_admin = true 
            AND is_active = true
        ) OR
        -- Added proper user active status check through join
        EXISTS (
            SELECT 1 FROM public.team_members tm
            JOIN public.teams t ON tm.team_id = t.id
            JOIN public.users u ON tm.user_id = u.id
            WHERE tm.user_id = auth.uid()
            AND t.is_active = true
            AND u.is_active = true
            AND t.id = team_id  -- Match the challenge's team_id
        )
    )) OR
    
    -- Personal challenges: creator and admin can see
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
-- AUTO-ASSIGN TEAM MEMBERS TO TEAM CHALLENGES
-- =============================================

-- Adding function to automatically assign team members to team challenges
CREATE OR REPLACE FUNCTION auto_assign_team_members_to_challenge()
RETURNS TRIGGER AS $$
BEGIN
    -- Only for team challenges
    IF NEW.challenge_type = 'team' THEN
        -- Insert only active team members as participants
        INSERT INTO public.challenge_participants (challenge_id, user_id, joined_at)
        SELECT 
            NEW.id,
            tm.user_id,
            NOW()
        FROM public.team_members tm
        JOIN public.teams t ON tm.team_id = t.id
        JOIN public.users u ON tm.user_id = u.id
        WHERE t.is_active = true
        AND u.is_active = true
        AND t.id = NEW.team_id  -- Added NEW.team_id to match the challenge's team
        ON CONFLICT (challenge_id, user_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Creating trigger to auto-assign team members when team challenge is created
DROP TRIGGER IF EXISTS trigger_auto_assign_team_members ON public.challenges;
CREATE TRIGGER trigger_auto_assign_team_members
    AFTER INSERT ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_team_members_to_challenge();

-- =============================================
-- FIX CHALLENGE PARTICIPANTS POLICIES
-- =============================================

-- Drop the overly restrictive insert policy
DROP POLICY IF EXISTS "challenge_participants_insert_safe" ON public.challenge_participants;

-- Create proper challenge participants insert policy
CREATE POLICY "challenge_participants_insert_proper" ON public.challenge_participants
FOR INSERT WITH CHECK (
    -- Must be inserting for yourself (unless admin or auto-assignment)
    (auth.uid() = user_id OR 
     EXISTS (
         SELECT 1 FROM public.users 
         WHERE id = auth.uid() 
         AND is_admin = true 
         AND is_active = true
     )) AND
    
    -- Challenge must exist and be active
    EXISTS (
        SELECT 1 FROM public.challenges c
        WHERE c.id = challenge_id
        AND c.is_active = true
        AND c.end_date > NOW()
    ) AND
    
    -- Type-specific rules
    (
        -- Personal challenges: only creator can join their own
        (EXISTS (
            SELECT 1 FROM public.challenges c
            WHERE c.id = challenge_id
            AND c.challenge_type = 'individual'
            AND c.created_by = auth.uid()
            AND auth.uid() = user_id
        )) OR
        
        -- Company challenges: any user can join
        (EXISTS (
            SELECT 1 FROM public.challenges c
            WHERE c.id = challenge_id
            AND c.challenge_type = 'company'
        )) OR
        
        -- Team challenges: automatic assignment (no manual joining needed)
        (EXISTS (
            SELECT 1 FROM public.challenges c
            WHERE c.id = challenge_id
            AND c.challenge_type = 'team'
        ) AND (
            -- Admin can add anyone
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() 
                AND is_admin = true 
                AND is_active = true
            ) OR
            -- Added proper user active status check for team members
            EXISTS (
                SELECT 1 FROM public.team_members tm
                JOIN public.users u ON tm.user_id = u.id
                WHERE tm.user_id = user_id
                AND u.is_active = true
            )
        ))
    )
);

-- Update challenge participants select to show team members their automatic participation
DROP POLICY IF EXISTS "challenge_participants_select" ON public.challenge_participants;
CREATE POLICY "challenge_participants_select" ON public.challenge_participants
FOR SELECT USING (
    -- Can see own participation
    auth.uid() = user_id OR
    
    -- Admin can see all
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND is_admin = true 
        AND is_active = true
    ) OR
    
    -- Team members can see other team members' participation in team challenges
    EXISTS (
        SELECT 1 FROM public.challenges c
        JOIN public.team_members tm1 ON tm1.user_id = auth.uid()
        JOIN public.team_members tm2 ON tm2.user_id = challenge_participants.user_id
        WHERE c.id = challenge_participants.challenge_id
        AND c.challenge_type = 'team'
        AND tm1.team_id = tm2.team_id
    )
);

-- =============================================
-- SIMPLIFY DELETION POLICIES
-- =============================================

-- Drop problematic deletion policies
DROP POLICY IF EXISTS "challenges_delete_safe" ON public.challenges;

-- Create simple, working deletion policy
CREATE POLICY "challenges_delete_simple" ON public.challenges
FOR DELETE USING (
    -- Admin can delete any challenge
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND is_admin = true 
        AND is_active = true
    ) OR
    
    -- Creator can delete their own challenges
    created_by = auth.uid()
);

-- Fix challenge participants deletion (team members cannot leave team challenges)
DROP POLICY IF EXISTS "challenge_participants_delete_safe" ON public.challenge_participants;

CREATE POLICY "challenge_participants_delete_simple" ON public.challenge_participants
FOR DELETE USING (
    -- Team challenge participants cannot leave (automatic participation)
    NOT EXISTS (
        SELECT 1 FROM public.challenges c
        WHERE c.id = challenge_id
        AND c.challenge_type = 'team'
    ) AND (
        -- Can leave own participation (non-team challenges only)
        auth.uid() = user_id OR
        
        -- Admin can remove anyone
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND is_admin = true 
            AND is_active = true
        )
    )
);

-- =============================================
-- ENSURE PROPER PERMISSIONS
-- =============================================

-- Make sure basic permissions are granted
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_participants TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'Emergency fix with auto team participation applied successfully!';
    RAISE NOTICE 'Fixed issues:';
    RAISE NOTICE '- Removed circular dependency in challenge visibility';
    RAISE NOTICE '- Simplified RLS policies to prevent infinite recursion';
    RAISE NOTICE '- Restored challenge visibility for all users';
    RAISE NOTICE '- Fixed admin deletion capabilities';
    RAISE NOTICE '- Added automatic team member assignment to team challenges';
    RAISE NOTICE '- Team members cannot leave team challenges (automatic participation)';
    RAISE NOTICE '- Fixed user active status checks through proper table joins';
END $$;
