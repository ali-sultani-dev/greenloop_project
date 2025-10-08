-- Comprehensive fix for challenge progress tracking system
-- This addresses column mismatches and trigger function issues

DO $$
BEGIN
    RAISE NOTICE '=== FIXING CHALLENGE PROGRESS SYSTEM ===';
END $$;

-- Step 1: Drop the existing broken trigger and function
DROP TRIGGER IF EXISTS update_challenge_progress_trigger ON user_actions;
DROP FUNCTION IF EXISTS update_challenge_progress_on_action() CASCADE;

-- Step 2: Add missing columns to challenge_progress table if they don't exist
DO $$
BEGIN
    -- Add completed column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'challenge_progress' AND column_name = 'completed') THEN
        ALTER TABLE challenge_progress ADD COLUMN completed BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added completed column to challenge_progress';
    END IF;
    
    -- Add current_progress column if it doesn't exist (for compatibility)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'challenge_progress' AND column_name = 'current_progress') THEN
        ALTER TABLE challenge_progress ADD COLUMN current_progress INTEGER DEFAULT 0;
        RAISE NOTICE 'Added current_progress column to challenge_progress';
    END IF;
END $$;

-- Step 3: Create the corrected trigger function
CREATE OR REPLACE FUNCTION update_challenge_progress_on_action()
RETURNS TRIGGER AS $$
DECLARE
    challenge_record RECORD;
    action_record RECORD;
    category_name TEXT;
    user_actions_count INTEGER;
    progress_pct NUMERIC; -- renamed from progress_percentage to avoid ambiguity
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
    
    -- Find matching challenges for this user and category
    FOR challenge_record IN
        SELECT c.*, cp.user_id
        FROM challenges c
        JOIN challenge_participants cp ON c.id = cp.challenge_id
        WHERE cp.user_id = NEW.user_id
        AND c.is_active = true
        AND NEW.completed_at >= c.start_date
        AND NEW.completed_at <= c.end_date
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
            AND ua.completed_at >= challenge_record.start_date
            AND ua.completed_at <= challenge_record.end_date
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
            AND ua.completed_at >= challenge_record.start_date
            AND ua.completed_at <= challenge_record.end_date
            AND (challenge_record.category = 'general' OR ac.name = challenge_record.category);
            
            calculated_progress := total_points;
            user_actions_count := calculated_progress; -- For actions_completed field
            
        ELSIF challenge_record.target_metric = 'co2_saved' THEN
            -- Sum CO2 impact for this challenge
            SELECT COALESCE(SUM(sa.co2_impact), 0)
            INTO total_co2
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = NEW.user_id
            AND ua.verification_status = 'approved'
            AND ua.completed_at >= challenge_record.start_date
            AND ua.completed_at <= challenge_record.end_date
            AND (challenge_record.category = 'general' OR ac.name = challenge_record.category);
            
            calculated_progress := total_co2;
            user_actions_count := calculated_progress; -- For actions_completed field
        END IF;
        
        -- Calculate progress percentage
        IF challenge_record.target_value > 0 THEN
            progress_pct := LEAST(100.0, (calculated_progress / challenge_record.target_value::NUMERIC) * 100.0);
        ELSE
            progress_pct := CASE WHEN calculated_progress > 0 THEN 100.0 ELSE 0.0 END;
        END IF;
        
        RAISE NOTICE 'Calculated progress: % / % = % percent for challenge: %', 
            calculated_progress, challenge_record.target_value, progress_pct, challenge_record.id;
        
        -- Insert or update challenge progress with correct column names
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
            progress_pct, -- using renamed variable
            calculated_progress::INTEGER,
            progress_pct >= 100, -- using renamed variable
            NOW()
        )
        ON CONFLICT (challenge_id, user_id)
        DO UPDATE SET
            actions_completed = EXCLUDED.actions_completed, -- using EXCLUDED to avoid ambiguity
            progress_percentage = EXCLUDED.progress_percentage, -- using EXCLUDED to avoid ambiguity
            current_progress = EXCLUDED.current_progress, -- using EXCLUDED to avoid ambiguity
            completed = EXCLUDED.completed, -- using EXCLUDED to avoid ambiguity
            last_updated = EXCLUDED.last_updated; -- using EXCLUDED to avoid ambiguity
            
        RAISE NOTICE 'Updated challenge progress for user: % in challenge: %', NEW.user_id, challenge_record.id;
        
        -- Also update challenge_participants current_progress
        UPDATE challenge_participants 
        SET current_progress = calculated_progress::INTEGER,
            completed = (progress_pct >= 100), -- using renamed variable
            completed_at = CASE 
                WHEN progress_pct >= 100 AND completed = false THEN NOW() -- using renamed variable
                ELSE completed_at
            END
        WHERE challenge_id = challenge_record.id AND user_id = NEW.user_id;
        
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create the trigger
CREATE TRIGGER update_challenge_progress_trigger
    AFTER INSERT OR UPDATE ON user_actions
    FOR EACH ROW
    WHEN (NEW.verification_status = 'approved')
    EXECUTE FUNCTION update_challenge_progress_on_action();

