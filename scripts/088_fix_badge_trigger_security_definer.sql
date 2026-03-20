-- Migration: Fix check_and_award_badges() to use SECURITY DEFINER
-- Problem: check_and_award_badges() runs as the calling user (the authenticated
--          regular user who just logged an action). The user_badges table only has
--          an INSERT policy for admins (user_badges_admin_manage), so when the
--          trigger fires for a non-admin user it tries to INSERT into user_badges
--          and gets: "new row violates row-level security policy for table user_badges"
--          This is why new (non-admin) profiles get "Failed to log action" errors
--          while old admin profiles work fine.
-- Fix: Recreate check_and_award_badges() with SECURITY DEFINER so it always
--      runs with elevated privileges (as postgres), bypassing RLS for the badge insert.

CREATE OR REPLACE FUNCTION "public"."check_and_award_badges"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  badge_record RECORD;
  user_value INTEGER;
  target_user_id UUID;
BEGIN
  -- Determine the correct user_id based on trigger context
  -- When triggered from users table, use NEW.id
  -- When triggered from user_actions table, use NEW.user_id
  IF TG_TABLE_NAME = 'users' THEN
    target_user_id := NEW.id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;

  -- Loop through all active badges
  FOR badge_record IN
    SELECT * FROM public.badges WHERE is_active = true
  LOOP
    -- Check if user already has this badge
    IF NOT EXISTS (
      SELECT 1 FROM public.user_badges
      WHERE user_id = target_user_id AND badge_id = badge_record.id
    ) THEN
      -- Get user's current value for the badge criteria
      CASE badge_record.criteria_type
        WHEN 'points' THEN
          SELECT points INTO user_value FROM public.users WHERE id = target_user_id;
        WHEN 'actions' THEN
          SELECT COUNT(*) INTO user_value
          FROM public.user_actions
          WHERE user_id = target_user_id AND verification_status = 'approved';
        WHEN 'co2_saved' THEN
          SELECT FLOOR(total_co2_saved) INTO user_value
          FROM public.users WHERE id = target_user_id;
        ELSE
          user_value := 0;
      END CASE;

      -- Award badge if criteria met
      IF user_value >= badge_record.criteria_value THEN
        INSERT INTO public.user_badges (user_id, badge_id)
        VALUES (target_user_id, badge_record.id)
        ON CONFLICT (user_id, badge_id) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Re-grant execute so authenticated users can still fire the trigger indirectly
GRANT EXECUTE ON FUNCTION public.check_and_award_badges() TO authenticated;
