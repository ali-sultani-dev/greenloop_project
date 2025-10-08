-- Simple diagnostic to check basic data existence
-- Check if user actions exist
SELECT 'User Actions Count' as check_type, COUNT(*) as count FROM user_actions;

-- Check recent user actions (last 7 days)
SELECT 'Recent User Actions' as check_type, COUNT(*) as count 
FROM user_actions 
WHERE completed_at >= NOW() - INTERVAL '7 days';

-- Check user actions with details
SELECT 
    ua.id,
    ua.user_id,
    ua.action_id,
    ua.completed_at,
    ua.verification_status,
    sa.title as action_title,
    ac.name as category_name
FROM user_actions ua
LEFT JOIN sustainability_actions sa ON ua.action_id = sa.id
LEFT JOIN action_categories ac ON sa.category_id = ac.id
ORDER BY ua.completed_at DESC
LIMIT 10;

-- Check challenge participants
SELECT 'Challenge Participants Count' as check_type, COUNT(*) as count FROM challenge_participants;

-- Check challenges
SELECT 
    c.id,
    c.title,
    c.category,
    c.start_date,
    c.end_date
FROM challenges c
ORDER BY c.created_at DESC
LIMIT 5;

-- Removed challenge_progress table check since it doesn't exist
-- This explains why challenge progress isn't working!

-- Check if trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'update_challenge_progress_trigger';
