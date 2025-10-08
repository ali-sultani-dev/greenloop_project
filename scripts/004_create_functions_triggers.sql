-- GreenLoop Database Schema - Functions and Triggers
-- This script creates database functions and triggers for automation

-- =============================================
-- USER PROFILE MANAGEMENT
-- =============================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    department,
    job_title,
    employee_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', 'User'),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    NEW.raw_user_meta_data ->> 'department',
    NEW.raw_user_meta_data ->> 'job_title',
    NEW.raw_user_meta_data ->> 'employee_id'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- POINTS AND GAMIFICATION
-- =============================================

-- Function to update user points and level
CREATE OR REPLACE FUNCTION public.update_user_points()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_total_points INTEGER;
  new_level INTEGER;
BEGIN
  -- Calculate new total points
  SELECT COALESCE(SUM(points), 0) INTO new_total_points
  FROM public.point_transactions
  WHERE user_id = NEW.user_id;

  -- Calculate new level (every 1000 points = 1 level)
  new_level := GREATEST(1, (new_total_points / 1000) + 1);

  -- Update user record
  UPDATE public.users
  SET 
    points = new_total_points,
    level = new_level,
    updated_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Trigger for point transactions
DROP TRIGGER IF EXISTS on_point_transaction_created ON public.point_transactions;
CREATE TRIGGER on_point_transaction_created
  AFTER INSERT ON public.point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_points();

-- Function to update user CO2 savings
CREATE OR REPLACE FUNCTION public.update_user_co2_savings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_total_co2 DECIMAL(10,2);
BEGIN
  -- Calculate new total CO2 saved
  SELECT COALESCE(SUM(co2_saved), 0) INTO new_total_co2
  FROM public.user_actions
  WHERE user_id = NEW.user_id AND verification_status = 'approved';

  -- Update user record
  UPDATE public.users
  SET 
    total_co2_saved = new_total_co2,
    updated_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Trigger for user actions
DROP TRIGGER IF EXISTS on_user_action_approved ON public.user_actions;
CREATE TRIGGER on_user_action_approved
  AFTER INSERT OR UPDATE ON public.user_actions
  FOR EACH ROW
  WHEN (NEW.verification_status = 'approved')
  EXECUTE FUNCTION public.update_user_co2_savings();

-- =============================================
-- TEAM STATISTICS
-- =============================================

-- Function to update team statistics
CREATE OR REPLACE FUNCTION public.update_team_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  team_id_to_update UUID;
  new_total_points INTEGER;
  new_total_co2 DECIMAL(10,2);
BEGIN
  -- Get team ID from team_members table
  IF TG_TABLE_NAME = 'user_actions' THEN
    SELECT tm.team_id INTO team_id_to_update
    FROM public.team_members tm
    WHERE tm.user_id = NEW.user_id;
  ELSIF TG_TABLE_NAME = 'team_members' THEN
    team_id_to_update := NEW.team_id;
  END IF;

  -- Only proceed if user is in a team
  IF team_id_to_update IS NOT NULL THEN
    -- Calculate team totals
    SELECT 
      COALESCE(SUM(u.points), 0),
      COALESCE(SUM(u.total_co2_saved), 0)
    INTO new_total_points, new_total_co2
    FROM public.users u
    INNER JOIN public.team_members tm ON u.id = tm.user_id
    WHERE tm.team_id = team_id_to_update;

    -- Update team record
    UPDATE public.teams
    SET 
      total_points = new_total_points,
      total_co2_saved = new_total_co2,
      updated_at = NOW()
    WHERE id = team_id_to_update;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers for team statistics
DROP TRIGGER IF EXISTS on_team_member_change ON public.team_members;
CREATE TRIGGER on_team_member_change
  AFTER INSERT OR DELETE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_stats();

-- Adding missing trigger for user_actions to update team stats
DROP TRIGGER IF EXISTS on_user_action_for_team_stats ON public.user_actions;
CREATE TRIGGER on_user_action_for_team_stats
  AFTER INSERT OR UPDATE ON public.user_actions
  FOR EACH ROW
  WHEN (NEW.verification_status = 'approved')
  EXECUTE FUNCTION public.update_team_stats();

