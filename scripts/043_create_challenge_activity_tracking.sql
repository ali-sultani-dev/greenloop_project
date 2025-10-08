-- Create challenge activity tracking system
-- This script creates tables and functions to track challenge-related activities and progress milestones

-- Create challenge_activity_log table to track challenge-related events
CREATE TABLE IF NOT EXISTS challenge_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'progress_update', 'milestone_reached', 'challenge_completed', 'leaderboard_change'
    activity_description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- Store additional data like progress values, milestone info
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_challenge_activity_log_challenge_id ON challenge_activity_log(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_activity_log_user_id ON challenge_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_activity_log_created_at ON challenge_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_activity_log_activity_type ON challenge_activity_log(activity_type);

-- Create RLS policies for challenge_activity_log
ALTER TABLE challenge_activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view activity logs for challenges they participate in
CREATE POLICY "Users can view challenge activity for their challenges" ON challenge_activity_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM challenge_participants cp 
            WHERE cp.challenge_id = challenge_activity_log.challenge_id 
            AND cp.user_id = auth.uid()
        )
    );

-- Policy: System can insert activity logs (for triggers)
CREATE POLICY "System can insert challenge activity logs" ON challenge_activity_log
    FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON challenge_activity_log TO authenticated;
GRANT INSERT ON challenge_activity_log TO authenticated;

