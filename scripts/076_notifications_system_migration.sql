-- Notifications System Migration Script
-- This script creates the notifications table and updates user preferences for the new notification types

-- First, let's create the notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link_url VARCHAR(500),
    link_type VARCHAR(50), -- 'action', 'challenge', 'team', 'reward', 'announcement', 'education', 'leaderboard', 'badge'
    link_id UUID, -- ID of the related entity
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Enable RLS on notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Only system/admin can insert notifications (we'll handle this via server-side functions)
CREATE POLICY "System can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Add new notification preference columns to user_preferences table
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS action_status BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS challenge_progress BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS team_updates BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS announcements BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS educational_content BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS reward_status BOOLEAN DEFAULT TRUE;

-- Remove email_notifications and weekly_digest columns as they're not implemented
ALTER TABLE user_preferences 
DROP COLUMN IF EXISTS email_notifications,
DROP COLUMN IF EXISTS weekly_digest,
DROP COLUMN IF EXISTS team_invitations;

-- Update the existing achievement_alerts and leaderboard_updates to match our new system
-- (These columns should already exist, but let's ensure they have the right defaults)
ALTER TABLE user_preferences 
ALTER COLUMN achievement_alerts SET DEFAULT TRUE,
ALTER COLUMN leaderboard_updates SET DEFAULT FALSE;

-- Create a function to automatically create notifications
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

-- Create a function to mark notifications as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications 
    SET is_read = TRUE, updated_at = NOW()
    WHERE id = notification_id AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE notifications 
    SET is_read = TRUE, updated_at = NOW()
    WHERE user_id = p_user_id AND is_read = FALSE;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    unread_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unread_count
    FROM notifications
    WHERE user_id = p_user_id AND is_read = FALSE;
    
    RETURN unread_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing user preferences to have the new notification settings
UPDATE user_preferences 
SET 
    action_status = COALESCE(action_status, TRUE),
    challenge_progress = COALESCE(challenge_progress, TRUE),
    team_updates = COALESCE(team_updates, TRUE),
    announcements = COALESCE(announcements, TRUE),
    educational_content = COALESCE(educational_content, TRUE),
    reward_status = COALESCE(reward_status, TRUE),
    achievement_alerts = COALESCE(achievement_alerts, TRUE),
    leaderboard_updates = COALESCE(leaderboard_updates, FALSE);

-- Create updated trigger function for user preferences creation
CREATE OR REPLACE FUNCTION create_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
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
        NEW.id,
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
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists (recreate if needed)
DROP TRIGGER IF EXISTS create_user_preferences_trigger ON users;
CREATE TRIGGER create_user_preferences_trigger
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_preferences();

COMMENT ON TABLE notifications IS 'Stores in-app notifications for users with links to related content';
COMMENT ON FUNCTION create_notification IS 'Creates a notification for a user if they have that notification type enabled';
COMMENT ON FUNCTION mark_notification_read IS 'Marks a specific notification as read for a user';
COMMENT ON FUNCTION mark_all_notifications_read IS 'Marks all unread notifications as read for a user';
COMMENT ON FUNCTION get_unread_notification_count IS 'Returns the count of unread notifications for a user';
