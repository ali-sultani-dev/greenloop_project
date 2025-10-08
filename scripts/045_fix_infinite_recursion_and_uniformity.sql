-- Fix infinite recursion in challenge_participants policy and ensure uniformity
-- This script addresses the infinite recursion issue and makes the challenge system uniform

-- =============================================
-- FIX INFINITE RECURSION IN CHALLENGE_PARTICIPANTS
-- =============================================

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "challenge_participants_join_enhanced" ON public.challenge_participants;

-- Create a new policy without the self-referencing subquery
-- Move max_participants check to application level to avoid recursion
CREATE POLICY "challenge_participants_join_safe" ON public.challenge_participants
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
        -- Note: max_participants check moved to application level to prevent recursion
    )
);

-- =============================================
-- ADD DEFAULT START_DATE TO CHALLENGES TABLE
-- =============================================

-- Add default value for start_date to be creation time
ALTER TABLE public.challenges 
ALTER COLUMN start_date SET DEFAULT NOW();

-- =============================================
-- UPDATE CHALLENGE VALIDATION FUNCTION
-- =============================================

-- Update the validation function to set start_date automatically
CREATE OR REPLACE FUNCTION validate_personal_challenge()
RETURNS TRIGGER AS $$
BEGIN
    -- Set start_date to creation time if not provided
    IF NEW.start_date IS NULL THEN
        NEW.start_date = NOW();
    END IF;
    
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

-- =============================================
-- CREATE SAFE MAX PARTICIPANTS CHECK FUNCTION
-- =============================================

-- Create a function to safely check max participants without recursion
CREATE OR REPLACE FUNCTION check_max_participants(challenge_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    max_count INTEGER;
    current_count INTEGER;
BEGIN
    -- Get max participants for the challenge
    SELECT max_participants INTO max_count
    FROM public.challenges
    WHERE id = challenge_uuid;
    
    -- If no limit, allow join
    IF max_count IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Count current participants using a direct query
    SELECT COUNT(*) INTO current_count
    FROM public.challenge_participants
    WHERE challenge_id = challenge_uuid;
    
    -- Return whether there's space
    RETURN current_count < max_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_max_participants(UUID) TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'Fixed infinite recursion in challenge_participants policy!';
    RAISE NOTICE 'Added automatic start_date setting to NOW() on challenge creation';
    RAISE NOTICE 'Created safe max_participants check function';
    RAISE NOTICE 'Max participants validation moved to application level';
END $$;
