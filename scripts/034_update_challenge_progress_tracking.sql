-- Create function to update challenge progress based on logged actions
CREATE OR REPLACE FUNCTION update_challenge_progress_on_action()
RETURNS TRIGGER AS $$
DECLARE
    challenge_record RECORD;
    participant_record RECORD;
    new_progress NUMERIC;
BEGIN
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
        -- Check if the logged action matches the challenge category
        IF challenge_record.category = 'general' OR 
           (challenge_record.category = 'water' AND NEW.action_id IN (
               SELECT id FROM sustainability_actions WHERE category = 'water'
           )) OR
           (challenge_record.category = 'energy' AND NEW.action_id IN (
               SELECT id FROM sustainability_actions WHERE category = 'energy'
           )) OR
           (challenge_record.category = 'waste' AND NEW.action_id IN (
               SELECT id FROM sustainability_actions WHERE category = 'waste'
           )) OR
           (challenge_record.category = 'transport' AND NEW.action_id IN (
               SELECT id FROM sustainability_actions WHERE category = 'transport'
           ))
        THEN
            -- Calculate new progress based on target metric
            IF challenge_record.target_metric = 'actions' THEN
                -- Count total actions for this challenge
                SELECT COUNT(*) INTO new_progress
                FROM user_actions ua
                JOIN sustainability_actions sa ON ua.action_id = sa.id
                WHERE ua.user_id = NEW.user_id
                AND ua.created_at >= challenge_record.start_date
                AND ua.created_at <= challenge_record.end_date + INTERVAL '1 day'
                AND (challenge_record.category = 'general' OR sa.category = challenge_record.category);
                
                new_progress := LEAST((new_progress / challenge_record.target_value) * 100, 100);
                
            ELSIF challenge_record.target_metric = 'points' THEN
                -- Sum total points for this challenge
                SELECT COALESCE(SUM(sa.points_value), 0) INTO new_progress
                FROM user_actions ua
                JOIN sustainability_actions sa ON ua.action_id = sa.id
                WHERE ua.user_id = NEW.user_id
                AND ua.created_at >= challenge_record.start_date
                AND ua.created_at <= challenge_record.end_date + INTERVAL '1 day'
                AND (challenge_record.category = 'general' OR sa.category = challenge_record.category);
                
                new_progress := LEAST((new_progress / challenge_record.target_value) * 100, 100);
                
            ELSIF challenge_record.target_metric = 'co2_saved' THEN
                -- Sum total CO2 saved for this challenge
                SELECT COALESCE(SUM(sa.co2_impact), 0) INTO new_progress
                FROM user_actions ua
                JOIN sustainability_actions sa ON ua.action_id = sa.id
                WHERE ua.user_id = NEW.user_id
                AND ua.created_at >= challenge_record.start_date
                AND ua.created_at <= challenge_record.end_date + INTERVAL '1 day'
                AND (challenge_record.category = 'general' OR sa.category = challenge_record.category);
                
                new_progress := LEAST((new_progress / challenge_record.target_value) * 100, 100);
            END IF;
            
            -- Update participant progress
            UPDATE challenge_participants 
            SET current_progress = new_progress,
                completed = (new_progress >= 100)
            WHERE id = challenge_record.participant_id;
            
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update challenge progress when actions are logged
DROP TRIGGER IF EXISTS trigger_update_challenge_progress ON user_actions;
CREATE TRIGGER trigger_update_challenge_progress
    AFTER INSERT ON user_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_challenge_progress_on_action();
