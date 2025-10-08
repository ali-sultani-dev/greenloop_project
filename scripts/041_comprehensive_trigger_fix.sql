-- Comprehensive fix for automatic challenge progress tracking
-- Removes start date restrictions so all approved actions count toward active challenges

-- Update the existing trigger function to remove start date restrictions
CREATE OR REPLACE FUNCTION public.update_challenge_progress_on_action() RETURNS trigger
    LANGUAGE plpgsql
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
            -- Removed start date restriction from action counting
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
            -- Removed start date restriction from points calculation
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
            -- Removed start date restriction from CO2 calculation
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

-- Recalculate all existing progress with new logic (no start date restrictions)
-- Clear existing progress data
DELETE FROM challenge_progress;

-- Recalculate progress for all user-challenge combinations
INSERT INTO challenge_progress (
    challenge_id,
    user_id,
    actions_completed,
    progress_percentage,
    current_progress,
    completed,
    last_updated
)
SELECT 
    cp.challenge_id,
    cp.user_id,
    CASE 
        WHEN c.target_metric = 'actions' THEN action_counts.action_count
        ELSE action_counts.action_count
    END as actions_completed,
    CASE 
        WHEN c.target_value > 0 THEN 
            LEAST(100.0, (
                CASE 
                    WHEN c.target_metric = 'actions' THEN action_counts.action_count
                    WHEN c.target_metric = 'points' THEN action_counts.total_points
                    WHEN c.target_metric = 'co2_saved' THEN action_counts.total_co2
                END / c.target_value::NUMERIC
            ) * 100.0)
        ELSE 
            CASE 
                WHEN (CASE 
                    WHEN c.target_metric = 'actions' THEN action_counts.action_count
                    WHEN c.target_metric = 'points' THEN action_counts.total_points
                    WHEN c.target_metric = 'co2_saved' THEN action_counts.total_co2
                END) > 0 THEN 100.0 
                ELSE 0.0 
            END
    END as progress_percentage,
    CASE 
        WHEN c.target_metric = 'actions' THEN action_counts.action_count
        WHEN c.target_metric = 'points' THEN action_counts.total_points::INTEGER
        WHEN c.target_metric = 'co2_saved' THEN action_counts.total_co2::INTEGER
    END as current_progress,
    CASE 
        WHEN c.target_value > 0 THEN 
            (CASE 
                WHEN c.target_metric = 'actions' THEN action_counts.action_count
                WHEN c.target_metric = 'points' THEN action_counts.total_points
                WHEN c.target_metric = 'co2_saved' THEN action_counts.total_co2
            END) >= c.target_value
        ELSE 
            (CASE 
                WHEN c.target_metric = 'actions' THEN action_counts.action_count
                WHEN c.target_metric = 'points' THEN action_counts.total_points
                WHEN c.target_metric = 'co2_saved' THEN action_counts.total_co2
            END) > 0
    END as completed,
    NOW() as last_updated
FROM challenge_participants cp
JOIN challenges c ON cp.challenge_id = c.id
LEFT JOIN (
    SELECT 
        cp_inner.challenge_id,
        cp_inner.user_id,
        COUNT(ua.id) as action_count,
        COALESCE(SUM(sa.points_value), 0) as total_points,
        COALESCE(SUM(sa.co2_impact), 0) as total_co2
    FROM challenge_participants cp_inner
    JOIN challenges c_inner ON cp_inner.challenge_id = c_inner.id
    LEFT JOIN user_actions ua ON ua.user_id = cp_inner.user_id
        AND ua.verification_status = 'approved'
        AND ua.completed_at <= c_inner.end_date  -- Only check end date
    LEFT JOIN sustainability_actions sa ON ua.action_id = sa.id
    LEFT JOIN action_categories ac ON sa.category_id = ac.id
    WHERE c_inner.is_active = true
        AND (c_inner.category = 'general' OR ac.name = c_inner.category)
    GROUP BY cp_inner.challenge_id, cp_inner.user_id
) action_counts ON action_counts.challenge_id = cp.challenge_id AND action_counts.user_id = cp.user_id
WHERE c.is_active = true;

-- Update challenge_participants table with calculated progress
UPDATE challenge_participants cp
SET 
    current_progress = prog.current_progress,
    completed = prog.completed,
    completed_at = CASE 
        WHEN prog.completed = true AND cp.completed = false THEN NOW()
        ELSE cp.completed_at
    END
FROM challenge_progress prog
WHERE cp.challenge_id = prog.challenge_id 
AND cp.user_id = prog.user_id;

-- Show final results
SELECT 
    'Final Results' as status,
    COUNT(*) as total_progress_entries,
    COUNT(*) FILTER (WHERE completed = true) as completed_challenges,
    ROUND(AVG(progress_percentage), 2) as avg_progress_percentage
FROM challenge_progress;
