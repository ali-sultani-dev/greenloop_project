-- Fix and enhance personal challenge policies and security
-- This script addresses security gaps and improves RLS policies for personal challenges

-- =============================================
-- ENHANCED PERSONAL CHALLENGE SECURITY
-- =============================================

-- Drop existing challenge policies that need to be replaced
DROP POLICY IF EXISTS "Users can create individual challenges" ON public.challenges;
DROP POLICY IF EXISTS "Admins can create any challenge" ON public.challenges;
DROP POLICY IF EXISTS "Team members can create team challenges" ON public.challenges;
DROP POLICY IF EXISTS "challenges_insert_restricted" ON public.challenges;
DROP POLICY IF EXISTS "challenges_update_secure" ON public.challenges;
DROP POLICY IF EXISTS "challenges_delete_admin_only" ON public.challenges;

-- Enhanced challenge creation policy with strict personal challenge rules
CREATE POLICY "challenges_create_enhanced" ON public.challenges
FOR INSERT WITH CHECK (
    auth.uid() = created_by AND
    (
        -- Personal/Individual challenges: strict validation
        (challenge_type = 'individual' AND 
         max_participants = 1 AND 
         reward_points = 0) OR
        
        -- Team challenges: must be team member
        (challenge_type = 'team' AND 
         EXISTS (
             SELECT 1 FROM public.team_members tm
             JOIN public.teams t ON tm.team_id = t.id
             WHERE tm.user_id = auth.uid() 
             AND t.is_active = true
         )) OR
        
        -- Company challenges: admin only
        (challenge_type = 'company' AND 
         EXISTS (
             SELECT 1 FROM public.users 
             WHERE id = auth.uid() 
             AND is_admin = true 
             AND is_active = true
         ))
    )
);

-- Enhanced challenge update policy with personal challenge protection
CREATE POLICY "challenges_update_enhanced" ON public.challenges
FOR UPDATE USING (
    -- Own challenges (with restrictions for personal challenges)
    (auth.uid() = created_by AND 
     (challenge_type != 'individual' OR 
      (challenge_type = 'individual' AND max_participants = 1 AND reward_points = 0))) OR
    
    -- Admin override
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND is_admin = true 
        AND is_active = true
    )
)
WITH CHECK (
    -- Ensure personal challenges maintain their restrictions
    (challenge_type != 'individual' OR 
     (challenge_type = 'individual' AND max_participants = 1 AND reward_points = 0)) AND
    
    -- Only creator or admin can update
    (auth.uid() = created_by OR 
     EXISTS (
         SELECT 1 FROM public.users 
         WHERE id = auth.uid() 
         AND is_admin = true 
         AND is_active = true
     ))
);

-- Enhanced challenge deletion policy
CREATE POLICY "challenges_delete_enhanced" ON public.challenges
FOR DELETE USING (
    -- Admin can delete any challenge
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND is_admin = true 
        AND is_active = true
    ) OR
    
    -- Users can delete their own personal challenges if no one else has joined
    (auth.uid() = created_by AND 
     challenge_type = 'individual' AND
     NOT EXISTS (
         SELECT 1 FROM public.challenge_participants 
         WHERE challenge_id = challenges.id 
         AND user_id != auth.uid()
     ))
);

-- Enhanced challenge selection policy with privacy protection
CREATE POLICY "challenges_select_enhanced" ON public.challenges
FOR SELECT USING (
    -- Public challenges (team and company)
    challenge_type IN ('team', 'company') OR
    
    -- Own personal challenges
    (challenge_type = 'individual' AND created_by = auth.uid()) OR
    
    -- Admin access
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND is_admin = true 
        AND is_active = true
    )
);

-- =============================================
-- ENHANCED CHALLENGE PARTICIPANTS POLICIES
-- =============================================

-- Drop existing challenge participants policies
DROP POLICY IF EXISTS "Users can join challenges" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_insert_own" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_delete_own" ON public.challenge_participants;

-- Enhanced challenge participation policy
CREATE POLICY "challenge_participants_join_enhanced" ON public.challenge_participants
FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM public.challenges c
        WHERE c.id = challenge_id
        AND c.is_active = true
        AND c.end_date > NOW()
        AND (
            -- Can join public challenges (team/company)
            c.challenge_type IN ('team', 'company') OR
            
            -- Can only join own personal challenges
            (c.challenge_type = 'individual' AND c.created_by = auth.uid())
        )
        -- Check max participants limit
        AND (c.max_participants IS NULL OR 
             (SELECT COUNT(*) FROM public.challenge_participants 
              WHERE challenge_id = c.id) < c.max_participants)
    )
);

-- Enhanced challenge participants selection policy
CREATE POLICY "challenge_participants_select_enhanced" ON public.challenge_participants
FOR SELECT USING (
    -- Own participation
    auth.uid() = user_id OR
    
    -- Participants in same public challenges
    EXISTS (
        SELECT 1 FROM public.challenges c
        WHERE c.id = challenge_id
        AND c.challenge_type IN ('team', 'company')
    ) OR
    
    -- Admin access
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND is_admin = true 
        AND is_active = true
    )
);

