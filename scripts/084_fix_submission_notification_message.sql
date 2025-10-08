-- Fix the submission approval notification message to remove "and is now available for everyone"
-- This script updates the notify_user_action_submission_approved function

CREATE OR REPLACE FUNCTION "public"."notify_user_action_submission_approved"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Only process when a user-submitted action becomes active (approved)
    IF NEW.is_active = TRUE AND NEW.is_user_created = TRUE AND NEW.submitted_by IS NOT NULL AND
       (OLD IS NULL OR OLD.is_active != TRUE) THEN
        
        -- Removed "and is now available for everyone" from notification message
        PERFORM create_notification_if_enabled(
            NEW.submitted_by,
            'action_status',
            'Action Approved! ✅',
            'Your submitted action ''' || NEW.title || ''' has been approved! +' || 
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
