-- Fix database schema inconsistencies for challenge creation

-- 1. Fix column naming inconsistency: API uses points_reward but schema has reward_points
-- We'll standardize on reward_points to match the existing schema

-- 2. Remove team_id from challenges table since teams are handled via challenge_participants
ALTER TABLE public.challenges DROP COLUMN IF EXISTS team_id;

-- 3. Add target_metric column if it doesn't exist (it should exist based on schema)
-- This is just to ensure consistency
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'challenges' 
                   AND column_name = 'target_metric') THEN
        ALTER TABLE public.challenges ADD COLUMN target_metric text NOT NULL DEFAULT 'actions';
    END IF;
END $$;

-- 4. Ensure proper constraints on target_metric
ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS challenges_target_metric_check;
ALTER TABLE public.challenges ADD CONSTRAINT challenges_target_metric_check 
    CHECK (target_metric IN ('points', 'actions', 'co2_saved'));

-- 5. Add missing reward_description column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'challenges' 
                   AND column_name = 'reward_description') THEN
        ALTER TABLE public.challenges ADD COLUMN reward_description text;
    END IF;
END $$;

-- 6. Update RLS policies for better security
DROP POLICY IF EXISTS "Users can create individual challenges" ON public.challenges;
DROP POLICY IF EXISTS "Admins can create any challenge" ON public.challenges;
DROP POLICY IF EXISTS "Team members can create team challenges" ON public.challenges;

-- Allow users to create individual challenges
CREATE POLICY "Users can create individual challenges" ON public.challenges
    FOR INSERT WITH CHECK (
        challenge_type = 'individual' AND 
        created_by = auth.uid()
    );

-- Allow admins to create any type of challenge
CREATE POLICY "Admins can create any challenge" ON public.challenges
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Allow team members to create team challenges (will be handled in application logic)
CREATE POLICY "Team members can create team challenges" ON public.challenges
    FOR INSERT WITH CHECK (
        challenge_type = 'team' AND 
        created_by = auth.uid()
    );

-- 7. Fix challenge_participants policies
DROP POLICY IF EXISTS "Users can join challenges" ON public.challenge_participants;
CREATE POLICY "Users can join challenges" ON public.challenge_participants
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- 8. Add admin activity logging function for challenge creation
CREATE OR REPLACE FUNCTION log_challenge_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if created by admin
    IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.created_by AND is_admin = true) THEN
        INSERT INTO public.admin_activities (
            admin_id,
            action_type,
            target_type,
            target_id,
            details
        ) VALUES (
            NEW.created_by,
            'create',
            'challenge',
            NEW.id,
            jsonb_build_object(
                'title', NEW.title,
                'type', NEW.challenge_type,
                'category', NEW.category
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for admin activity logging
DROP TRIGGER IF EXISTS trigger_log_challenge_creation ON public.challenges;
CREATE TRIGGER trigger_log_challenge_creation
    AFTER INSERT ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION log_challenge_creation();