-- Enhanced challenge participants deletion policy
CREATE POLICY "challenge_participants_leave_enhanced" ON public.challenge_participants
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
    
    -- Team leaders can remove team members from team challenges
    EXISTS (
        SELECT 1 FROM public.challenges c
        JOIN public.challenge_participants cp ON c.id = cp.challenge_id
        JOIN public.teams t ON cp.team_id = t.id
        WHERE cp.challenge_id = challenge_participants.challenge_id
        AND c.challenge_type = 'team'
        AND t.team_leader_id = auth.uid()
        AND cp.user_id = challenge_participants.user_id
    )
);

-- =============================================
-- ENHANCED CHALLENGE PROGRESS POLICIES
-- =============================================

-- Drop existing challenge progress policies if they exist
DROP POLICY IF EXISTS "challenge_progress_select_policy" ON public.challenge_progress;
DROP POLICY IF EXISTS "challenge_progress_insert_policy" ON public.challenge_progress;
DROP POLICY IF EXISTS "challenge_progress_update_policy" ON public.challenge_progress;

-- Enhanced challenge progress selection policy
CREATE POLICY "challenge_progress_select_enhanced" ON public.challenge_progress
FOR SELECT USING (
    -- Own progress
    auth.uid() = user_id OR
    
    -- Progress in public challenges (for leaderboards)
    EXISTS (
        SELECT 1 FROM public.challenges c
        WHERE c.id = challenge_id
        AND c.challenge_type IN ('team', 'company')
    ) OR
    
    -- Admin access
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND is_admin = true 
        AND is_active = true
    )
);

-- System-only challenge progress insertion (via triggers)
CREATE POLICY "challenge_progress_insert_system" ON public.challenge_progress
FOR INSERT WITH CHECK (true); -- Handled by triggers with SECURITY DEFINER

-- System-only challenge progress updates (via triggers)
CREATE POLICY "challenge_progress_update_system" ON public.challenge_progress
FOR UPDATE USING (true) -- Handled by triggers with SECURITY DEFINER
WITH CHECK (true);

-- =============================================
-- ENHANCED CHALLENGE ACTIVITY LOG POLICIES
-- =============================================

-- Update challenge activity log policies for better privacy
DROP POLICY IF EXISTS "Users can view challenge activity for their challenges" ON public.challenge_activity_log;
DROP POLICY IF EXISTS "System can insert challenge activity logs" ON public.challenge_activity_log;

-- Enhanced challenge activity selection policy
CREATE POLICY "challenge_activity_select_enhanced" ON public.challenge_activity_log
FOR SELECT USING (
    -- Own activity
    auth.uid() = user_id OR
    
    -- Activity in challenges user participates in (but only for public challenges)
    EXISTS (
        SELECT 1 FROM public.challenge_participants cp
        JOIN public.challenges c ON cp.challenge_id = c.id
        WHERE cp.challenge_id = challenge_activity_log.challenge_id
        AND cp.user_id = auth.uid()
        AND c.challenge_type IN ('team', 'company')
    ) OR
    
    -- Admin access
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND is_admin = true 
        AND is_active = true
    )
);

-- System-only challenge activity insertion
CREATE POLICY "challenge_activity_insert_system" ON public.challenge_activity_log
FOR INSERT WITH CHECK (true); -- Handled by SECURITY DEFINER functions

-- =============================================
-- PERSONAL CHALLENGE VALIDATION FUNCTIONS
-- =============================================

-- Function to validate personal challenge constraints
CREATE OR REPLACE FUNCTION validate_personal_challenge()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate personal challenge constraints
    IF NEW.challenge_type = 'individual' THEN
        -- Personal challenges must have exactly 1 max participant
        IF NEW.max_participants != 1 THEN
            RAISE EXCEPTION 'Personal challenges must have exactly 1 participant'
                USING ERRCODE = 'check_violation';
        END IF;
        
        -- Personal challenges cannot have reward points
        IF NEW.reward_points > 0 THEN
            RAISE EXCEPTION 'Personal challenges cannot have reward points'
                USING ERRCODE = 'check_violation';
        END IF;
        
        -- Personal challenges can only be created by the user for themselves
        IF NEW.created_by != auth.uid() THEN
            RAISE EXCEPTION 'Personal challenges can only be created by the user for themselves'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for personal challenge validation
DROP TRIGGER IF EXISTS validate_personal_challenge_trigger ON public.challenges;
CREATE TRIGGER validate_personal_challenge_trigger
    BEFORE INSERT OR UPDATE ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION validate_personal_challenge();

-- =============================================
-- PERSONAL CHALLENGE AUTO-JOIN FUNCTION
-- =============================================

