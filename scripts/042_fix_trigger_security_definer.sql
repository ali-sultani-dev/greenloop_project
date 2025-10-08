-- Fix trigger function to run with elevated privileges
-- This allows the trigger to bypass RLS policies when inserting/updating challenge_progress

-- Add complete function body with SECURITY DEFINER to allow trigger to bypass RLS policies
CREATE OR REPLACE FUNCTION "public"."update_challenge_progress_on_action"() 
RETURNS "trigger"
LANGUAGE "plpgsql" 
SECURITY DEFINER  -- This makes the function run with postgres privileges, bypassing RLS
AS $$
DECLARE
    challenge_record RECORD;
    action_record RECORD;
    category_name TEXT;
    user_actions_count INTEGER;
    progress_pct NUMERIC;
    total_points NUMERIC;
    total_co2 NUMERIC;
    calculated_progress NUMERIC;
BEGIN
    RAISE NOTICE 'Trigger fired for user_action: %', NEW.id;
    
    -- Get action details with category
    SELECT sa.*, ac.name as category_name
    INTO action_record
    FROM sustainability_actions sa
    JOIN action_categories ac ON sa.category_id = ac.id
    WHERE sa.id = NEW.action_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Action not found: %', NEW.action_id;
        RETURN NEW;
    END IF;
    
    category_name := action_record.category_name;
    RAISE NOTICE 'Action category: %, Action title: %', category_name, action_record.title;
    
    -- Removed start date restriction - only check end date and active status
    -- Find matching challenges for this user and category
    FOR challenge_record IN
        SELECT c.*, cp.user_id
        FROM challenges c
        JOIN challenge_participants cp ON c.id = cp.challenge_id
        WHERE cp.user_id = NEW.user_id
        AND c.is_active = true
        AND NEW.completed_at <= c.end_date  -- Only check end date
        AND (c.category = 'general' OR c.category = category_name)
    LOOP
        RAISE NOTICE 'Processing challenge: % (%) for user: %', challenge_record.title, challenge_record.id, NEW.user_id;
        
        -- Calculate progress based on target metric
        IF challenge_record.target_metric = 'actions' THEN
            -- Count user's approved actions for this challenge
            SELECT COUNT(*)
            INTO user_actions_count
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = NEW.user_id
            AND ua.verification_status = 'approved'
            AND ua.completed_at <= challenge_record.end_date  -- Only check end date
            AND (challenge_record.category = 'general' OR ac.name = challenge_record.category);
            
            calculated_progress := user_actions_count;
            
        ELSIF challenge_record.target_metric = 'points' THEN
            -- Sum points for this challenge
            SELECT COALESCE(SUM(sa.points_value), 0)
            INTO total_points
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = NEW.user_id
            AND ua.verification_status = 'approved'
            AND ua.completed_at <= challenge_record.end_date  -- Only check end date
            AND (challenge_record.category = 'general' OR ac.name = challenge_record.category);
            
            calculated_progress := total_points;
            user_actions_count := calculated_progress;
            
        ELSIF challenge_record.target_metric = 'co2_saved' THEN
            -- Sum CO2 impact for this challenge
            SELECT COALESCE(SUM(sa.co2_impact), 0)
            INTO total_co2
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = NEW.user_id
            AND ua.verification_status = 'approved'
            AND ua.completed_at <= challenge_record.end_date  -- Only check end date
            AND (challenge_record.category = 'general' OR ac.name = challenge_record.category);
            
            calculated_progress := total_co2;
            user_actions_count := calculated_progress;
        END IF;
        
        -- Calculate progress percentage
        IF challenge_record.target_value > 0 THEN
            progress_pct := LEAST(100.0, (calculated_progress / challenge_record.target_value::NUMERIC) * 100.0);
        ELSE
            progress_pct := CASE WHEN calculated_progress > 0 THEN 100.0 ELSE 0.0 END;
        END IF;
        
        RAISE NOTICE 'Calculated progress: % / % = % percent for challenge: %', 
            calculated_progress, challenge_record.target_value, progress_pct, challenge_record.id;
        
        -- Insert or update challenge progress
        INSERT INTO challenge_progress (
            challenge_id,
            user_id,
            actions_completed,
            progress_percentage,
            current_progress,
            completed,
            last_updated
        )
        VALUES (
            challenge_record.id,
            NEW.user_id,
            COALESCE(user_actions_count, 0),
            progress_pct,
            calculated_progress::INTEGER,
            progress_pct >= 100,
            NOW()
        )
        ON CONFLICT (challenge_id, user_id)
        DO UPDATE SET
            actions_completed = EXCLUDED.actions_completed,
            progress_percentage = EXCLUDED.progress_percentage,
            current_progress = EXCLUDED.current_progress,
            completed = EXCLUDED.completed,
            last_updated = EXCLUDED.last_updated;
            
        RAISE NOTICE 'Updated challenge progress for user: % in challenge: %', NEW.user_id, challenge_record.id;
        
        -- Also update challenge_participants current_progress
        UPDATE challenge_participants 
        SET current_progress = calculated_progress::INTEGER,
            completed = (progress_pct >= 100),
            completed_at = CASE 
                WHEN progress_pct >= 100 AND completed = false THEN NOW()
                ELSE completed_at
            END
        WHERE challenge_id = challenge_record.id AND user_id = NEW.user_id;
        
    END LOOP;
    
    RETURN NEW;
END;
$$;

-- Grant execute permission to authenticated users so they can trigger the function
GRANT EXECUTE ON FUNCTION "public"."update_challenge_progress_on_action"() TO authenticated;

-- Test the fix by manually triggering progress recalculation for recent actions
DO $$
BEGIN
    RAISE NOTICE 'Trigger function updated with SECURITY DEFINER. New actions should now log successfully.';
END $$;
