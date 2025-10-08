-- Fix challenge progress tracking by properly matching categories
-- The issue: challenges use string categories like "transport" but actions use UUID category_id

-- First, let's update the challenges table to use proper category matching
-- We need to map the string categories to actual category names or IDs

-- Update existing challenges to use proper category names that match action_categories
UPDATE challenges 
SET category = CASE 
    WHEN category = 'transport' THEN 'Transportation'
    WHEN category = 'energy' THEN 'Energy'
    WHEN category = 'waste' THEN 'Waste Reduction'
    WHEN category = 'water' THEN 'Water Conservation'
    ELSE category
END
WHERE category IN ('transport', 'energy', 'waste', 'water');

-- Now fix the trigger function to properly match categories
CREATE OR REPLACE FUNCTION public.update_challenge_progress_on_action()
RETURNS TRIGGER AS $$
DECLARE
    challenge_record RECORD;
    participant_record RECORD;
    new_progress NUMERIC := 0;
    action_category_name TEXT;
    debug_info TEXT := '';
BEGIN
    -- Get the category name of the logged action (not the UUID)
    SELECT ac.name INTO action_category_name
    FROM sustainability_actions sa
    JOIN action_categories ac ON sa.category_id = ac.id
    WHERE sa.id = NEW.action_id;
    
    debug_info := format('Action logged: %s, Category: %s, User: %s', NEW.action_id, action_category_name, NEW.user_id);
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
        -- Now we compare category names properly
        IF challenge_record.category = 'general' OR challenge_record.category = action_category_name THEN
            
            -- Calculate new progress based on target metric
            IF challenge_record.target_metric = 'actions' THEN
                -- Count total actions for this challenge within the challenge timeframe
                SELECT COUNT(*) INTO new_progress
                FROM user_actions ua
                JOIN sustainability_actions sa ON ua.action_id = sa.id
                JOIN action_categories ac ON sa.category_id = ac.id
                WHERE ua.user_id = NEW.user_id
                AND ua.completed_at >= challenge_record.start_date
                AND ua.completed_at <= challenge_record.end_date + INTERVAL '1 day'
                AND ua.verification_status = 'approved'
                AND (challenge_record.category = 'general' OR ac.name = challenge_record.category);
                
                new_progress := LEAST((new_progress / NULLIF(challenge_record.target_value, 0)) * 100, 100);
                
            ELSIF challenge_record.target_metric = 'points' THEN
                -- Sum total points for this challenge within the challenge timeframe
                SELECT COALESCE(SUM(sa.points_value), 0) INTO new_progress
                FROM user_actions ua
                JOIN sustainability_actions sa ON ua.action_id = sa.id
                JOIN action_categories ac ON sa.category_id = ac.id
                WHERE ua.user_id = NEW.user_id
                AND ua.completed_at >= challenge_record.start_date
                AND ua.completed_at <= challenge_record.end_date + INTERVAL '1 day'
                AND ua.verification_status = 'approved'
                AND (challenge_record.category = 'general' OR ac.name = challenge_record.category);
                
                new_progress := LEAST((new_progress / NULLIF(challenge_record.target_value, 0)) * 100, 100);
                
            ELSIF challenge_record.target_metric = 'co2_saved' THEN
                -- Sum total CO2 saved for this challenge within the challenge timeframe
                SELECT COALESCE(SUM(sa.co2_impact), 0) INTO new_progress
                FROM user_actions ua
                JOIN sustainability_actions sa ON ua.action_id = sa.id
                JOIN action_categories ac ON sa.category_id = ac.id
                WHERE ua.user_id = NEW.user_id
                AND ua.completed_at >= challenge_record.start_date
                AND ua.completed_at <= challenge_record.end_date + INTERVAL '1 day'
                AND ua.verification_status = 'approved'
                AND (challenge_record.category = 'general' OR ac.name = challenge_record.category);
                
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
            debug_info := format('Action category %s does not match challenge category %s', action_category_name, challenge_record.category);
            RAISE NOTICE 'Challenge Progress Debug: %', debug_info;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS trigger_update_challenge_progress_on_action ON user_actions;
CREATE TRIGGER trigger_update_challenge_progress_on_action
    AFTER INSERT OR UPDATE ON user_actions
    FOR EACH ROW
    WHEN (NEW.verification_status = 'approved')
    EXECUTE FUNCTION update_challenge_progress_on_action();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.update_challenge_progress_on_action() TO authenticated;

-- Create a separate function to recalculate all challenge progress
-- This avoids the trigger function record type issues
CREATE OR REPLACE FUNCTION public.recalculate_all_challenge_progress()
RETURNS void AS $$
DECLARE
    participant_record RECORD;
    new_progress NUMERIC := 0;
BEGIN
    -- Loop through all active challenge participants
    FOR participant_record IN 
        SELECT cp.*, c.title, c.category, c.target_metric, c.target_value, c.start_date, c.end_date
        FROM challenge_participants cp
        JOIN challenges c ON cp.challenge_id = c.id
        WHERE c.is_active = true
    LOOP
        -- Calculate progress based on target metric
        IF participant_record.target_metric = 'actions' THEN
            SELECT COUNT(*) INTO new_progress
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = participant_record.user_id
            AND ua.completed_at >= participant_record.start_date
            AND ua.completed_at <= participant_record.end_date + INTERVAL '1 day'
            AND ua.verification_status = 'approved'
            AND (participant_record.category = 'general' OR ac.name = participant_record.category);
            
            new_progress := LEAST((new_progress / NULLIF(participant_record.target_value, 0)) * 100, 100);
            
        ELSIF participant_record.target_metric = 'points' THEN
            SELECT COALESCE(SUM(sa.points_value), 0) INTO new_progress
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = participant_record.user_id
            AND ua.completed_at >= participant_record.start_date
            AND ua.completed_at <= participant_record.end_date + INTERVAL '1 day'
            AND ua.verification_status = 'approved'
            AND (participant_record.category = 'general' OR ac.name = participant_record.category);
            
            new_progress := LEAST((new_progress / NULLIF(participant_record.target_value, 0)) * 100, 100);
            
        ELSIF participant_record.target_metric = 'co2_saved' THEN
            SELECT COALESCE(SUM(sa.co2_impact), 0) INTO new_progress
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = participant_record.user_id
            AND ua.completed_at >= participant_record.start_date
            AND ua.completed_at <= participant_record.end_date + INTERVAL '1 day'
            AND ua.verification_status = 'approved'
            AND (participant_record.category = 'general' OR ac.name = participant_record.category);
            
            new_progress := LEAST((new_progress / NULLIF(participant_record.target_value, 0)) * 100, 100);
        END IF;
        
        -- Update participant progress
        UPDATE challenge_participants 
        SET current_progress = new_progress,
            completed = (new_progress >= 100),
            completed_at = CASE 
                WHEN new_progress >= 100 AND completed = false THEN NOW()
                ELSE completed_at
            END
        WHERE id = participant_record.id;
        
    END LOOP;
    
    RAISE NOTICE 'Challenge progress recalculation completed';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for the recalculation function
GRANT EXECUTE ON FUNCTION public.recalculate_all_challenge_progress() TO authenticated;

-- Run the recalculation function instead of trying to manually trigger
SELECT recalculate_all_challenge_progress();