-- Step 5: Manually recalculate all existing progress
DO $$
DECLARE
    participant_record RECORD;
    challenge_record RECORD;
    user_actions_count INTEGER;
    total_points NUMERIC;
    total_co2 NUMERIC;
    calculated_progress NUMERIC;
    progress_pct NUMERIC; -- renamed from progress_percentage to avoid ambiguity
BEGIN
    RAISE NOTICE '=== RECALCULATING ALL EXISTING PROGRESS ===';
    
    FOR participant_record IN 
        SELECT cp.*, c.title, c.category, c.target_metric, c.target_value, c.start_date, c.end_date
        FROM challenge_participants cp
        JOIN challenges c ON cp.challenge_id = c.id
        WHERE c.is_active = true
    LOOP
        RAISE NOTICE 'Recalculating progress for user % in challenge %', 
            participant_record.user_id, participant_record.title;
        
        -- Calculate based on target metric
        IF participant_record.target_metric = 'actions' THEN
            SELECT COUNT(*) INTO user_actions_count
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = participant_record.user_id
            AND ua.completed_at >= participant_record.start_date
            AND ua.completed_at <= participant_record.end_date + INTERVAL '1 day'
            AND ua.verification_status = 'approved'
            AND (participant_record.category = 'general' OR ac.name = participant_record.category);
            
            calculated_progress := user_actions_count;
            
        ELSIF participant_record.target_metric = 'points' THEN
            SELECT COALESCE(SUM(sa.points_value), 0) INTO total_points
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = participant_record.user_id
            AND ua.completed_at >= participant_record.start_date
            AND ua.completed_at <= participant_record.end_date + INTERVAL '1 day'
            AND ua.verification_status = 'approved'
            AND (participant_record.category = 'general' OR ac.name = participant_record.category);
            
            calculated_progress := total_points;
            user_actions_count := calculated_progress;
            
        ELSIF participant_record.target_metric = 'co2_saved' THEN
            SELECT COALESCE(SUM(sa.co2_impact), 0) INTO total_co2
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = participant_record.user_id
            AND ua.completed_at >= participant_record.start_date
            AND ua.completed_at <= participant_record.end_date + INTERVAL '1 day'
            AND ua.verification_status = 'approved'
            AND (participant_record.category = 'general' OR ac.name = participant_record.category);
            
            calculated_progress := total_co2;
            user_actions_count := calculated_progress;
        END IF;
        
        -- Calculate progress percentage
        IF participant_record.target_value > 0 THEN
            progress_pct := LEAST(100.0, (calculated_progress / participant_record.target_value::NUMERIC) * 100.0);
        ELSE
            progress_pct := CASE WHEN calculated_progress > 0 THEN 100.0 ELSE 0.0 END;
        END IF;
        
        -- Update challenge progress
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
            participant_record.challenge_id,
            participant_record.user_id,
            COALESCE(user_actions_count, 0),
            progress_pct, -- using renamed variable
            calculated_progress::INTEGER,
            progress_pct >= 100, -- using renamed variable
            NOW()
        )
        ON CONFLICT (challenge_id, user_id)
        DO UPDATE SET
            actions_completed = EXCLUDED.actions_completed, -- using EXCLUDED to avoid ambiguity
            progress_percentage = EXCLUDED.progress_percentage, -- using EXCLUDED to avoid ambiguity
            current_progress = EXCLUDED.current_progress, -- using EXCLUDED to avoid ambiguity
            completed = EXCLUDED.completed, -- using EXCLUDED to avoid ambiguity
            last_updated = EXCLUDED.last_updated; -- using EXCLUDED to avoid ambiguity
        
        -- Update challenge participants
        UPDATE challenge_participants 
        SET current_progress = calculated_progress::INTEGER,
            completed = (progress_pct >= 100), -- using renamed variable
            completed_at = CASE 
                WHEN progress_pct >= 100 AND completed = false THEN NOW() -- using renamed variable
                ELSE completed_at
            END
        WHERE id = participant_record.id;
        
        RAISE NOTICE 'Updated progress: % / % = % percent (completed: %)', 
            calculated_progress, participant_record.target_value, progress_pct, (progress_pct >= 100);
    END LOOP;
    
    RAISE NOTICE '=== RECALCULATION COMPLETE ===';
END $$;

-- Step 6: Show results
SELECT 
    'Updated Challenge Progress' as status,
    c.title as challenge_name,
    u.first_name || ' ' || u.last_name as user_name,
    cp.actions_completed,
    cp.progress_percentage,
    cp.completed,
    cp.last_updated
FROM challenge_progress cp
JOIN challenges c ON cp.challenge_id = c.id
JOIN users u ON cp.user_id = u.id
ORDER BY cp.last_updated DESC;

-- Wrapped final RAISE NOTICE in DO block to fix syntax error
DO $$
BEGIN
    RAISE NOTICE 'Challenge progress system has been fixed and all progress recalculated!';
END $$;
