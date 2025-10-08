-- Fix badge notification function to use correct column name
-- The badges table has 'name' column, not 'badge_name'

-- Drop the trigger FIRST before dropping the function to avoid dependency errors
DROP TRIGGER IF EXISTS badge_achievement_notification ON user_badges;

-- Drop the existing function with incorrect column reference
DROP FUNCTION IF EXISTS notify_badge_achievement();

-- Recreate the function with correct column reference
CREATE OR REPLACE FUNCTION notify_badge_achievement()
RETURNS TRIGGER AS $$
DECLARE
    badge_name_text TEXT;
BEGIN
    -- Get the badge name from the badges table
    SELECT name INTO badge_name_text
    FROM badges
    WHERE id = NEW.badge_id;
    
    -- Send notification for new badge achievement
    PERFORM create_notification_if_enabled(
        NEW.user_id,
        'achievement_alerts',
        'New Achievement Unlocked! 🏆',
        'New Achievement Unlocked: ''' || badge_name_text || '''',
        '/badges',
        'badge',
        NEW.id::text
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER badge_achievement_notification
    AFTER INSERT ON user_badges
    FOR EACH ROW
    EXECUTE FUNCTION notify_badge_achievement();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_badge_achievement() TO authenticated;
