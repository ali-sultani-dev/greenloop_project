-- Comprehensive notification system fixes
-- This script addresses all missing notification triggers and database errors

-- First, ensure all users have notification preferences
INSERT INTO user_preferences (
    user_id,
    profile_visibility,
    leaderboard_participation,
    analytics_sharing,
    action_status,
    challenge_progress,
    team_updates,
    announcements,
    educational_content,
    reward_status,
    achievement_alerts,
    leaderboard_updates
)
SELECT 
    u.id,
    'public',
    TRUE,
    TRUE,
    TRUE,  -- Enable action status notifications by default
    TRUE,
    TRUE,
    TRUE,  -- Enable announcement notifications by default
    TRUE,  -- Enable educational content notifications by default
    TRUE,
    TRUE,
    FALSE
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_preferences up WHERE up.user_id = u.id
);

-- Fix the create_notification function to handle all edge cases
CREATE OR REPLACE FUNCTION create_notification_if_enabled(
    p_user_id UUID,
    p_type VARCHAR,
    p_title VARCHAR,
    p_message TEXT,
    p_link_url VARCHAR DEFAULT NULL,
    p_link_type VARCHAR DEFAULT NULL,
    p_link_id TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    notification_id UUID;
    user_pref_enabled BOOLEAN := FALSE;
    link_id_uuid UUID;
BEGIN
    -- Convert link_id from text to UUID if provided
    IF p_link_id IS NOT NULL THEN
        BEGIN
            link_id_uuid := p_link_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            link_id_uuid := NULL;
        END;
    END IF;

    -- Ensure user has notification preferences
    INSERT INTO user_preferences (
        user_id,
        profile_visibility,
        leaderboard_participation,
        analytics_sharing,
        action_status,
        challenge_progress,
        team_updates,
        announcements,
        educational_content,
        reward_status,
        achievement_alerts,
        leaderboard_updates
    ) VALUES (
        p_user_id,
        'public',
        TRUE,
        TRUE,
        TRUE,
        TRUE,
        TRUE,
        TRUE,
        TRUE,
        TRUE,
        TRUE,
        FALSE
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Check if user has this notification type enabled
    CASE p_type
        WHEN 'action_status' THEN
            SELECT COALESCE(action_status, TRUE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'challenge_progress' THEN
            SELECT COALESCE(challenge_progress, TRUE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'team_updates' THEN
            SELECT COALESCE(team_updates, TRUE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'announcements' THEN
            SELECT COALESCE(announcements, TRUE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'educational_content' THEN
            SELECT COALESCE(educational_content, TRUE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'reward_status' THEN
            SELECT COALESCE(reward_status, TRUE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'achievement_alerts' THEN
            SELECT COALESCE(achievement_alerts, TRUE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'leaderboard_updates' THEN
            SELECT COALESCE(leaderboard_updates, FALSE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        ELSE
            user_pref_enabled := TRUE; -- Default to enabled for unknown types
    END CASE;

    -- Only create notification if user has this type enabled
    IF user_pref_enabled THEN
        INSERT INTO notifications (user_id, type, title, message, link_url, link_type, link_id)
        VALUES (p_user_id, p_type, p_title, p_message, p_link_url, p_link_type, link_id_uuid)
        RETURNING id INTO notification_id;
    END IF;

    RETURN notification_id;
END;
$$;

-- Create trigger function for announcement notifications
CREATE OR REPLACE FUNCTION notify_announcement_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Only send notifications for published announcements
    IF NEW.type = 'announcement' AND NEW.status = 'published' THEN
        -- Send notification to all active users
        FOR user_record IN 
            SELECT id FROM users WHERE is_active = TRUE
        LOOP
            PERFORM create_notification_if_enabled(
                user_record.id,
                'announcements',
                'New Announcement: ' || NEW.title || ' 📢',
                COALESCE(LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END, 'New announcement: ' || NEW.title),
                '/announcements',
                'announcement',
                NEW.id::TEXT
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger function for educational content notifications
CREATE OR REPLACE FUNCTION notify_educational_content_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Only send notifications for published educational content
    IF NEW.type = 'educational' AND NEW.status = 'published' THEN
        -- Send notification to all active users
        FOR user_record IN 
            SELECT id FROM users WHERE is_active = TRUE
        LOOP
            PERFORM create_notification_if_enabled(
                user_record.id,
                'educational_content',
                'New Educational Content: ''' || NEW.title || ''' 📚',
                'New educational content available: ' || NEW.title,
                '/education',
                'education',
                NEW.id::TEXT
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_notify_announcement_created ON content_items;
DROP TRIGGER IF EXISTS trigger_notify_educational_content_created ON content_items;

-- Create triggers for content notifications
CREATE TRIGGER trigger_notify_announcement_created
    AFTER INSERT ON content_items
    FOR EACH ROW
    WHEN (NEW.type = 'announcement' AND NEW.status = 'published')
    EXECUTE FUNCTION notify_announcement_created();

CREATE TRIGGER trigger_notify_educational_content_created
    AFTER INSERT ON content_items
    FOR EACH ROW
    WHEN (NEW.type = 'educational' AND NEW.status = 'published')
    EXECUTE FUNCTION notify_educational_content_created();

-- Fix the auto-log action error by improving the trigger
CREATE OR REPLACE FUNCTION simple_update_user_co2_savings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only update for approved actions
    IF NEW.verification_status = 'approved' AND (OLD IS NULL OR OLD.verification_status != 'approved') THEN
        -- Update user's total CO2 saved
        UPDATE users 
        SET total_co2_saved = COALESCE(total_co2_saved, 0) + COALESCE(NEW.co2_saved, 0)
        WHERE id = NEW.user_id;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the transaction
        RAISE WARNING 'Error updating CO2 savings for user %: %', NEW.user_id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Create a function to send action approval notifications via trigger
CREATE OR REPLACE FUNCTION notify_action_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    action_title TEXT;
BEGIN
    -- Only process status changes to approved or rejected
    IF NEW.verification_status IN ('approved', 'rejected') AND 
       (OLD IS NULL OR OLD.verification_status != NEW.verification_status) THEN
        
        -- Get the action title
        SELECT title INTO action_title 
        FROM sustainability_actions 
        WHERE id = NEW.action_id;
        
        -- Send appropriate notification
        IF NEW.verification_status = 'approved' THEN
            PERFORM create_notification_if_enabled(
                NEW.user_id,
                'action_status',
                'Action Approved! ✅',
                'Your action ''' || COALESCE(action_title, 'Sustainability Action') || ''' has been approved! +' || 
                COALESCE(NEW.points_earned, 0) || ' points earned' ||
                CASE WHEN NEW.co2_saved > 0 THEN ' • ' || NEW.co2_saved || ' kg CO2 impact' ELSE '' END,
                '/actions',
                'action',
                NEW.id::TEXT
            );
        ELSIF NEW.verification_status = 'rejected' THEN
            PERFORM create_notification_if_enabled(
                NEW.user_id,
                'action_status',
                'Action Rejected ❌',
                'Your action ''' || COALESCE(action_title, 'Sustainability Action') || ''' was rejected. Reason: ' || 
                COALESCE(NEW.notes, 'No reason provided'),
                '/actions',
                'action',
                NEW.id::TEXT
            );
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the transaction
        RAISE WARNING 'Error sending action status notification for user %: %', NEW.user_id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_notify_action_status_change ON user_actions;

-- Create trigger for action status notifications
CREATE TRIGGER trigger_notify_action_status_change
    AFTER INSERT OR UPDATE OF verification_status ON user_actions
    FOR EACH ROW
    EXECUTE FUNCTION notify_action_status_change();

-- Create a function to handle user-submitted action approval notifications
CREATE OR REPLACE FUNCTION notify_user_action_submission_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only process when a user-submitted action becomes active (approved)
    IF NEW.is_active = TRUE AND NEW.is_user_created = TRUE AND NEW.submitted_by IS NOT NULL AND
       (OLD IS NULL OR OLD.is_active != TRUE) THEN
        
        PERFORM create_notification_if_enabled(
            NEW.submitted_by,
            'action_status',
            'Action Approved! ✅',
            'Your submitted action ''' || NEW.title || ''' has been approved and is now available for everyone! +' || 
            COALESCE(NEW.points_value, 0) || ' points earned' ||
            CASE WHEN NEW.co2_impact > 0 THEN ' • ' || NEW.co2_impact || ' kg CO2 impact' ELSE '' END,
            '/actions',
            'action',
            NEW.id::TEXT
        );
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the transaction
        RAISE WARNING 'Error sending user action submission notification for user %: %', NEW.submitted_by, SQLERRM;
        RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_notify_user_action_submission_approved ON sustainability_actions;

-- Create trigger for user-submitted action approvals
CREATE TRIGGER trigger_notify_user_action_submission_approved
    AFTER UPDATE OF is_active ON sustainability_actions
    FOR EACH ROW
    EXECUTE FUNCTION notify_user_action_submission_approved();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_notification_if_enabled TO authenticated;
GRANT EXECUTE ON FUNCTION notify_announcement_created TO authenticated;
GRANT EXECUTE ON FUNCTION notify_educational_content_created TO authenticated;
GRANT EXECUTE ON FUNCTION notify_action_status_change TO authenticated;
GRANT EXECUTE ON FUNCTION notify_user_action_submission_approved TO authenticated;
GRANT EXECUTE ON FUNCTION simple_update_user_co2_savings TO authenticated;

-- Update any existing users who might not have preferences
UPDATE user_preferences 
SET 
    action_status = TRUE,
    announcements = TRUE,
    educational_content = TRUE
WHERE action_status IS NULL OR announcements IS NULL OR educational_content IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON notifications(user_id, type);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_content_items_type_status ON content_items(type, status);
CREATE INDEX IF NOT EXISTS idx_user_actions_verification_status ON user_actions(verification_status);
CREATE INDEX IF NOT EXISTS idx_sustainability_actions_user_created ON sustainability_actions(is_user_created, is_active);