-- =============================================
-- BADGE AWARDING
-- =============================================

-- Function to check and award badges
CREATE OR REPLACE FUNCTION public.check_and_award_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  badge_record RECORD;
  user_value INTEGER;
BEGIN
  -- Loop through all active badges
  FOR badge_record IN 
    SELECT * FROM public.badges WHERE is_active = true
  LOOP
    -- Check if user already has this badge
    IF NOT EXISTS (
      SELECT 1 FROM public.user_badges 
      WHERE user_id = NEW.user_id AND badge_id = badge_record.id
    ) THEN
      -- Get user's current value for the badge criteria
      CASE badge_record.criteria_type
        WHEN 'points' THEN
          SELECT points INTO user_value FROM public.users WHERE id = NEW.user_id;
        WHEN 'actions' THEN
          SELECT COUNT(*) INTO user_value 
          FROM public.user_actions 
          WHERE user_id = NEW.user_id AND verification_status = 'approved';
        WHEN 'co2_saved' THEN
          SELECT FLOOR(total_co2_saved) INTO user_value 
          FROM public.users WHERE id = NEW.user_id;
        ELSE
          user_value := 0;
      END CASE;

      -- Award badge if criteria met
      IF user_value >= badge_record.criteria_value THEN
        INSERT INTO public.user_badges (user_id, badge_id)
        VALUES (NEW.user_id, badge_record.id)
        ON CONFLICT (user_id, badge_id) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger for badge checking (after user stats update)
DROP TRIGGER IF EXISTS on_user_stats_updated ON public.users;
CREATE TRIGGER on_user_stats_updated
  AFTER UPDATE ON public.users
  FOR EACH ROW
  WHEN (OLD.points != NEW.points OR OLD.total_co2_saved != NEW.total_co2_saved)
  EXECUTE FUNCTION public.check_and_award_badges();

-- =============================================
-- CHALLENGE PROGRESS TRACKING
-- =============================================

-- Function to update challenge progress
CREATE OR REPLACE FUNCTION public.update_challenge_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  participant_record RECORD;
  progress_value INTEGER;
BEGIN
  -- Update progress for individual challenges
  FOR participant_record IN 
    SELECT cp.* FROM public.challenge_participants cp
    INNER JOIN public.challenges c ON cp.challenge_id = c.id
    WHERE cp.user_id = NEW.user_id 
    AND c.challenge_type = 'individual'
    AND c.start_date <= NOW() 
    AND c.end_date >= NOW()
    AND cp.completed = false
  LOOP
    -- Calculate progress based on challenge metric
    SELECT 
      CASE 
        WHEN c.target_metric = 'points' THEN u.points
        WHEN c.target_metric = 'actions' THEN (
          SELECT COUNT(*) FROM public.user_actions ua 
          WHERE ua.user_id = NEW.user_id 
          AND ua.completed_at >= c.start_date
          AND ua.verification_status = 'approved'
        )
        WHEN c.target_metric = 'co2_saved' THEN FLOOR(u.total_co2_saved)
        ELSE 0
      END INTO progress_value
    FROM public.users u, public.challenges c
    WHERE u.id = NEW.user_id AND c.id = participant_record.challenge_id;

    -- Update participant progress
    UPDATE public.challenge_participants
    SET 
      current_progress = progress_value,
      completed = (progress_value >= (
        SELECT target_value FROM public.challenges WHERE id = participant_record.challenge_id
      )),
      completed_at = CASE 
        WHEN progress_value >= (
          SELECT target_value FROM public.challenges WHERE id = participant_record.challenge_id
        ) THEN NOW()
        ELSE NULL
      END
    WHERE id = participant_record.id;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger for challenge progress
DROP TRIGGER IF EXISTS on_user_progress_updated ON public.users;
CREATE TRIGGER on_user_progress_updated
  AFTER UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_challenge_progress();
