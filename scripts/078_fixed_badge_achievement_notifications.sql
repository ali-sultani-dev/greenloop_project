-- Fixed Badge & Achievement Notification System
-- This script creates triggers based on user levels instead of hardcoded milestone points

-- Function to send badge achievement notification
CREATE OR REPLACE FUNCTION notify_badge_achievement()
RETURNS TRIGGER AS $$
BEGIN
    -- Send notification for new badge
    PERFORM create_notification_if_enabled(
        NEW.user_id,
        'achievement_alerts',
        'New Achievement Unlocked! 🏆',
        'New Achievement Unlocked: ''' || NEW.badge_name || '''',
        '/badges',
        'badge',
        NEW.id::text
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send level milestone notification
CREATE OR REPLACE FUNCTION notify_level_milestone()
RETURNS TRIGGER AS $$
DECLARE
    old_level INTEGER;
    new_level INTEGER;
    level_threshold_points INTEGER;
BEGIN
    -- Calculate old and new levels using the level calculation function
    SELECT calculate_user_level(OLD.points) INTO old_level;
    SELECT calculate_user_level(NEW.points) INTO new_level;
    
    -- Only send notification if level increased
    IF new_level > old_level THEN
        -- Get the points required for the new level
        SELECT points_required INTO level_threshold_points
        FROM level_thresholds
        WHERE level = new_level;
        
        -- Send milestone notification
        PERFORM create_notification_if_enabled(
            NEW.user_id,
            'achievement_alerts',
            'Milestone Reached! ⭐',
            'Milestone Reached: Level ' || new_level || ' achieved with ' || NEW.points || ' points!',
            '/profile',
            'badge',
            NEW.user_id::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send weekly points summary (called by scheduled job)
CREATE OR REPLACE FUNCTION send_weekly_points_notifications()
RETURNS void AS $$
DECLARE
    user_record RECORD;
    weekly_points INTEGER;
    start_date DATE;
    end_date DATE;
BEGIN
    -- Calculate this week's date range
    start_date := date_trunc('week', CURRENT_DATE);
    end_date := start_date + INTERVAL '7 days';
    
    -- Loop through all active users
    FOR user_record IN 
        SELECT DISTINCT user_id 
        FROM point_transactions 
        WHERE created_at >= start_date 
        AND created_at < end_date
    LOOP
        -- Calculate weekly points for this user
        SELECT COALESCE(SUM(points), 0) INTO weekly_points
        FROM point_transactions
        WHERE user_id = user_record.user_id
        AND created_at >= start_date
        AND created_at < end_date;
        
        -- Send notification if user earned points this week
        IF weekly_points > 0 THEN
            PERFORM create_notification_if_enabled(
                user_record.user_id,
                'achievement_alerts',
                'Weekly Points! 🎯',
                'You''ve earned ' || weekly_points || ' points this week!',
                '/profile',
                'badge',
                user_record.user_id::text
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS badge_achievement_notification ON user_badges;
DROP TRIGGER IF EXISTS level_milestone_notification ON users;

-- Create triggers for badge achievements
CREATE TRIGGER badge_achievement_notification
    AFTER INSERT ON user_badges
    FOR EACH ROW
    EXECUTE FUNCTION notify_badge_achievement();

-- Create trigger for level milestones (based on user points changes)
-- Note: This assumes there's a users table with points column that gets updated
-- If points are only in point_transactions, we'll need a different approach
CREATE OR REPLACE FUNCTION update_user_points_and_notify()
RETURNS TRIGGER AS $$
DECLARE
    total_points INTEGER;
    old_level INTEGER;
    new_level INTEGER;
BEGIN
    -- Calculate total points for the user
    SELECT COALESCE(SUM(points), 0) INTO total_points
    FROM point_transactions
    WHERE user_id = NEW.user_id;
    
    -- Get old level (before this transaction)
    SELECT calculate_user_level(total_points - NEW.points) INTO old_level;
    
    -- Get new level (after this transaction)
    SELECT calculate_user_level(total_points) INTO new_level;
    
    -- Send notification if level increased
    IF new_level > old_level THEN
        PERFORM create_notification_if_enabled(
            NEW.user_id,
            'achievement_alerts',
            'Milestone Reached! ⭐',
            'Milestone Reached: Level ' || new_level || ' achieved with ' || total_points || ' points!',
            '/profile',
            'badge',
            NEW.user_id::text
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on point_transactions to check for level changes
DROP TRIGGER IF EXISTS level_milestone_notification ON point_transactions;
CREATE TRIGGER level_milestone_notification
    AFTER INSERT ON point_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_points_and_notify();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_badge_achievement() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_level_milestone() TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_points_and_notify() TO authenticated;
GRANT EXECUTE ON FUNCTION send_weekly_points_notifications() TO authenticated;

-- Create a scheduled job for weekly points notifications (if pg_cron is available)
-- This would typically be set up by a database administrator
-- SELECT cron.schedule('weekly-points-notifications', '0 9 * * 1', 'SELECT send_weekly_points_notifications();');

COMMENT ON FUNCTION send_weekly_points_notifications() IS 'Send weekly points summary notifications to all users. Should be called by a scheduled job every Monday at 9 AM.';