-- Function to automatically join user to their personal challenge
CREATE OR REPLACE FUNCTION auto_join_personal_challenge()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-join creator to personal challenges
    IF NEW.challenge_type = 'individual' THEN
        INSERT INTO public.challenge_participants (
            challenge_id,
            user_id,
            current_progress,
            completed,
            joined_at
        ) VALUES (
            NEW.id,
            NEW.created_by,
            0,
            false,
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-joining personal challenges
DROP TRIGGER IF EXISTS auto_join_personal_challenge_trigger ON public.challenges;
CREATE TRIGGER auto_join_personal_challenge_trigger
    AFTER INSERT ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION auto_join_personal_challenge();

-- =============================================
-- SECURITY AUDIT ENHANCEMENTS
-- =============================================

-- Function to log personal challenge security events
CREATE OR REPLACE FUNCTION log_personal_challenge_security_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Log security-relevant events for personal challenges
    IF (TG_OP = 'INSERT' AND NEW.challenge_type = 'individual') OR
       (TG_OP = 'UPDATE' AND (OLD.challenge_type != NEW.challenge_type OR 
                              OLD.max_participants != NEW.max_participants OR
                              OLD.reward_points != NEW.reward_points)) THEN
        
        INSERT INTO public.security_audit_log (
            user_id,
            event_type,
            resource_type,
            resource_id,
            details,
            severity
        ) VALUES (
            auth.uid(),
            'personal_challenge_' || lower(TG_OP),
            'challenge',
            COALESCE(NEW.id, OLD.id),
            jsonb_build_object(
                'challenge_type', COALESCE(NEW.challenge_type, OLD.challenge_type),
                'max_participants', COALESCE(NEW.max_participants, OLD.max_participants),
                'reward_points', COALESCE(NEW.reward_points, OLD.reward_points),
                'operation', TG_OP
            ),
            CASE 
                WHEN NEW.challenge_type = 'individual' AND NEW.reward_points > 0 THEN 'high'
                WHEN NEW.challenge_type = 'individual' AND NEW.max_participants != 1 THEN 'high'
                ELSE 'medium'
            END
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for personal challenge security logging
DROP TRIGGER IF EXISTS log_personal_challenge_security_trigger ON public.challenges;
CREATE TRIGGER log_personal_challenge_security_trigger
    AFTER INSERT OR UPDATE ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION log_personal_challenge_security_event();

-- =============================================
-- DATA PRIVACY ENHANCEMENTS
-- =============================================

-- Function to anonymize personal challenge data for non-owners
CREATE OR REPLACE VIEW public.challenges_public AS
SELECT 
    id,
    title,
    description,
    challenge_type,
    category,
    start_date,
    end_date,
    target_metric,
    target_value,
    reward_points,
    reward_description,
    max_participants,
    is_active,
    created_at,
    -- Hide creator for personal challenges unless you're the creator or admin
    CASE 
        WHEN challenge_type = 'individual' AND 
             created_by != auth.uid() AND 
             NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
        THEN NULL
        ELSE created_by
    END as created_by
FROM public.challenges
WHERE 
    -- Show public challenges
    challenge_type IN ('team', 'company') OR
    -- Show own personal challenges
    (challenge_type = 'individual' AND created_by = auth.uid()) OR
    -- Admin access
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true);

-- Grant access to the public view
GRANT SELECT ON public.challenges_public TO authenticated;

-- =============================================
-- RATE LIMITING FOR PERSONAL CHALLENGES
-- =============================================

-- Function to enforce rate limiting on personal challenge creation
CREATE OR REPLACE FUNCTION check_personal_challenge_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
    recent_count INTEGER;
BEGIN
    -- Rate limit personal challenge creation: max 5 per day
    IF NEW.challenge_type = 'individual' THEN
        SELECT COUNT(*) INTO recent_count
        FROM public.challenges
        WHERE created_by = auth.uid()
        AND challenge_type = 'individual'
        AND created_at > NOW() - INTERVAL '24 hours';
        
        IF recent_count >= 5 THEN
            RAISE EXCEPTION 'Rate limit exceeded: Maximum 5 personal challenges per day'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for rate limiting
DROP TRIGGER IF EXISTS check_personal_challenge_rate_limit_trigger ON public.challenges;
CREATE TRIGGER check_personal_challenge_rate_limit_trigger
    BEFORE INSERT ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION check_personal_challenge_rate_limit();

-- =============================================
-- GRANT NECESSARY PERMISSIONS
-- =============================================

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION validate_personal_challenge() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_join_personal_challenge() TO authenticated;
GRANT EXECUTE ON FUNCTION log_personal_challenge_security_event() TO authenticated;
GRANT EXECUTE ON FUNCTION check_personal_challenge_rate_limit() TO authenticated;

-- Ensure proper table permissions
GRANT SELECT, INSERT ON public.challenge_participants TO authenticated;
GRANT SELECT ON public.challenge_progress TO authenticated;
GRANT SELECT ON public.challenge_activity_log TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'Personal challenge security policies have been enhanced successfully!';
    RAISE NOTICE 'Key improvements:';
    RAISE NOTICE '- Enhanced RLS policies for personal challenge isolation';
    RAISE NOTICE '- Automatic validation of personal challenge constraints';
    RAISE NOTICE '- Auto-join functionality for personal challenges';
    RAISE NOTICE '- Rate limiting (5 personal challenges per day)';
    RAISE NOTICE '- Enhanced security audit logging';
    RAISE NOTICE '- Privacy protection for personal challenge data';
END $$;
