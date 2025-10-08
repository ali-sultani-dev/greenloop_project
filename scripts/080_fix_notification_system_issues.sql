-- Fix notification system issues
-- 1. Fix function name mismatch in triggers
-- 2. Ensure all users have notification preferences
-- 3. Create missing create_notification_if_enabled function

-- First, create the missing create_notification_if_enabled function that triggers are calling
CREATE OR REPLACE FUNCTION create_notification_if_enabled(
    p_user_id UUID,
    p_type VARCHAR(50),
    p_title VARCHAR(255),
    p_message TEXT,
    p_link_url VARCHAR(500) DEFAULT NULL,
    p_link_type VARCHAR(50) DEFAULT NULL,
    p_link_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
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

    -- Check if user has notification preferences, create if missing
    IF NOT EXISTS (SELECT 1 FROM user_preferences WHERE user_id = p_user_id) THEN
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
        );
    END IF;

    -- Check if user has this notification type enabled
    CASE p_type
        WHEN 'action_status' THEN
            SELECT action_status INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'challenge_progress' THEN
            SELECT challenge_progress INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'team_updates' THEN
            SELECT team_updates INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'announcements' THEN
            SELECT announcements INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'educational_content' THEN
            SELECT educational_content INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'reward_status' THEN
            SELECT reward_status INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'achievement_alerts' THEN
            SELECT achievement_alerts INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'leaderboard_updates' THEN
            SELECT leaderboard_updates INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure all existing users have notification preferences
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
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    FALSE
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_preferences up WHERE up.user_id = u.id
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_notification_if_enabled TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;

-- Update the original create_notification function to also handle missing preferences
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type VARCHAR(50),
    p_title VARCHAR(255),
    p_message TEXT,
    p_link_url VARCHAR(500) DEFAULT NULL,
    p_link_type VARCHAR(50) DEFAULT NULL,
    p_link_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    notification_id UUID;
    user_pref_enabled BOOLEAN := FALSE;
BEGIN
    -- Check if user has notification preferences, create if missing
    IF NOT EXISTS (SELECT 1 FROM user_preferences WHERE user_id = p_user_id) THEN
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
        );
    END IF;

    -- Check if user has this notification type enabled
    CASE p_type
        WHEN 'action_status' THEN
            SELECT action_status INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'challenge_progress' THEN
            SELECT challenge_progress INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'team_updates' THEN
            SELECT team_updates INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'announcements' THEN
            SELECT announcements INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'educational_content' THEN
            SELECT educational_content INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'reward_status' THEN
            SELECT reward_status INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'achievement_alerts' THEN
            SELECT achievement_alerts INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'leaderboard_updates' THEN
            SELECT leaderboard_updates INTO user_pref_enabled FROM user_preferences WHERE user_id = p_user_id;
        ELSE
            user_pref_enabled := TRUE; -- Default to enabled for unknown types
    END CASE;

    -- Only create notification if user has this type enabled
    IF user_pref_enabled THEN
        INSERT INTO notifications (user_id, type, title, message, link_url, link_type, link_id)
        VALUES (p_user_id, p_type, p_title, p_message, p_link_url, p_link_type, p_link_id)
        RETURNING id INTO notification_id;
    END IF;

    RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
