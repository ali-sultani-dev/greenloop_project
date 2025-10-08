-- Fix duplicate notifications for personal action approvals
-- The issue: Two triggers send notifications for the same personal action approval
-- 1. trigger_notify_user_action_submission_approved (when sustainability_actions.is_active = true)
-- 2. trigger_notify_action_status_change (when user_actions is inserted with verification_status = 'approved')

-- Solution: Modify notify_action_status_change to skip auto-logged actions
CREATE OR REPLACE FUNCTION notify_action_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    action_title TEXT;
    is_auto_logged BOOLEAN := FALSE;
BEGIN
    -- Only process status changes to approved or rejected
    IF NEW.verification_status IN ('approved', 'rejected') AND 
       (OLD IS NULL OR OLD.verification_status != NEW.verification_status) THEN
        
        -- Check if this is an auto-logged action (from personal action approval)
        -- Auto-logged actions have notes = 'Auto-logged upon action approval'
        IF NEW.notes = 'Auto-logged upon action approval' THEN
            is_auto_logged := TRUE;
        END IF;
        
        -- Skip notifications for auto-logged actions since they already get 
        -- notifications from trigger_notify_user_action_submission_approved
        IF NOT is_auto_logged THEN
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
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the transaction
        RAISE WARNING 'Error sending action status notification for user %: %', NEW.user_id, SQLERRM;
        RETURN NEW;
END;
$$;
