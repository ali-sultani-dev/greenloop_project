-- Final comprehensive fix for badge awarding system
-- Addresses all column reference issues and ensures proper functionality

-- Drop all existing triggers first to avoid dependency issues
DROP TRIGGER IF EXISTS trigger_award_new_badge ON badges;
DROP TRIGGER IF EXISTS trigger_award_updated_badge ON badges;
DROP TRIGGER IF EXISTS trigger_reevaluate_badge_on_update ON badges;

-- Drop all existing functions
DROP FUNCTION IF EXISTS award_new_badge_to_qualifying_users();
DROP FUNCTION IF EXISTS award_new_badge_to_qualifying_users(uuid);
DROP FUNCTION IF EXISTS award_badge_to_all_qualifying_users(uuid);
DROP FUNCTION IF EXISTS trigger_award_new_badge();
DROP FUNCTION IF EXISTS trigger_award_updated_badge();
DROP FUNCTION IF EXISTS reevaluate_badge_awards();

-- Create the main badge awarding function that handles both INSERT and UPDATE
CREATE OR REPLACE FUNCTION reevaluate_badge_awards()
RETURNS TRIGGER AS $$
BEGIN
    -- For UPDATE operations, remove badges from users who no longer qualify
    IF TG_OP = 'UPDATE' THEN
        DELETE FROM user_badges ub
        WHERE ub.badge_id = NEW.id
        AND NOT EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = ub.user_id
            AND NEW.is_active = true
            AND (
                -- Fixed criteria_type values to match database: 'actions' instead of 'actions_completed'
                (NEW.criteria_type = 'actions' AND (
                    SELECT COUNT(*) 
                    FROM user_actions ua 
                    WHERE ua.user_id = u.id 
                    AND ua.verification_status = 'approved'
                ) >= NEW.criteria_value)
                OR
                -- Fixed criteria_type values to match database: 'points' instead of 'points_earned'
                (NEW.criteria_type = 'points' AND u.points >= NEW.criteria_value)
                OR
                (NEW.criteria_type = 'co2_saved' AND u.total_co2_saved >= NEW.criteria_value)
            )
        );
    END IF;
    
    -- Award badge to qualifying users who don't already have it (for both INSERT and UPDATE)
    INSERT INTO user_badges (user_id, badge_id, earned_at)
    SELECT DISTINCT u.id, NEW.id, NOW()
    FROM users u
    WHERE NEW.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM user_badges ub 
        WHERE ub.user_id = u.id AND ub.badge_id = NEW.id
    )
    AND (
        -- Fixed criteria_type values to match database: 'actions' instead of 'actions_completed'
        (NEW.criteria_type = 'actions' AND (
            SELECT COUNT(*) 
            FROM user_actions ua 
            WHERE ua.user_id = u.id 
            AND ua.verification_status = 'approved'
        ) >= NEW.criteria_value)
        OR
        -- Fixed criteria_type values to match database: 'points' instead of 'points_earned'
        (NEW.criteria_type = 'points' AND u.points >= NEW.criteria_value)
        OR
        (NEW.criteria_type = 'co2_saved' AND u.total_co2_saved >= NEW.criteria_value)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new badge creation (INSERT)
CREATE TRIGGER trigger_award_new_badge
    AFTER INSERT ON badges
    FOR EACH ROW
    EXECUTE FUNCTION reevaluate_badge_awards();

-- Create trigger for badge updates (UPDATE) - fixed column reference
CREATE TRIGGER trigger_reevaluate_badge_on_update
    AFTER UPDATE ON badges
    FOR EACH ROW
    WHEN (NEW.criteria_value IS DISTINCT FROM OLD.criteria_value
          OR NEW.criteria_type IS DISTINCT FROM OLD.criteria_type
          OR NEW.is_active IS DISTINCT FROM OLD.is_active)
    EXECUTE FUNCTION reevaluate_badge_awards();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION reevaluate_badge_awards() TO authenticated;

-- Manually trigger badge awarding for existing active badges to fix current state
DO $$
DECLARE
    badge_record RECORD;
BEGIN
    FOR badge_record IN SELECT * FROM badges WHERE is_active = true LOOP
        -- Award badges to qualifying users who don't already have them
        INSERT INTO user_badges (user_id, badge_id, earned_at)
        SELECT DISTINCT u.id, badge_record.id, NOW()
        FROM users u
        WHERE NOT EXISTS (
            SELECT 1 FROM user_badges ub 
            WHERE ub.user_id = u.id AND ub.badge_id = badge_record.id
        )
        AND (
            -- Fixed criteria_type values to match database: 'actions' instead of 'actions_completed'
            (badge_record.criteria_type = 'actions' AND (
                SELECT COUNT(*) 
                FROM user_actions ua 
                WHERE ua.user_id = u.id 
                AND ua.verification_status = 'approved'
            ) >= badge_record.criteria_value)
            OR
            -- Fixed criteria_type values to match database: 'points' instead of 'points_earned'
            (badge_record.criteria_type = 'points' AND u.points >= badge_record.criteria_value)
            OR
            (badge_record.criteria_type = 'co2_saved' AND u.total_co2_saved >= badge_record.criteria_value)
        );
    END LOOP;
END;
$$;
