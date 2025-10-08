-- Add leaderboard notification system
-- This script creates functions to track leaderboard changes and send notifications

-- Function to calculate user's current leaderboard position
CREATE OR REPLACE FUNCTION get_user_leaderboard_position(user_id_param UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_position INTEGER;
BEGIN
    SELECT position INTO user_position
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (ORDER BY points DESC, created_at ASC) as position
        FROM users 
        WHERE is_active = true
    ) ranked_users
    WHERE id = user_id_param;
    
    RETURN COALESCE(user_position, 0);
END;
$$;

-- Function to track leaderboard changes and send notifications
CREATE OR REPLACE FUNCTION track_leaderboard_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    old_position INTEGER;
    new_position INTEGER;
    position_change INTEGER;
BEGIN
    -- Only process when points change
    IF NEW.points != OLD.points THEN
        -- Get old position (approximate based on old points)
        SELECT COUNT(*) + 1 INTO old_position
        FROM users 
        WHERE points > OLD.points AND is_active = true;
        
        -- Get new position
        new_position := get_user_leaderboard_position(NEW.id);
        
        -- Calculate position change
        position_change := old_position - new_position;
        
        -- Send notifications based on position changes
        IF position_change > 0 THEN
            -- User moved up
            IF new_position = 1 THEN
                -- User reached #1
                PERFORM create_notification(
                    NEW.id,
                    'leaderboard_updates',
                    'Top of Leaderboard! 🥇',
                    'Congratulations! You''re now #1 on the leaderboard!',
                    '/leaderboard',
                    'leaderboard',
                    NULL
                );
            ELSIF position_change >= 5 THEN
                -- Significant movement (5+ positions)
                PERFORM create_notification(
                    NEW.id,
                    'leaderboard_updates',
                    'Leaderboard Update 📈',
                    format('You moved up %s positions on the leaderboard! Now ranked #%s', position_change, new_position),
                    '/leaderboard',
                    'leaderboard',
                    NULL
                );
            END IF;
        END IF;
        
        -- Check for trending (weekly basis - simplified to recent activity)
        -- This is a simplified version - in production you might want more sophisticated trending logic
        IF position_change >= 3 AND NEW.updated_at > NOW() - INTERVAL '7 days' THEN
            PERFORM create_notification(
                NEW.id,
                'leaderboard_updates',
                'Trending Up! ⚡',
                format('You''re trending up! +%s positions this week', position_change),
                '/leaderboard',
                'leaderboard',
                NULL
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for leaderboard notifications
DROP TRIGGER IF EXISTS leaderboard_notification_trigger ON users;
CREATE TRIGGER leaderboard_notification_trigger
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (NEW.points IS DISTINCT FROM OLD.points)
    EXECUTE FUNCTION track_leaderboard_changes();