-- Function to log challenge activities
CREATE OR REPLACE FUNCTION log_challenge_activity(
    p_challenge_id UUID,
    p_user_id UUID,
    p_activity_type VARCHAR(50),
    p_description TEXT,
    p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO challenge_activity_log (
        challenge_id,
        user_id,
        activity_type,
        activity_description,
        metadata
    ) VALUES (
        p_challenge_id,
        p_user_id,
        p_activity_type,
        p_description,
        p_metadata
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_challenge_activity TO authenticated;

-- Update the challenge progress trigger to log activities
CREATE OR REPLACE FUNCTION "public"."update_challenge_progress_on_action"() 
RETURNS "trigger"
LANGUAGE "plpgsql" 
SECURITY DEFINER
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
    old_progress NUMERIC := 0;
    milestone_reached BOOLEAN := FALSE;
    challenge_completed BOOLEAN := FALSE;
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
        SELECT c.*, cp.user_id, cp.current_progress as old_current_progress
        FROM challenges c
        JOIN challenge_participants cp ON c.id = cp.challenge_id
        WHERE cp.user_id = NEW.user_id
        AND c.is_active = true
        AND NEW.completed_at <= c.end_date
        AND (c.category = 'general' OR c.category = category_name)
    LOOP
        RAISE NOTICE 'Processing challenge: % (%) for user: %', challenge_record.title, challenge_record.id, NEW.user_id;
        
        -- Store old progress for comparison
        old_progress := challenge_record.old_current_progress;
        
        -- Calculate progress based on target metric
        IF challenge_record.target_metric = 'actions' THEN
            SELECT COUNT(*)
            INTO user_actions_count
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = NEW.user_id
            AND ua.verification_status = 'approved'
            AND ua.completed_at <= challenge_record.end_date
            AND (challenge_record.category = 'general' OR ac.name = challenge_record.category);
            
            calculated_progress := user_actions_count;
            
        ELSIF challenge_record.target_metric = 'points' THEN
            SELECT COALESCE(SUM(sa.points_value), 0)
            INTO total_points
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = NEW.user_id
            AND ua.verification_status = 'approved'
            AND ua.completed_at <= challenge_record.end_date
            AND (challenge_record.category = 'general' OR ac.name = challenge_record.category);
            
            calculated_progress := total_points;
            user_actions_count := calculated_progress;
            
        ELSIF challenge_record.target_metric = 'co2_saved' THEN
            SELECT COALESCE(SUM(sa.co2_impact), 0)
            INTO total_co2
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = NEW.user_id
            AND ua.verification_status = 'approved'
            AND ua.completed_at <= challenge_record.end_date
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
        
        -- Check for milestones and completion
        milestone_reached := (calculated_progress > old_progress AND calculated_progress > 0);
        challenge_completed := (progress_pct >= 100 AND old_progress < challenge_record.target_value);
        
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
            
        -- Update challenge_participants current_progress
        UPDATE challenge_participants 
        SET current_progress = calculated_progress::INTEGER,
            completed = (progress_pct >= 100),
            completed_at = CASE 
                WHEN progress_pct >= 100 AND completed = false THEN NOW()
                ELSE completed_at
            END
        WHERE challenge_id = challenge_record.id AND user_id = NEW.user_id;
        
        -- Log challenge activities
        IF milestone_reached THEN
            PERFORM log_challenge_activity(
                challenge_record.id,
                NEW.user_id,
                'progress_update',
                format('%s completed "%s" and made progress in challenge "%s"', 
                    (SELECT first_name || ' ' || last_name FROM users WHERE id = NEW.user_id),
                    action_record.title,
                    challenge_record.title
                ),
                jsonb_build_object(
                    'action_title', action_record.title,
                    'points_earned', action_record.points_value,
                    'co2_saved', action_record.co2_impact,
                    'old_progress', old_progress,
                    'new_progress', calculated_progress,
                    'progress_percentage', progress_pct,
                    'target_metric', challenge_record.target_metric
                )
            );
        END IF;
        
        IF challenge_completed THEN
            PERFORM log_challenge_activity(
                challenge_record.id,
                NEW.user_id,
                'challenge_completed',
                format('%s completed challenge "%s"!', 
                    (SELECT first_name || ' ' || last_name FROM users WHERE id = NEW.user_id),
                    challenge_record.title
                ),
                jsonb_build_object(
                    'target_value', challenge_record.target_value,
                    'final_progress', calculated_progress,
                    'target_metric', challenge_record.target_metric,
                    'reward_points', challenge_record.reward_points
                )
            );
        END IF;
        
        -- Check for milestone achievements (25%, 50%, 75%)
        IF old_progress < challenge_record.target_value * 0.25 AND calculated_progress >= challenge_record.target_value * 0.25 THEN
            PERFORM log_challenge_activity(
                challenge_record.id,
                NEW.user_id,
                'milestone_reached',
                format('%s reached 25%% completion in challenge "%s"', 
                    (SELECT first_name || ' ' || last_name FROM users WHERE id = NEW.user_id),
                    challenge_record.title
                ),
                jsonb_build_object('milestone', '25%', 'progress', calculated_progress, 'target_metric', challenge_record.target_metric)
            );
        END IF;
        
        IF old_progress < challenge_record.target_value * 0.50 AND calculated_progress >= challenge_record.target_value * 0.50 THEN
            PERFORM log_challenge_activity(
                challenge_record.id,
                NEW.user_id,
                'milestone_reached',
                format('%s reached 50%% completion in challenge "%s"', 
                    (SELECT first_name || ' ' || last_name FROM users WHERE id = NEW.user_id),
                    challenge_record.title
                ),
                jsonb_build_object('milestone', '50%', 'progress', calculated_progress, 'target_metric', challenge_record.target_metric)
            );
        END IF;
        
        IF old_progress < challenge_record.target_value * 0.75 AND calculated_progress >= challenge_record.target_value * 0.75 THEN
            PERFORM log_challenge_activity(
                challenge_record.id,
                NEW.user_id,
                'milestone_reached',
                format('%s reached 75%% completion in challenge "%s"', 
                    (SELECT first_name || ' ' || last_name FROM users WHERE id = NEW.user_id),
                    challenge_record.title
                ),
                jsonb_build_object('milestone', '75%', 'progress', calculated_progress, 'target_metric', challenge_record.target_metric)
            );
        END IF;
        
    END LOOP;
    
    RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS update_challenge_progress_trigger ON user_actions;
CREATE TRIGGER update_challenge_progress_trigger
    AFTER INSERT OR UPDATE ON user_actions
    FOR EACH ROW
    WHEN (NEW.verification_status = 'approved')
    EXECUTE FUNCTION update_challenge_progress_on_action();

-- Create view for recent challenge activities
CREATE OR REPLACE VIEW recent_challenge_activities AS
SELECT 
    cal.id,
    cal.challenge_id,
    cal.user_id,
    cal.activity_type,
    cal.activity_description,
    cal.metadata,
    cal.created_at,
    c.title as challenge_title,
    c.category as challenge_category,
    c.target_metric,
    u.first_name,
    u.last_name,
    u.avatar_url
FROM challenge_activity_log cal
JOIN challenges c ON cal.challenge_id = c.id
JOIN users u ON cal.user_id = u.id
ORDER BY cal.created_at DESC;

-- Grant access to the view
GRANT SELECT ON recent_challenge_activities TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'Challenge activity tracking system created successfully!';
END $$;
