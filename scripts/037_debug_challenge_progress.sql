-- Debug script to check challenge progress issues
-- This will help identify why challenge progress isn't updating

-- First, let's check the current state of user actions
DO $$
DECLARE
    action_record RECORD;
    challenge_record RECORD;
    participant_record RECORD;
BEGIN
    RAISE NOTICE '=== DEBUGGING CHALLENGE PROGRESS ISSUES ===';
    
    -- Check recent user actions
    RAISE NOTICE '--- Recent User Actions ---';
    FOR action_record IN 
        SELECT ua.*, sa.title, sa.points_value, ac.name as category_name, u.first_name, u.last_name
        FROM user_actions ua
        JOIN sustainability_actions sa ON ua.action_id = sa.id
        JOIN action_categories ac ON sa.category_id = ac.id
        JOIN users u ON ua.user_id = u.id
        -- Fixed column reference from ua.created_at to ua.completed_at
        WHERE ua.completed_at >= NOW() - INTERVAL '1 day'
        ORDER BY ua.completed_at DESC
        LIMIT 10
    LOOP
        -- Fixed RAISE NOTICE syntax to use proper parameter formatting
        RAISE NOTICE 'Action: % by % %, Category: %, Status: %, Completed: %', 
            action_record.title, 
            action_record.first_name, 
            action_record.last_name,
            action_record.category_name,
            action_record.verification_status,
            action_record.completed_at;
    END LOOP;
    
    -- Check active challenges
    RAISE NOTICE '--- Active Challenges ---';
    FOR challenge_record IN 
        SELECT c.*, COUNT(cp.id) as participant_count
        FROM challenges c
        LEFT JOIN challenge_participants cp ON c.id = cp.challenge_id
        WHERE c.is_active = true
        GROUP BY c.id, c.title, c.category, c.target_metric, c.target_value, c.start_date, c.end_date, c.created_at, c.is_active
        ORDER BY c.created_at DESC
    LOOP
        -- Fixed RAISE NOTICE to match parameter count with placeholders
        RAISE NOTICE 'Challenge: %, Category: %, Target: % %, Participants: %, Period: % to %', 
            challenge_record.title,
            challenge_record.category,
            challenge_record.target_value,
            challenge_record.target_metric,
            challenge_record.participant_count,
            challenge_record.start_date,
            challenge_record.end_date;
    END LOOP;
    
    -- Check challenge participants and their progress
    RAISE NOTICE '--- Challenge Participants Progress ---';
    FOR participant_record IN 
        SELECT cp.*, c.title as challenge_title, c.category, u.first_name, u.last_name
        FROM challenge_participants cp
        JOIN challenges c ON cp.challenge_id = c.id
        JOIN users u ON cp.user_id = u.id
        WHERE c.is_active = true
        ORDER BY cp.joined_at DESC
    LOOP
        -- Fixed RAISE NOTICE parameter formatting
        RAISE NOTICE 'Participant: % % in "%" (%), Progress: %, Completed: %', 
            participant_record.first_name,
            participant_record.last_name,
            participant_record.challenge_title,
            participant_record.category,
            participant_record.current_progress,
            participant_record.completed;
    END LOOP;
    
    -- Check if trigger function exists and is properly configured
    RAISE NOTICE '--- Trigger Configuration ---';
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_update_challenge_progress_on_action'
        AND event_object_table = 'user_actions'
    ) THEN
        RAISE NOTICE 'Trigger "trigger_update_challenge_progress_on_action" exists on user_actions table';
    ELSE
        RAISE NOTICE 'ERROR: Trigger "trigger_update_challenge_progress_on_action" NOT FOUND!';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'update_challenge_progress_on_action'
        AND routine_type = 'FUNCTION'
    ) THEN
        RAISE NOTICE 'Function "update_challenge_progress_on_action" exists';
    ELSE
        RAISE NOTICE 'ERROR: Function "update_challenge_progress_on_action" NOT FOUND!';
    END IF;
    
    -- Force recalculate all challenge progress within the DO block
    RAISE NOTICE '--- Forcing Challenge Progress Recalculation ---';
    PERFORM recalculate_all_challenge_progress();
    
    -- Check progress after recalculation
    RAISE NOTICE '--- Progress After Recalculation ---';
    FOR participant_record IN 
        SELECT cp.*, c.title as challenge_title, c.category, u.first_name, u.last_name
        FROM challenge_participants cp
        JOIN challenges c ON cp.challenge_id = c.id
        JOIN users u ON cp.user_id = u.id
        WHERE c.is_active = true
        ORDER BY cp.current_progress DESC
    LOOP
        -- Fixed RAISE NOTICE parameter formatting
        RAISE NOTICE 'Updated: % % in "%" (%), Progress: %, Completed: %', 
            participant_record.first_name,
            participant_record.last_name,
            participant_record.challenge_title,
            participant_record.category,
            participant_record.current_progress,
            participant_record.completed;
    END LOOP;
    
END $$;
