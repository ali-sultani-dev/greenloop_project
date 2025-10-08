-- Remove conflicting triggers and functions, then create a single consolidated solution

-- Drop all existing challenge progress triggers
DROP TRIGGER IF EXISTS on_user_progress_updated ON public.users;
DROP TRIGGER IF EXISTS on_user_action_challenge_progress ON public.user_actions;
DROP TRIGGER IF EXISTS trigger_update_challenge_progress ON public.user_actions;

-- Drop old functions
DROP FUNCTION IF EXISTS public.update_challenge_progress();
DROP FUNCTION IF EXISTS public.update_challenge_progress_on_action();

-- Create a single, comprehensive function to handle challenge progress
CREATE OR REPLACE FUNCTION public.update_challenge_progress_on_action()
RETURNS TRIGGER AS $$
DECLARE
    challenge_record RECORD;
    participant_record RECORD;
    new_progress NUMERIC := 0;
    action_category TEXT;
    debug_info TEXT := '';
BEGIN
    -- Fixed column reference from sa.category to sa.category_id
    -- Get the category of the logged action
    SELECT sa.category_id INTO action_category
    FROM sustainability_actions sa
    WHERE sa.id = NEW.action_id;
    
    debug_info := format('Action logged: %s, Category: %s, User: %s', NEW.action_id, action_category, NEW.user_id);
    RAISE NOTICE 'Challenge Progress Debug: %', debug_info;
    
    -- Get all active challenges the user is participating in
    FOR challenge_record IN 
        SELECT c.*, cp.id as participant_id, cp.current_progress
        FROM challenges c
        JOIN challenge_participants cp ON c.id = cp.challenge_id
        WHERE cp.user_id = NEW.user_id 
        AND c.is_active = true
        AND c.start_date <= CURRENT_DATE
        AND c.end_date >= CURRENT_DATE
    LOOP
        debug_info := format('Processing challenge: %s, Type: %s, Category: %s', challenge_record.title, challenge_record.challenge_type, challenge_record.category);
        RAISE NOTICE 'Challenge Progress Debug: %', debug_info;
        
        -- Check if the logged action matches the challenge category
        IF challenge_record.category = 'general' OR challenge_record.category = action_category THEN
            
            -- Calculate new progress based on target metric
            IF challenge_record.target_metric = 'actions' THEN
                -- Count total actions for this challenge within the challenge timeframe
                SELECT COUNT(*) INTO new_progress
                FROM user_actions ua
                JOIN sustainability_actions sa ON ua.action_id = sa.id
                WHERE ua.user_id = NEW.user_id
                AND ua.completed_at >= challenge_record.start_date
                AND ua.completed_at <= challenge_record.end_date + INTERVAL '1 day'
                AND ua.verification_status = 'approved'
                AND (challenge_record.category = 'general' OR sa.category_id = challenge_record.category);
                
                new_progress := LEAST((new_progress / NULLIF(challenge_record.target_value, 0)) * 100, 100);
                
            ELSIF challenge_record.target_metric = 'points' THEN
                -- Sum total points for this challenge within the challenge timeframe
                SELECT COALESCE(SUM(sa.points_value), 0) INTO new_progress
                FROM user_actions ua
                JOIN sustainability_actions sa ON ua.action_id = sa.id
                WHERE ua.user_id = NEW.user_id
                AND ua.completed_at >= challenge_record.start_date
                AND ua.completed_at <= challenge_record.end_date + INTERVAL '1 day'
                AND ua.verification_status = 'approved'
                AND (challenge_record.category = 'general' OR sa.category_id = challenge_record.category);
                
                new_progress := LEAST((new_progress / NULLIF(challenge_record.target_value, 0)) * 100, 100);
                
            ELSIF challenge_record.target_metric = 'co2_saved' THEN
                -- Sum total CO2 saved for this challenge within the challenge timeframe
                SELECT COALESCE(SUM(sa.co2_impact), 0) INTO new_progress
                FROM user_actions ua
                JOIN sustainability_actions sa ON ua.action_id = sa.id
                WHERE ua.user_id = NEW.user_id
                AND ua.completed_at >= challenge_record.start_date
                AND ua.completed_at <= challenge_record.end_date + INTERVAL '1 day'
                AND ua.verification_status = 'approved'
                AND (challenge_record.category = 'general' OR sa.category_id = challenge_record.category);
                
                new_progress := LEAST((new_progress / NULLIF(challenge_record.target_value, 0)) * 100, 100);
            END IF;
            
            debug_info := format('Calculated progress: %s%% for challenge %s', new_progress, challenge_record.title);
            RAISE NOTICE 'Challenge Progress Debug: %', debug_info;
            
            -- Update participant progress
            UPDATE challenge_participants 
            SET current_progress = new_progress,
                completed = (new_progress >= 100),
                completed_at = CASE 
                    WHEN new_progress >= 100 AND completed = false THEN NOW()
                    ELSE completed_at
                END
            WHERE id = challenge_record.participant_id;
            
            debug_info := format('Updated participant %s progress to %s%%', challenge_record.participant_id, new_progress);
            RAISE NOTICE 'Challenge Progress Debug: %', debug_info;
            
        ELSE
            debug_info := format('Action category %s does not match challenge category %s', action_category, challenge_record.category);
            RAISE NOTICE 'Challenge Progress Debug: %', debug_info;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a single trigger to update challenge progress when actions are logged and approved
CREATE TRIGGER trigger_update_challenge_progress_on_action
    AFTER INSERT OR UPDATE ON user_actions
    FOR EACH ROW
    WHEN (NEW.verification_status = 'approved')
    EXECUTE FUNCTION update_challenge_progress_on_action();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.update_challenge_progress_on_action() TO authenticated;

-- Update any existing approved actions to trigger progress calculation
-- This will help catch up any missed progress updates
UPDATE user_actions 
SET verification_status = 'approved' 
WHERE verification_status = 'approved' 
AND completed_at >= CURRENT_DATE - INTERVAL '30 days';
