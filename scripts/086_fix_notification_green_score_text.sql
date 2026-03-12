-- Replace "kg CO2 impact" with "Green Score:" in notification messages
-- Updates the two trigger functions that generate action approval notifications

-- 1. Fix notify_action_status_change (fires on user_actions approval)
CREATE OR REPLACE FUNCTION "public"."notify_action_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    action_title TEXT;
BEGIN
    -- Only process status changes, not other updates
    IF TG_OP = 'UPDATE' AND OLD.verification_status = NEW.verification_status THEN
        RETURN NEW;
    END IF;

    IF NEW.verification_status IN ('approved', 'rejected') THEN
        SELECT title INTO action_title
        FROM sustainability_actions
        WHERE id = NEW.action_id;

        IF NEW.verification_status = 'approved' THEN
            PERFORM create_notification_if_enabled(
                NEW.user_id,
                'action_status',
                'Action Approved! ✅',
                'Your action ''' || COALESCE(action_title, 'Sustainability Action') || ''' has been approved! +' ||
                COALESCE(NEW.points_earned, 0) || ' points earned' ||
                CASE WHEN NEW.co2_saved > 0 THEN ' • Green Score: ' || NEW.co2_saved ELSE '' END,
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
        RAISE WARNING 'Error sending action status notification for user %: %', NEW.user_id, SQLERRM;
        RETURN NEW;
END;
$$;

-- 2. Fix notify_user_action_submission_approved (fires when user-submitted actions are approved)
CREATE OR REPLACE FUNCTION "public"."notify_user_action_submission_approved"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Only process when a user-submitted action becomes active (approved)
    IF NEW.is_active = TRUE AND NEW.is_user_created = TRUE AND NEW.submitted_by IS NOT NULL AND
       (OLD IS NULL OR OLD.is_active != TRUE) THEN

        PERFORM create_notification_if_enabled(
            NEW.submitted_by,
            'action_status',
            'Action Approved! ✅',
            'Your submitted action ''' || NEW.title || ''' has been approved! +' ||
            COALESCE(NEW.points_value, 0) || ' points earned' ||
            CASE WHEN NEW.co2_impact > 0 THEN ' • Green Score: ' || NEW.co2_impact ELSE '' END,
            '/actions',
            'action',
            NEW.id::TEXT
        );
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error sending user action submission notification for user %: %', NEW.submitted_by, SQLERRM;
        RETURN NEW;
END;
$$;
