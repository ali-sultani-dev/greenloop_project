
\restrict DdMbd7uruyi8grk8leF4lIdqZJocSpXjwe6Djes3rqb3LewDgmDoivAvNjlcICP


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."auto_join_personal_challenge"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Auto-join creator to personal challenges
    IF NEW.challenge_type = 'individual' THEN
        INSERT INTO public.challenge_participants (
            challenge_id,
            user_id,
            current_progress,
            completed,
            joined_at
        ) VALUES (
            NEW.id,
            NEW.created_by,
            0,
            false,
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_join_personal_challenge"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_challenge_completion_rewards"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    challenge_record RECORD;
    team_member_record RECORD;
    reward_points INTEGER;
BEGIN
    -- Only process when a challenge is being marked as completed
    IF NEW.completed = true AND (OLD.completed IS NULL OR OLD.completed = false) THEN
        
        -- Get challenge details
        SELECT * INTO challenge_record
        FROM challenges 
        WHERE id = NEW.challenge_id;
        
        -- Only award points if challenge has reward points
        IF challenge_record.reward_points > 0 THEN
            
            CASE challenge_record.challenge_type
                WHEN 'individual' THEN
                    -- Individual challenges don't get reward points (already enforced in validation)
                    -- This case should never happen due to validation, but included for completeness
                    NULL;
                    
                WHEN 'team' THEN
                    -- Award points to all team members who participated in the challenge
                    FOR team_member_record IN
                        SELECT DISTINCT cp.user_id
                        FROM challenge_participants cp
                        WHERE cp.challenge_id = NEW.challenge_id
                        AND cp.user_id IS NOT NULL
                        AND cp.completed = true
                    LOOP
                        -- Create point transaction for each team member
                        INSERT INTO point_transactions (
                            user_id,
                            points,
                            transaction_type,
                            description,
                            reference_id,
                            reference_type
                        ) VALUES (
                            team_member_record.user_id,
                            challenge_record.reward_points,
                            'challenge_reward',
                            format('Completed team challenge: %s', challenge_record.title),
                            challenge_record.id,
                            'challenge'
                        );
                        
                        RAISE NOTICE 'Awarded % points to user % for completing team challenge %', 
                            challenge_record.reward_points, team_member_record.user_id, challenge_record.title;
                    END LOOP;
                    
                WHEN 'company' THEN
                    -- Award points to the individual user who completed the company challenge
                    INSERT INTO point_transactions (
                        user_id,
                        points,
                        transaction_type,
                        description,
                        reference_id,
                        reference_type
                    ) VALUES (
                        NEW.user_id,
                        challenge_record.reward_points,
                        'challenge_reward',
                        format('Completed company challenge: %s', challenge_record.title),
                        challenge_record.id,
                        'challenge'
                    );
                    
                    RAISE NOTICE 'Awarded % points to user % for completing company challenge %', 
                        challenge_record.reward_points, NEW.user_id, challenge_record.title;
                        
            END CASE;
            
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."award_challenge_completion_rewards"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_user_level"("user_points" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    threshold_record RECORD;
    user_level INTEGER := 1;
BEGIN
    -- Get the highest level where user has enough points
    FOR threshold_record IN 
        SELECT level, points_required 
        FROM level_thresholds 
        ORDER BY level DESC
    LOOP
        IF user_points >= threshold_record.points_required THEN
            user_level := threshold_record.level;
            EXIT;
        END IF;
    END LOOP;
    
    RETURN user_level;
END;
$$;


ALTER FUNCTION "public"."calculate_user_level"("user_points" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_leave_team_challenge"("participant_user_id" "uuid", "challenge_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    challenge_type TEXT;
    user_team_id UUID;
    challenge_team_id UUID;
    is_team_leader BOOLEAN := FALSE;
BEGIN
    -- Get challenge type and team
    SELECT c.challenge_type, cp.team_id INTO challenge_type, challenge_team_id
    FROM public.challenges c
    LEFT JOIN public.challenge_participants cp ON c.id = cp.challenge_id
    WHERE c.id = challenge_uuid
    AND cp.user_id = participant_user_id
    LIMIT 1;
    
    -- If not a team challenge, allow leaving
    IF challenge_type != 'team' THEN
        RETURN TRUE;
    END IF;
    
    -- Get user's team
    SELECT tm.team_id INTO user_team_id
    FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
    LIMIT 1;
    
    -- Check if user is team leader of the challenge team
    IF challenge_team_id IS NOT NULL AND user_team_id = challenge_team_id THEN
        SELECT EXISTS (
            SELECT 1 FROM public.teams 
            WHERE id = challenge_team_id 
            AND team_leader_id = auth.uid()
        ) INTO is_team_leader;
        
        -- Team leaders can remove team members
        IF is_team_leader THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    -- Regular team members can only leave their own participation
    RETURN auth.uid() = participant_user_id;
END;
$$;


ALTER FUNCTION "public"."can_leave_team_challenge"("participant_user_id" "uuid", "challenge_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_award_badges"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."check_and_award_badges"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_max_participants"("challenge_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    max_count INTEGER;
    current_count INTEGER;
BEGIN
    -- Get max participants for the challenge
    SELECT max_participants INTO max_count
    FROM public.challenges
    WHERE id = challenge_uuid;
    
    -- If no limit, allow join
    IF max_count IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Count current participants using a direct query
    SELECT COUNT(*) INTO current_count
    FROM public.challenge_participants
    WHERE challenge_id = challenge_uuid;
    
    -- Return whether there's space
    RETURN current_count < max_count;
END;
$$;


ALTER FUNCTION "public"."check_max_participants"("challenge_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_personal_challenge_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    recent_count INTEGER;
BEGIN
    -- Rate limit personal challenge creation: max 5 per day
    IF NEW.challenge_type = 'individual' THEN
        SELECT COUNT(*) INTO recent_count
        FROM public.challenges
        WHERE created_by = auth.uid()
        AND challenge_type = 'individual'
        AND created_at > NOW() - INTERVAL '24 hours';
        
        IF recent_count >= 5 THEN
            RAISE EXCEPTION 'Rate limit exceeded: Maximum 5 personal challenges per day'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_personal_challenge_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_privilege_escalation"() RETURNS TABLE("user_id" "uuid", "event_type" "text", "details" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sal.user_id,
    sal.event_type,
    sal.details
  FROM public.security_audit_log sal
  WHERE sal.created_at > NOW() - INTERVAL '24 hours'
    AND sal.event_type LIKE '%admin%'
    AND sal.severity IN ('high', 'critical')
  ORDER BY sal.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."check_privilege_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_password_resets"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM public.password_resets 
  WHERE expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_password_resets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_sessions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM public.user_sessions 
  WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_sessions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link_url" character varying DEFAULT NULL::character varying, "p_link_type" character varying DEFAULT NULL::character varying, "p_link_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link_url" character varying, "p_link_type" character varying, "p_link_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link_url" character varying, "p_link_type" character varying, "p_link_id" "uuid") IS 'Creates a notification for a user if they have that notification type enabled';



CREATE OR REPLACE FUNCTION "public"."create_notification_if_enabled"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link_url" character varying DEFAULT NULL::character varying, "p_link_type" character varying DEFAULT NULL::character varying, "p_link_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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

    -- Ensure user has notification preferences
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
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Check if user has this notification type enabled
    CASE p_type
        WHEN 'action_status' THEN
            SELECT COALESCE(action_status, TRUE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'challenge_progress' THEN
            SELECT COALESCE(challenge_progress, TRUE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'team_updates' THEN
            SELECT COALESCE(team_updates, TRUE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'announcements' THEN
            SELECT COALESCE(announcements, TRUE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'educational_content' THEN
            SELECT COALESCE(educational_content, TRUE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'reward_status' THEN
            SELECT COALESCE(reward_status, TRUE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'achievement_alerts' THEN
            SELECT COALESCE(achievement_alerts, TRUE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
        WHEN 'leaderboard_updates' THEN
            SELECT COALESCE(leaderboard_updates, FALSE) INTO user_pref_enabled 
            FROM user_preferences WHERE user_id = p_user_id;
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
$$;


ALTER FUNCTION "public"."create_notification_if_enabled"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link_url" character varying, "p_link_type" character varying, "p_link_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_team_challenge_participants"("p_challenge_id" "uuid", "p_team_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Insert individual user records for each team member (including leaders)
    INSERT INTO challenge_participants (
        challenge_id,
        user_id,
        team_id,
        current_progress,
        completed,
        joined_at
    )
    SELECT DISTINCT
        p_challenge_id,
        tm.user_id,
        p_team_id,
        0,
        false,
        NOW()
    FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    JOIN users u ON tm.user_id = u.id
    WHERE tm.team_id = p_team_id
    AND t.is_active = true
    AND u.is_active = true
    
    UNION
    
    -- Also ensure team leader is included (in case they're not in team_members)
    SELECT DISTINCT
        p_challenge_id,
        t.team_leader_id,
        p_team_id,
        0,
        false,
        NOW()
    FROM teams t
    JOIN users u ON t.team_leader_id = u.id
    WHERE t.id = p_team_id
    AND t.team_leader_id IS NOT NULL
    AND t.is_active = true
    AND u.is_active = true
    
    ON CONFLICT (challenge_id, user_id) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."create_team_challenge_participants"("p_challenge_id" "uuid", "p_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_preferences"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."create_user_preferences"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detect_suspicious_activity"() RETURNS TABLE("user_id" "uuid", "activity_type" "text", "count" bigint, "severity" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Return users with excessive failed login attempts (would need to track this)
  RETURN QUERY
  SELECT 
    ua.user_id,
    'excessive_actions' as activity_type,
    COUNT(*) as count,
    CASE 
      WHEN COUNT(*) > 100 THEN 'high'
      WHEN COUNT(*) > 50 THEN 'medium'
      ELSE 'low'
    END as severity
  FROM public.user_actions ua
  WHERE ua.completed_at > NOW() - INTERVAL '1 hour'
  GROUP BY ua.user_id
  HAVING COUNT(*) > 20;
END;
$$;


ALTER FUNCTION "public"."detect_suspicious_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_team_leader_in_members"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- When a team is created or team_leader_id is updated
    IF NEW.team_leader_id IS NOT NULL THEN
        INSERT INTO team_members (team_id, user_id, role, joined_at)
        VALUES (NEW.id, NEW.team_leader_id, 'leader', COALESCE(NEW.created_at, NOW()))
        ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'leader';
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_team_leader_in_members"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_department_rankings"() RETURNS TABLE("department" "text", "total_users" bigint, "total_points" bigint, "total_co2_saved" numeric, "avg_points_per_user" numeric, "avg_co2_per_user" numeric, "total_actions" bigint, "rank_by_points" integer, "rank_by_co2" integer, "rank_by_actions" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH department_stats AS (
    SELECT 
      u.department,
      COUNT(DISTINCT u.id) as user_count,
      COALESCE(SUM(u.points), 0) as dept_points,
      COALESCE(SUM(u.total_co2_saved), 0) as dept_co2_saved,
      COALESCE(AVG(u.points), 0) as avg_points,
      COALESCE(AVG(u.total_co2_saved), 0) as avg_co2
    FROM users u
    WHERE u.is_active = true AND u.department IS NOT NULL AND u.department != ''
    GROUP BY u.department
    HAVING COUNT(DISTINCT u.id) > 0
  ),
  department_actions AS (
    SELECT 
      u.department,
      COUNT(ua.id) as action_count
    FROM users u
    LEFT JOIN user_actions ua ON u.id = ua.user_id AND ua.verification_status = 'approved'
    WHERE u.is_active = true AND u.department IS NOT NULL AND u.department != ''
    GROUP BY u.department
  ),
  combined_stats AS (
    SELECT 
      ds.department,
      ds.user_count,
      ds.dept_points,
      ds.dept_co2_saved,
      ds.avg_points,
      ds.avg_co2,
      COALESCE(da.action_count, 0) as action_count
    FROM department_stats ds
    LEFT JOIN department_actions da ON ds.department = da.department
  ),
  ranked_departments AS (
    SELECT 
      cs.*,
      ROW_NUMBER() OVER (ORDER BY cs.dept_points DESC) as points_rank,
      ROW_NUMBER() OVER (ORDER BY cs.dept_co2_saved DESC) as co2_rank,
      ROW_NUMBER() OVER (ORDER BY cs.action_count DESC) as actions_rank
    FROM combined_stats cs
  )
  SELECT 
    rd.department::TEXT,
    rd.user_count,
    rd.dept_points,
    rd.dept_co2_saved,
    rd.avg_points,
    rd.avg_co2,
    rd.action_count,
    rd.points_rank::INTEGER,
    rd.co2_rank::INTEGER,
    rd.actions_rank::INTEGER
  FROM ranked_departments rd
  ORDER BY rd.dept_points DESC;
END;
$$;


ALTER FUNCTION "public"."get_department_rankings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_level_thresholds"() RETURNS TABLE("level" integer, "points_required" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT lt.level, lt.points_required
    FROM level_thresholds lt
    ORDER BY lt.level ASC;
END;
$$;


ALTER FUNCTION "public"."get_level_thresholds"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recent_admin_activities"("p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "admin_name" "text", "action" character varying, "resource_type" character varying, "resource_id" "uuid", "details" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aalv.id,
    aalv.admin_name,
    aalv.action,
    aalv.resource_type,
    aalv.resource_id,
    aalv.details,
    aalv.created_at
  FROM admin_audit_log_view aalv
  ORDER BY aalv.created_at DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_recent_admin_activities"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_top_performers"("p_limit" integer DEFAULT 10) RETURNS TABLE("user_id" "uuid", "full_name" "text", "email" character varying, "department" character varying, "points" integer, "level" integer, "total_co2_saved" numeric, "verified_actions" bigint, "team_name" character varying)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.first_name || ' ' || u.last_name as full_name,
    u.email,
    u.department,
    u.points,
    u.level,
    u.total_co2_saved,
    COUNT(ua.id) as verified_actions,
    t.name as team_name
  FROM users u
  LEFT JOIN user_actions ua ON u.id = ua.user_id AND ua.verification_status = 'approved'
  LEFT JOIN team_members tm ON u.id = tm.user_id
  LEFT JOIN teams t ON tm.team_id = t.id
  WHERE u.is_active = true
  GROUP BY u.id, t.name
  ORDER BY u.points DESC, verified_actions DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_top_performers"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_notification_count"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    unread_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unread_count
    FROM notifications
    WHERE user_id = p_user_id AND is_read = FALSE;
    
    RETURN unread_count;
END;
$$;


ALTER FUNCTION "public"."get_unread_notification_count"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_unread_notification_count"("p_user_id" "uuid") IS 'Returns the count of unread notifications for a user';



CREATE OR REPLACE FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid") RETURNS TABLE("total_actions" bigint, "verified_actions" bigint, "pending_actions" bigint, "total_points" integer, "total_co2_saved" numeric, "current_level" integer, "badges_earned" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(ua.id) as total_actions,
    COUNT(CASE WHEN ua.verification_status = 'verified' THEN 1 END) as verified_actions,
    COUNT(CASE WHEN ua.verification_status = 'pending' THEN 1 END) as pending_actions,
    u.points as total_points,
    u.total_co2_saved,
    u.level as current_level,
    COUNT(ub.id) as badges_earned
  FROM users u
  LEFT JOIN user_actions ua ON u.id = ua.user_id
  LEFT JOIN user_badges ub ON u.id = ub.user_id
  WHERE u.id = p_user_id
  GROUP BY u.id, u.points, u.total_co2_saved, u.level;
END;
$$;


ALTER FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_available_rewards"("user_uuid" "uuid") RETURNS TABLE("level" integer, "reward_id" "uuid", "reward_title" character varying, "reward_description" "text", "reward_type" character varying, "already_claimed" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_level INTEGER;
BEGIN
    -- Get user's current level
    SELECT get_user_current_level(user_uuid) INTO current_level;
    
    -- Return rewards for all completed levels
    RETURN QUERY
    SELECT 
        lr.level,
        lr.id as reward_id,
        lr.reward_title,
        lr.reward_description,
        lr.reward_type,
        CASE 
            WHEN ulr.id IS NOT NULL THEN true 
            ELSE false 
        END as already_claimed
    FROM level_rewards lr
    LEFT JOIN user_level_rewards ulr ON (
        lr.id = ulr.level_reward_id 
        AND ulr.user_id = user_uuid
    )
    WHERE lr.level <= current_level 
    AND lr.is_active = true
    ORDER BY lr.level ASC, lr.reward_title ASC;
END;
$$;


ALTER FUNCTION "public"."get_user_available_rewards"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_current_level"("user_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    total_points INTEGER;
    user_level INTEGER := 1;
    threshold_record RECORD;
BEGIN
    -- Get total points for user
    SELECT COALESCE(SUM(points), 0) INTO total_points
    FROM point_transactions
    WHERE user_id = user_uuid;
    
    -- Get the highest level where user has enough points
    FOR threshold_record IN 
        SELECT level, points_required 
        FROM level_thresholds 
        ORDER BY level DESC
    LOOP
        IF total_points >= threshold_record.points_required THEN
            user_level := threshold_record.level;
            EXIT;
        END IF;
    END LOOP;
    
    RETURN user_level;
END;
$$;


ALTER FUNCTION "public"."get_user_current_level"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_leaderboard_position"("user_id_param" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    user_position INTEGER;
BEGIN
    SELECT position INTO user_position
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (ORDER BY points DESC, created_at ASC) as position
        FROM users 
        WHERE is_active = true
    ) ranked_users
    WHERE id = user_id_param;
    
    RETURN COALESCE(user_position, 0);
END;
$$;


ALTER FUNCTION "public"."get_user_leaderboard_position"("user_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("user_uuid" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = COALESCE(user_uuid, auth.uid())
    AND is_admin = true 
    AND is_active = true
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_leader"("user_uuid" "uuid" DEFAULT "auth"."uid"(), "team_uuid" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF team_uuid IS NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.teams 
      WHERE team_leader_id = user_uuid 
      AND is_active = true
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM public.teams 
      WHERE id = team_uuid 
      AND team_leader_id = user_uuid 
      AND is_active = true
    );
  END IF;
END;
$$;


ALTER FUNCTION "public"."is_team_leader"("user_uuid" "uuid", "team_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_team_member"("user_uuid" "uuid" DEFAULT "auth"."uid"(), "team_uuid" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON tm.team_id = t.id
    WHERE tm.user_id = user_uuid 
    AND (team_uuid IS NULL OR tm.team_id = team_uuid)
    AND t.is_active = true
  );
END;
$$;


ALTER FUNCTION "public"."is_team_member"("user_uuid" "uuid", "team_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_admin_activity"("p_admin_user_id" "uuid", "p_action" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_details" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO admin_audit_log (
        admin_user_id,
        action_type,
        target_table,
        target_id,
        new_values,
        created_at
    ) VALUES (
        p_admin_user_id,
        p_action,
        p_resource_type,
        p_resource_id,
        p_details,
        now()
    );
END;
$$;


ALTER FUNCTION "public"."log_admin_activity"("p_admin_user_id" "uuid", "p_action" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_details" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_challenge_activity"("p_challenge_id" "uuid", "p_user_id" "uuid", "p_activity_type" character varying, "p_description" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO challenge_activity_log (
        challenge_id,
        user_id,
        activity_type,
        activity_description,
        metadata
    ) VALUES (
        p_challenge_id,
        p_user_id,
        p_activity_type,
        p_description,
        p_metadata
    );
END;
$$;


ALTER FUNCTION "public"."log_challenge_activity"("p_challenge_id" "uuid", "p_user_id" "uuid", "p_activity_type" character varying, "p_description" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_challenge_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Only log if created by admin
    IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.created_by AND is_admin = true) THEN
        INSERT INTO public.admin_activities (
            admin_id,
            action_type,
            target_type,
            target_id,
            details
        ) VALUES (
            NEW.created_by,
            'create',
            'challenge',
            NEW.id,
            jsonb_build_object(
                'title', NEW.title,
                'type', NEW.challenge_type,
                'category', NEW.category
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_challenge_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_personal_challenge_security_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Log security-relevant events for personal challenges
    IF (TG_OP = 'INSERT' AND NEW.challenge_type = 'individual') OR
       (TG_OP = 'UPDATE' AND (OLD.challenge_type != NEW.challenge_type OR 
                              OLD.max_participants != NEW.max_participants OR
                              OLD.reward_points != NEW.reward_points)) THEN
        
        INSERT INTO public.security_audit_log (
            user_id,
            event_type,
            resource_type,
            resource_id,
            details,
            severity
        ) VALUES (
            auth.uid(),
            'personal_challenge_' || lower(TG_OP),
            'challenge',
            COALESCE(NEW.id, OLD.id),
            jsonb_build_object(
                'challenge_type', COALESCE(NEW.challenge_type, OLD.challenge_type),
                'max_participants', COALESCE(NEW.max_participants, OLD.max_participants),
                'reward_points', COALESCE(NEW.reward_points, OLD.reward_points),
                'operation', TG_OP
            ),
            CASE 
                WHEN NEW.challenge_type = 'individual' AND NEW.reward_points > 0 THEN 'high'
                WHEN NEW.challenge_type = 'individual' AND NEW.max_participants != 1 THEN 'high'
                ELSE 'medium'
            END
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_personal_challenge_security_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_security_event"("p_user_id" "uuid", "p_event_type" "text", "p_resource_type" "text" DEFAULT NULL::"text", "p_resource_id" "uuid" DEFAULT NULL::"uuid", "p_details" "jsonb" DEFAULT NULL::"jsonb", "p_severity" "text" DEFAULT 'medium'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    user_id, event_type, resource_type, resource_id, details, severity
  ) VALUES (
    p_user_id, p_event_type, p_resource_type, p_resource_id, p_details, p_severity
  );
END;
$$;


ALTER FUNCTION "public"."log_security_event"("p_user_id" "uuid", "p_event_type" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_details" "jsonb", "p_severity" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE notifications 
    SET is_read = TRUE, updated_at = NOW()
    WHERE user_id = p_user_id AND is_read = FALSE;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;


ALTER FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") IS 'Marks all unread notifications as read for a user';



CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("notification_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE notifications 
    SET is_read = TRUE, updated_at = NOW()
    WHERE id = notification_id AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."mark_notification_read"("notification_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_notification_read"("notification_id" "uuid", "p_user_id" "uuid") IS 'Marks a specific notification as read for a user';



CREATE OR REPLACE FUNCTION "public"."notify_action_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."notify_action_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_announcement_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Only send notifications for published announcements
    IF NEW.type = 'announcement' AND NEW.status = 'published' THEN
        -- Send notification to all active users
        FOR user_record IN 
            SELECT id FROM users WHERE is_active = TRUE
        LOOP
            PERFORM create_notification_if_enabled(
                user_record.id,
                'announcements',
                'New Announcement: ' || NEW.title || ' 📢',
                COALESCE(LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END, 'New announcement: ' || NEW.title),
                '/announcements',
                'announcement',
                NEW.id::TEXT
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_announcement_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_badge_achievement"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    badge_name_text TEXT;
BEGIN
    -- Get the badge name from the badges table
    SELECT name INTO badge_name_text
    FROM badges
    WHERE id = NEW.badge_id;
    
    -- Send notification for new badge achievement
    PERFORM create_notification_if_enabled(
        NEW.user_id,
        'achievement_alerts',
        'New Achievement Unlocked! 🏆',
        'New Achievement Unlocked: ''' || badge_name_text || '''',
        '/badges',
        'badge',
        NEW.id::text
    );
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_badge_achievement"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_educational_content_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Only send notifications for published educational content
    IF NEW.type = 'educational' AND NEW.status = 'published' THEN
        -- Send notification to all active users
        FOR user_record IN 
            SELECT id FROM users WHERE is_active = TRUE
        LOOP
            PERFORM create_notification_if_enabled(
                user_record.id,
                'educational_content',
                'New Educational Content: ''' || NEW.title || ''' 📚',
                'New educational content available: ' || NEW.title,
                '/education',
                'education',
                NEW.id::TEXT
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_educational_content_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_level_milestone"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    old_level INTEGER;
    new_level INTEGER;
    level_threshold_points INTEGER;
BEGIN
    -- Calculate old and new levels using the level calculation function
    SELECT calculate_user_level(OLD.points) INTO old_level;
    SELECT calculate_user_level(NEW.points) INTO new_level;
    
    -- Only send notification if level increased
    IF new_level > old_level THEN
        -- Get the points required for the new level
        SELECT points_required INTO level_threshold_points
        FROM level_thresholds
        WHERE level = new_level;
        
        -- Send milestone notification
        PERFORM create_notification_if_enabled(
            NEW.user_id,
            'achievement_alerts',
            'Milestone Reached! ⭐',
            'Milestone Reached: Level ' || new_level || ' achieved with ' || NEW.points || ' points!',
            '/profile',
            'badge',
            NEW.user_id::text
        );
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_level_milestone"() OWNER TO "postgres";


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


ALTER FUNCTION "public"."notify_user_action_submission_approved"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_all_challenge_progress"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    participant_record RECORD;
    new_progress NUMERIC := 0;
BEGIN
    -- Loop through all active challenge participants
    FOR participant_record IN 
        SELECT cp.*, c.title, c.category, c.target_metric, c.target_value, c.start_date, c.end_date
        FROM challenge_participants cp
        JOIN challenges c ON cp.challenge_id = c.id
        WHERE c.is_active = true
    LOOP
        -- Calculate progress based on target metric
        IF participant_record.target_metric = 'actions' THEN
            SELECT COUNT(*) INTO new_progress
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = participant_record.user_id
            AND ua.completed_at >= participant_record.start_date
            AND ua.completed_at <= participant_record.end_date + INTERVAL '1 day'
            AND ua.verification_status = 'approved'
            AND (participant_record.category = 'general' OR ac.name = participant_record.category);
            
            new_progress := LEAST((new_progress / NULLIF(participant_record.target_value, 0)) * 100, 100);
            
        ELSIF participant_record.target_metric = 'points' THEN
            SELECT COALESCE(SUM(sa.points_value), 0) INTO new_progress
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = participant_record.user_id
            AND ua.completed_at >= participant_record.start_date
            AND ua.completed_at <= participant_record.end_date + INTERVAL '1 day'
            AND ua.verification_status = 'approved'
            AND (participant_record.category = 'general' OR ac.name = participant_record.category);
            
            new_progress := LEAST((new_progress / NULLIF(participant_record.target_value, 0)) * 100, 100);
            
        ELSIF participant_record.target_metric = 'co2_saved' THEN
            SELECT COALESCE(SUM(sa.co2_impact), 0) INTO new_progress
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = participant_record.user_id
            AND ua.completed_at >= participant_record.start_date
            AND ua.completed_at <= participant_record.end_date + INTERVAL '1 day'
            AND ua.verification_status = 'approved'
            AND (participant_record.category = 'general' OR ac.name = participant_record.category);
            
            new_progress := LEAST((new_progress / NULLIF(participant_record.target_value, 0)) * 100, 100);
        END IF;
        
        -- Update participant progress
        UPDATE challenge_participants 
        SET current_progress = new_progress,
            completed = (new_progress >= 100),
            completed_at = CASE 
                WHEN new_progress >= 100 AND completed = false THEN NOW()
                ELSE completed_at
            END
        WHERE id = participant_record.id;
        
    END LOOP;
    
    RAISE NOTICE 'Challenge progress recalculation completed';
END;
$$;


ALTER FUNCTION "public"."recalculate_all_challenge_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_all_user_levels"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Update all users' levels based on their current points and the level thresholds
  UPDATE users 
  SET level = calculate_user_level(points),
      updated_at = now()
  WHERE points IS NOT NULL;
  
  -- Log the recalculation
  RAISE NOTICE 'Recalculated levels for all users based on current thresholds';
END;
$$;


ALTER FUNCTION "public"."recalculate_all_user_levels"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_single_team_stats"("target_team_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_total_points INTEGER;
  new_total_co2 DECIMAL(10,2);
  current_team_leader_id UUID;
BEGIN
  -- Get team leader ID with proper table qualification
  SELECT t.team_leader_id INTO current_team_leader_id
  FROM public.teams t
  WHERE t.id = target_team_id;

  -- Calculate team totals including both team members AND team leader
  WITH team_users AS (
    -- Get all team members
    SELECT u.id, u.points, u.total_co2_saved
    FROM public.users u
    INNER JOIN public.team_members tm ON u.id = tm.user_id
    WHERE tm.team_id = target_team_id
    
    UNION
    
    -- Add team leader (if not already included as member)
    SELECT u.id, u.points, u.total_co2_saved
    FROM public.users u
    WHERE u.id = current_team_leader_id
    AND NOT EXISTS (
      SELECT 1 FROM public.team_members tm 
      WHERE tm.team_id = target_team_id AND tm.user_id = current_team_leader_id
    )
  )
  SELECT 
    COALESCE(SUM(points), 0),
    COALESCE(SUM(total_co2_saved), 0)
  INTO new_total_points, new_total_co2
  FROM team_users;

  -- Update team record
  UPDATE public.teams
  SET 
    total_points = new_total_points,
    total_co2_saved = new_total_co2,
    updated_at = NOW()
  WHERE id = target_team_id;
END;
$$;


ALTER FUNCTION "public"."recalculate_single_team_stats"("target_team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reevaluate_badge_awards"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."reevaluate_badge_awards"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."safe_check_max_participants"("challenge_id_param" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  max_participants_count INTEGER;
  current_participants_count INTEGER;
BEGIN
  -- Get max participants from challenges table
  SELECT max_participants INTO max_participants_count
  FROM challenges 
  WHERE id = challenge_id_param;
  
  -- If no limit set, return a high number
  IF max_participants_count IS NULL THEN
    RETURN 999999;
  END IF;
  
  -- Count current participants
  SELECT COUNT(*) INTO current_participants_count
  FROM challenge_participants 
  WHERE challenge_id = challenge_id_param;
  
  -- Return remaining spots
  RETURN max_participants_count - current_participants_count;
END;
$$;


ALTER FUNCTION "public"."safe_check_max_participants"("challenge_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_weekly_points_notifications"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    user_record RECORD;
    weekly_points INTEGER;
    start_date DATE;
    end_date DATE;
BEGIN
    -- Calculate this week's date range
    start_date := date_trunc('week', CURRENT_DATE);
    end_date := start_date + INTERVAL '7 days';
    
    -- Loop through all active users
    FOR user_record IN 
        SELECT DISTINCT user_id 
        FROM point_transactions 
        WHERE created_at >= start_date 
        AND created_at < end_date
    LOOP
        -- Calculate weekly points for this user
        SELECT COALESCE(SUM(points), 0) INTO weekly_points
        FROM point_transactions
        WHERE user_id = user_record.user_id
        AND created_at >= start_date
        AND created_at < end_date;
        
        -- Send notification if user earned points this week
        IF weekly_points > 0 THEN
            PERFORM create_notification_if_enabled(
                user_record.user_id,
                'achievement_alerts',
                'Weekly Points! 🎯',
                'You''ve earned ' || weekly_points || ' points this week!',
                '/profile',
                'badge',
                user_record.user_id::text
            );
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."send_weekly_points_notifications"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."send_weekly_points_notifications"() IS 'Send weekly points summary notifications to all users. Should be called by a scheduled job every Monday at 9 AM.';



CREATE OR REPLACE FUNCTION "public"."simple_update_user_co2_savings"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Only update for approved actions
    IF NEW.verification_status = 'approved' AND (OLD IS NULL OR OLD.verification_status != 'approved') THEN
        -- Update user's total CO2 saved
        UPDATE users 
        SET total_co2_saved = COALESCE(total_co2_saved, 0) + COALESCE(NEW.co2_saved, 0)
        WHERE id = NEW.user_id;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the transaction
        RAISE WARNING 'Error updating CO2 savings for user %: %', NEW.user_id, SQLERRM;
        RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."simple_update_user_co2_savings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_leaderboard_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    old_position INTEGER;
    new_position INTEGER;
    position_change INTEGER;
BEGIN
    -- Only process when points change
    IF NEW.points != OLD.points THEN
        -- Get old position (approximate based on old points)
        SELECT COUNT(*) + 1 INTO old_position
        FROM users 
        WHERE points > OLD.points AND is_active = true;
        
        -- Get new position
        new_position := get_user_leaderboard_position(NEW.id);
        
        -- Calculate position change
        position_change := old_position - new_position;
        
        -- Send notifications based on position changes
        IF position_change > 0 THEN
            -- User moved up
            IF new_position = 1 THEN
                -- User reached #1
                PERFORM create_notification(
                    NEW.id,
                    'leaderboard_updates',
                    'Top of Leaderboard! 🥇',
                    'Congratulations! You''re now #1 on the leaderboard!',
                    '/leaderboard',
                    'leaderboard',
                    NULL
                );
            ELSIF position_change >= 5 THEN
                -- Significant movement (5+ positions)
                PERFORM create_notification(
                    NEW.id,
                    'leaderboard_updates',
                    'Leaderboard Update 📈',
                    format('You moved up %s positions on the leaderboard! Now ranked #%s', position_change, new_position),
                    '/leaderboard',
                    'leaderboard',
                    NULL
                );
            END IF;
        END IF;
        
        -- Check for trending (weekly basis - simplified to recent activity)
        -- This is a simplified version - in production you might want more sophisticated trending logic
        IF position_change >= 3 AND NEW.updated_at > NOW() - INTERVAL '7 days' THEN
            PERFORM create_notification(
                NEW.id,
                'leaderboard_updates',
                'Trending Up! ⚡',
                format('You''re trending up! +%s positions this week', position_change),
                '/leaderboard',
                'leaderboard',
                NULL
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."track_leaderboard_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_log_admin_action"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only log if user is admin
  IF is_admin() THEN
    PERFORM log_security_event(
      auth.uid(),
      TG_OP || '_' || TG_TABLE_NAME,
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      jsonb_build_object(
        'operation', TG_OP,
        'table', TG_TABLE_NAME,
        'old_data', to_jsonb(OLD),
        'new_data', to_jsonb(NEW)
      ),
      'medium'
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."trigger_log_admin_action"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_challenge_progress_on_action"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    challenge_record RECORD;
    action_record RECORD;
    category_name TEXT;
    user_actions_count INTEGER;
    progress_pct NUMERIC;
    total_points NUMERIC;
    total_co2 NUMERIC;
    calculated_progress NUMERIC;
    old_progress NUMERIC := 0;
    milestone_reached BOOLEAN := FALSE;
    challenge_completed BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE 'Trigger fired for user_action: %', NEW.id;
    
    -- Get action details with category
    SELECT sa.*, ac.name as category_name
    INTO action_record
    FROM sustainability_actions sa
    JOIN action_categories ac ON sa.category_id = ac.id
    WHERE sa.id = NEW.action_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Action not found: %', NEW.action_id;
        RETURN NEW;
    END IF;
    
    category_name := action_record.category_name;
    RAISE NOTICE 'Action category: %, Action title: %', category_name, action_record.title;
    
    -- Find matching challenges for this user and category
    FOR challenge_record IN
        SELECT c.*, cp.user_id, cp.current_progress as old_current_progress
        FROM challenges c
        JOIN challenge_participants cp ON c.id = cp.challenge_id
        WHERE cp.user_id = NEW.user_id
        AND c.is_active = true
        AND NEW.completed_at <= c.end_date
        AND (c.category = 'general' OR c.category = category_name)
    LOOP
        RAISE NOTICE 'Processing challenge: % (%) for user: %', challenge_record.title, challenge_record.id, NEW.user_id;
        
        -- Store old progress for comparison
        old_progress := challenge_record.old_current_progress;
        
        -- Calculate progress based on target metric
        IF challenge_record.target_metric = 'actions' THEN
            SELECT COUNT(*)
            INTO user_actions_count
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = NEW.user_id
            AND ua.verification_status = 'approved'
            AND ua.completed_at <= challenge_record.end_date
            AND (challenge_record.category = 'general' OR ac.name = challenge_record.category);
            
            calculated_progress := user_actions_count;
            
        ELSIF challenge_record.target_metric = 'points' THEN
            SELECT COALESCE(SUM(sa.points_value), 0)
            INTO total_points
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = NEW.user_id
            AND ua.verification_status = 'approved'
            AND ua.completed_at <= challenge_record.end_date
            AND (challenge_record.category = 'general' OR ac.name = challenge_record.category);
            
            calculated_progress := total_points;
            user_actions_count := calculated_progress;
            
        ELSIF challenge_record.target_metric = 'co2_saved' THEN
            SELECT COALESCE(SUM(sa.co2_impact), 0)
            INTO total_co2
            FROM user_actions ua
            JOIN sustainability_actions sa ON ua.action_id = sa.id
            JOIN action_categories ac ON sa.category_id = ac.id
            WHERE ua.user_id = NEW.user_id
            AND ua.verification_status = 'approved'
            AND ua.completed_at <= challenge_record.end_date
            AND (challenge_record.category = 'general' OR ac.name = challenge_record.category);
            
            calculated_progress := total_co2;
            user_actions_count := calculated_progress;
        END IF;
        
        -- Calculate progress percentage
        IF challenge_record.target_value > 0 THEN
            progress_pct := LEAST(100.0, (calculated_progress / challenge_record.target_value::NUMERIC) * 100.0);
        ELSE
            progress_pct := CASE WHEN calculated_progress > 0 THEN 100.0 ELSE 0.0 END;
        END IF;
        
        -- Check for milestones and completion
        milestone_reached := (calculated_progress > old_progress AND calculated_progress > 0);
        challenge_completed := (progress_pct >= 100 AND old_progress < challenge_record.target_value);
        
        RAISE NOTICE 'Calculated progress: % / % = % percent for challenge: %', 
            calculated_progress, challenge_record.target_value, progress_pct, challenge_record.id;
        
        -- Insert or update challenge progress
        INSERT INTO challenge_progress (
            challenge_id,
            user_id,
            actions_completed,
            progress_percentage,
            current_progress,
            completed,
            last_updated
        )
        VALUES (
            challenge_record.id,
            NEW.user_id,
            COALESCE(user_actions_count, 0),
            progress_pct,
            calculated_progress::INTEGER,
            progress_pct >= 100,
            NOW()
        )
        ON CONFLICT (challenge_id, user_id)
        DO UPDATE SET
            actions_completed = EXCLUDED.actions_completed,
            progress_percentage = EXCLUDED.progress_percentage,
            current_progress = EXCLUDED.current_progress,
            completed = EXCLUDED.completed,
            last_updated = EXCLUDED.last_updated;
            
        -- Update challenge_participants current_progress
        UPDATE challenge_participants 
        SET current_progress = calculated_progress::INTEGER,
            completed = (progress_pct >= 100),
            completed_at = CASE 
                WHEN progress_pct >= 100 AND completed = false THEN NOW()
                ELSE completed_at
            END
        WHERE challenge_id = challenge_record.id AND user_id = NEW.user_id;
        
        -- Log challenge activities
        IF milestone_reached THEN
            PERFORM log_challenge_activity(
                challenge_record.id,
                NEW.user_id,
                'progress_update',
                format('%s completed "%s" and made progress in challenge "%s"', 
                    (SELECT first_name || ' ' || last_name FROM users WHERE id = NEW.user_id),
                    action_record.title,
                    challenge_record.title
                ),
                jsonb_build_object(
                    'action_title', action_record.title,
                    'points_earned', action_record.points_value,
                    'co2_saved', action_record.co2_impact,
                    'old_progress', old_progress,
                    'new_progress', calculated_progress,
                    'progress_percentage', progress_pct,
                    'target_metric', challenge_record.target_metric
                )
            );
        END IF;
        
        IF challenge_completed THEN
            PERFORM log_challenge_activity(
                challenge_record.id,
                NEW.user_id,
                'challenge_completed',
                format('%s completed challenge "%s"!', 
                    (SELECT first_name || ' ' || last_name FROM users WHERE id = NEW.user_id),
                    challenge_record.title
                ),
                jsonb_build_object(
                    'target_value', challenge_record.target_value,
                    'final_progress', calculated_progress,
                    'target_metric', challenge_record.target_metric,
                    'reward_points', challenge_record.reward_points
                )
            );
        END IF;
        
        -- Check for milestone achievements (25%, 50%, 75%)
        IF old_progress < challenge_record.target_value * 0.25 AND calculated_progress >= challenge_record.target_value * 0.25 THEN
            PERFORM log_challenge_activity(
                challenge_record.id,
                NEW.user_id,
                'milestone_reached',
                format('%s reached 25%% completion in challenge "%s"', 
                    (SELECT first_name || ' ' || last_name FROM users WHERE id = NEW.user_id),
                    challenge_record.title
                ),
                jsonb_build_object('milestone', '25%', 'progress', calculated_progress, 'target_metric', challenge_record.target_metric)
            );
        END IF;
        
        IF old_progress < challenge_record.target_value * 0.50 AND calculated_progress >= challenge_record.target_value * 0.50 THEN
            PERFORM log_challenge_activity(
                challenge_record.id,
                NEW.user_id,
                'milestone_reached',
                format('%s reached 50%% completion in challenge "%s"', 
                    (SELECT first_name || ' ' || last_name FROM users WHERE id = NEW.user_id),
                    challenge_record.title
                ),
                jsonb_build_object('milestone', '50%', 'progress', calculated_progress, 'target_metric', challenge_record.target_metric)
            );
        END IF;
        
        IF old_progress < challenge_record.target_value * 0.75 AND calculated_progress >= challenge_record.target_value * 0.75 THEN
            PERFORM log_challenge_activity(
                challenge_record.id,
                NEW.user_id,
                'milestone_reached',
                format('%s reached 75%% completion in challenge "%s"', 
                    (SELECT first_name || ' ' || last_name FROM users WHERE id = NEW.user_id),
                    challenge_record.title
                ),
                jsonb_build_object('milestone', '75%', 'progress', calculated_progress, 'target_metric', challenge_record.target_metric)
            );
        END IF;
        
    END LOOP;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_challenge_progress_on_action"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_level_threshold"("threshold_level" integer, "new_points_required" integer, "admin_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result json;
  prev_threshold integer;
  next_threshold integer;
BEGIN
  -- Check if user is admin using users.is_admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = admin_user_id AND is_admin = true
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: Admin access required');
  END IF;

  -- Validate input parameters
  IF threshold_level < 1 OR threshold_level > 10 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid level: must be between 1 and 10');
  END IF;

  IF new_points_required < 0 OR new_points_required > 1000000 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid points: must be between 0 and 1,000,000');
  END IF;

  -- Validate ascending order: check previous level threshold
  IF threshold_level > 1 THEN
    SELECT points_required INTO prev_threshold 
    FROM level_thresholds 
    WHERE level = threshold_level - 1;
    
    IF prev_threshold IS NOT NULL AND new_points_required <= prev_threshold THEN
      RETURN json_build_object(
        'success', false, 
        'error', format('Level %s threshold (%s points) must be greater than Level %s (%s points)', 
                       threshold_level, new_points_required, threshold_level - 1, prev_threshold)
      );
    END IF;
  END IF;

  -- Validate ascending order: check next level threshold
  IF threshold_level < 10 THEN
    SELECT points_required INTO next_threshold 
    FROM level_thresholds 
    WHERE level = threshold_level + 1;
    
    IF next_threshold IS NOT NULL AND new_points_required >= next_threshold THEN
      RETURN json_build_object(
        'success', false, 
        'error', format('Level %s threshold (%s points) must be less than Level %s (%s points)', 
                       threshold_level, new_points_required, threshold_level + 1, next_threshold)
      );
    END IF;
  END IF;

  -- Update the specific level threshold
  UPDATE level_thresholds 
  SET points_required = new_points_required,
      updated_at = now()
  WHERE level = threshold_level;

  -- Check if the update was successful
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Level threshold not found');
  END IF;

  -- Recalculate all user levels based on new thresholds
  PERFORM recalculate_all_user_levels();

  -- Return success response
  RETURN json_build_object(
    'success', true, 
    'message', 'Level threshold updated successfully',
    'level', threshold_level,
    'new_points_required', new_points_required
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."update_level_threshold"("threshold_level" integer, "new_points_required" integer, "admin_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_team_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  team_id_to_update UUID;
  new_total_points INTEGER;
  new_total_co2 DECIMAL(10,2);
  current_team_leader_id UUID;
BEGIN
  -- Get team ID from different trigger sources
  IF TG_TABLE_NAME = 'user_actions' THEN
    -- Get all teams this user belongs to (since users can be in multiple teams)
    FOR team_id_to_update IN 
      SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = NEW.user_id
      UNION
      SELECT t.id FROM public.teams t WHERE t.team_leader_id = NEW.user_id
    LOOP
      -- Update each team this user belongs to
      PERFORM public.recalculate_single_team_stats(team_id_to_update);
    END LOOP;
    
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'team_members' THEN
    team_id_to_update := COALESCE(NEW.team_id, OLD.team_id);
  ELSIF TG_TABLE_NAME = 'users' THEN
    -- Get all teams this user is associated with
    FOR team_id_to_update IN 
      SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = NEW.id
      UNION
      SELECT t.id FROM public.teams t WHERE t.team_leader_id = NEW.id
    LOOP
      -- Update each team this user belongs to
      PERFORM public.recalculate_single_team_stats(team_id_to_update);
    END LOOP;
    
    RETURN NEW;
  END IF;

  -- For team_members table changes, update the specific team
  IF team_id_to_update IS NOT NULL THEN
    PERFORM public.recalculate_single_team_stats(team_id_to_update);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_team_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_co2_savings"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."update_user_co2_savings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_level"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.level = calculate_user_level(NEW.points);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_level"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_points"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."update_user_points"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_points_and_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    total_points INTEGER;
    old_level INTEGER;
    new_level INTEGER;
BEGIN
    -- Calculate total points for the user
    SELECT COALESCE(SUM(points), 0) INTO total_points
    FROM point_transactions
    WHERE user_id = NEW.user_id;
    
    -- Get old level (before this transaction)
    SELECT calculate_user_level(total_points - NEW.points) INTO old_level;
    
    -- Get new level (after this transaction)
    SELECT calculate_user_level(total_points) INTO new_level;
    
    -- Send notification if level increased
    IF new_level > old_level THEN
        PERFORM create_notification_if_enabled(
            NEW.user_id,
            'achievement_alerts',
            'Milestone Reached! ⭐',
            'Milestone Reached: Level ' || new_level || ' achieved with ' || total_points || ' points!',
            '/profile',
            'badge',
            NEW.user_id::text
        );
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_points_and_notify"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_level_thresholds_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  prev_threshold integer;
  next_threshold integer;
BEGIN
  -- Check previous level
  IF NEW.level > 1 THEN
    SELECT points_required INTO prev_threshold 
    FROM level_thresholds 
    WHERE level = NEW.level - 1;
    
    IF prev_threshold IS NOT NULL AND NEW.points_required <= prev_threshold THEN
      RAISE EXCEPTION 'Level % threshold (% points) must be greater than Level % (% points)', 
                     NEW.level, NEW.points_required, NEW.level - 1, prev_threshold;
    END IF;
  END IF;

  -- Check next level
  IF NEW.level < 10 THEN
    SELECT points_required INTO next_threshold 
    FROM level_thresholds 
    WHERE level = NEW.level + 1;
    
    IF next_threshold IS NOT NULL AND NEW.points_required >= next_threshold THEN
      RAISE EXCEPTION 'Level % threshold (% points) must be less than Level % (% points)', 
                     NEW.level, NEW.points_required, NEW.level + 1, next_threshold;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_level_thresholds_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_personal_challenge"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Set start_date to creation time if not provided
    IF NEW.start_date IS NULL THEN
        NEW.start_date = NOW();
    END IF;
    
    -- Validate personal challenge constraints
    IF NEW.challenge_type = 'individual' THEN
        -- Personal challenges must have exactly 1 max participant
        IF NEW.max_participants != 1 THEN
            RAISE EXCEPTION 'Personal challenges must have exactly 1 participant'
                USING ERRCODE = 'check_violation';
        END IF;
        
        -- Personal challenges cannot have reward points
        IF NEW.reward_points > 0 THEN
            RAISE EXCEPTION 'Personal challenges cannot have reward points'
                USING ERRCODE = 'check_violation';
        END IF;
        
        -- Personal challenges can only be created by the user for themselves
        IF NEW.created_by != auth.uid() THEN
            RAISE EXCEPTION 'Personal challenges can only be created by the user for themselves'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    
    -- Allow team challenges to have reward points (removed restriction)
    -- Team and company challenges can have reward points
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_personal_challenge"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."action_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_action_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_size" integer,
    "uploaded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."action_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."action_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "color" "text" DEFAULT '#10B981'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."action_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "action_type" character varying NOT NULL,
    "target_type" character varying NOT NULL,
    "target_id" "uuid",
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "details" "jsonb",
    "ip_address" "inet",
    "user_agent" "text"
);


ALTER TABLE "public"."admin_activities" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_activities" IS 'Tracks all administrative activities for audit purposes';



COMMENT ON COLUMN "public"."admin_activities"."details" IS 'Additional structured data about the activity';



COMMENT ON COLUMN "public"."admin_activities"."ip_address" IS 'IP address of the admin performing the action';



COMMENT ON COLUMN "public"."admin_activities"."user_agent" IS 'User agent string of the admin browser';



CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "action_type" "text" NOT NULL,
    "target_table" "text" NOT NULL,
    "target_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "description" "text",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "department" "text",
    "job_title" "text",
    "employee_id" "text",
    "avatar_url" "text",
    "points" integer DEFAULT 0,
    "level" integer DEFAULT 1,
    "total_co2_saved" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "is_admin" boolean DEFAULT false,
    CONSTRAINT "users_co2_non_negative_check" CHECK (("total_co2_saved" >= (0)::numeric)),
    CONSTRAINT "users_email_format_check" CHECK (("email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text")),
    CONSTRAINT "users_points_non_negative_check" CHECK (("points" >= 0))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."is_admin" IS 'Indicates if the user has administrative privileges';



CREATE OR REPLACE VIEW "public"."admin_audit_log_view" AS
 SELECT "aal"."id",
    "aal"."admin_user_id",
    (("u"."first_name" || ' '::"text") || "u"."last_name") AS "admin_name",
    "u"."email" AS "admin_email",
    "aal"."action_type" AS "action",
    "aal"."target_table" AS "resource_type",
    "aal"."target_id" AS "resource_id",
    "aal"."new_values" AS "details",
    "aal"."ip_address",
    "aal"."user_agent",
    "aal"."created_at"
   FROM ("public"."admin_audit_log" "aal"
     JOIN "public"."users" "u" ON (("aal"."admin_user_id" = "u"."id")))
  ORDER BY "aal"."created_at" DESC;


ALTER VIEW "public"."admin_audit_log_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sustainability_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "points_value" integer DEFAULT 10 NOT NULL,
    "co2_impact" numeric(8,2) DEFAULT 0 NOT NULL,
    "difficulty_level" integer DEFAULT 1,
    "estimated_time_minutes" integer,
    "instructions" "text",
    "verification_required" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_user_created" boolean DEFAULT false,
    "submitted_by" "uuid",
    "rejection_reason" "text",
    "auto_logged_for_submitter" boolean DEFAULT false,
    "photo_url" "text",
    CONSTRAINT "sustainability_actions_difficulty_level_check" CHECK ((("difficulty_level" >= 1) AND ("difficulty_level" <= 5)))
);


ALTER TABLE "public"."sustainability_actions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sustainability_actions"."is_user_created" IS 'True if this action was submitted by a user rather than created by admin';



COMMENT ON COLUMN "public"."sustainability_actions"."submitted_by" IS 'User ID who submitted this action (for user-created actions)';



COMMENT ON COLUMN "public"."sustainability_actions"."rejection_reason" IS 'Reason provided by admin if action was rejected';



COMMENT ON COLUMN "public"."sustainability_actions"."auto_logged_for_submitter" IS 'True if this action was automatically logged for the submitter when approved';



COMMENT ON COLUMN "public"."sustainability_actions"."photo_url" IS 'URL of uploaded photo proof for user-submitted actions (nullable for admin-created templates)';



CREATE TABLE IF NOT EXISTS "public"."user_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action_id" "uuid" NOT NULL,
    "points_earned" integer NOT NULL,
    "co2_saved" numeric(8,2) NOT NULL,
    "verification_status" "text" DEFAULT 'approved'::"text",
    "notes" "text",
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "photo_url" "text",
    CONSTRAINT "user_actions_co2_non_negative_check" CHECK (("co2_saved" >= (0)::numeric)),
    CONSTRAINT "user_actions_points_non_negative_check" CHECK (("points_earned" >= 0)),
    CONSTRAINT "user_actions_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."user_actions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_actions"."photo_url" IS 'URL of uploaded photo proof for the action';



CREATE OR REPLACE VIEW "public"."admin_category_breakdown" AS
 SELECT "ac"."name" AS "category_name",
    "count"("ua"."id") AS "action_count",
    "round"(((("count"("ua"."id"))::numeric / (NULLIF(( SELECT "count"(*) AS "count"
           FROM "public"."user_actions"
          WHERE ("user_actions"."verification_status" = 'approved'::"text")), 0))::numeric) * (100)::numeric), 1) AS "percentage",
    COALESCE("sum"("ua"."co2_saved"), (0)::numeric) AS "total_co2_impact",
    COALESCE("sum"("ua"."points_earned"), (0)::bigint) AS "total_points"
   FROM (("public"."action_categories" "ac"
     LEFT JOIN "public"."sustainability_actions" "sa" ON (("ac"."id" = "sa"."category_id")))
     LEFT JOIN "public"."user_actions" "ua" ON ((("sa"."id" = "ua"."action_id") AND ("ua"."verification_status" = 'approved'::"text"))))
  GROUP BY "ac"."id", "ac"."name"
  ORDER BY ("count"("ua"."id")) DESC;


ALTER VIEW "public"."admin_category_breakdown" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenge_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenge_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "team_id" "uuid",
    "current_progress" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "challenge_participants_check" CHECK (("user_id" IS NOT NULL))
);


ALTER TABLE "public"."challenge_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "challenge_type" "text" NOT NULL,
    "start_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "target_metric" "text" NOT NULL,
    "target_value" integer NOT NULL,
    "reward_points" integer DEFAULT 0,
    "reward_description" "text",
    "max_participants" integer,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category" "text" DEFAULT 'general'::"text",
    CONSTRAINT "challenges_challenge_type_check" CHECK (("challenge_type" = ANY (ARRAY['individual'::"text", 'team'::"text", 'company'::"text"]))),
    CONSTRAINT "challenges_dates_logical_check" CHECK (("end_date" > "start_date")),
    CONSTRAINT "challenges_reward_points_non_negative_check" CHECK (("reward_points" >= 0)),
    CONSTRAINT "challenges_target_metric_check" CHECK (("target_metric" = ANY (ARRAY['points'::"text", 'actions'::"text", 'co2_saved'::"text"]))),
    CONSTRAINT "challenges_target_value_positive_check" CHECK (("target_value" > 0))
);


ALTER TABLE "public"."challenges" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_challenge_stats" AS
 SELECT "c"."id",
    "c"."title",
    "c"."description",
    "c"."category",
    "c"."challenge_type",
    "c"."target_metric",
    "c"."target_value",
    "c"."reward_points",
    "c"."start_date",
    "c"."end_date",
    "c"."is_active",
    "c"."created_at",
    "count"("cp"."id") AS "total_participants",
    "count"(
        CASE
            WHEN ("cp"."completed" = true) THEN 1
            ELSE NULL::integer
        END) AS "completed_count",
    "avg"("cp"."current_progress") AS "avg_progress"
   FROM ("public"."challenges" "c"
     LEFT JOIN "public"."challenge_participants" "cp" ON (("c"."id" = "cp"."challenge_id")))
  GROUP BY "c"."id", "c"."title", "c"."description", "c"."category", "c"."challenge_type", "c"."target_metric", "c"."target_value", "c"."reward_points", "c"."start_date", "c"."end_date", "c"."is_active", "c"."created_at"
  ORDER BY "c"."created_at" DESC;


ALTER VIEW "public"."admin_challenge_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."point_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "points" integer NOT NULL,
    "transaction_type" "text" NOT NULL,
    "reference_id" "uuid",
    "reference_type" "text",
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."point_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "team_leader_id" "uuid" NOT NULL,
    "max_members" integer DEFAULT 10,
    "total_points" integer DEFAULT 0,
    "total_co2_saved" numeric(10,2) DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "teams_max_members_positive_check" CHECK ((("max_members" > 0) AND ("max_members" <= 1000)))
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_token" "text" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."user_sessions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_dashboard_stats" AS
 SELECT ( SELECT "count"(*) AS "count"
           FROM "public"."users") AS "total_users",
    ( SELECT "count"(*) AS "count"
           FROM "public"."users"
          WHERE ("users"."is_active" = true)) AS "active_users",
    ( SELECT "count"(*) AS "count"
           FROM "public"."users"
          WHERE ("users"."created_at" >= (CURRENT_DATE - '30 days'::interval))) AS "new_users_30d",
    ( SELECT "count"(DISTINCT "us"."user_id") AS "count"
           FROM "public"."user_sessions" "us"
          WHERE ("us"."created_at" >= (CURRENT_DATE - '7 days'::interval))) AS "active_users_7d",
    ( SELECT "round"("avg"("users"."points"), 1) AS "round"
           FROM "public"."users"
          WHERE ("users"."points" > 0)) AS "avg_points",
    ( SELECT "count"(*) AS "count"
           FROM "public"."user_actions"
          WHERE ("user_actions"."verification_status" = 'approved'::"text")) AS "total_verified_actions",
    ( SELECT "count"(*) AS "count"
           FROM "public"."user_actions"
          WHERE ("user_actions"."verification_status" = 'pending'::"text")) AS "pending_actions",
    ( SELECT "count"(*) AS "count"
           FROM "public"."user_actions"
          WHERE ("user_actions"."completed_at" >= (CURRENT_DATE - '30 days'::interval))) AS "actions_30d",
    ( SELECT "count"(*) AS "count"
           FROM "public"."teams"
          WHERE ("teams"."is_active" = true)) AS "active_teams",
    ( SELECT "avg"("teams"."total_points") AS "avg"
           FROM "public"."teams"
          WHERE ("teams"."is_active" = true)) AS "avg_team_points",
    ( SELECT "count"(*) AS "count"
           FROM "public"."challenges"
          WHERE (("challenges"."is_active" = true) AND ("challenges"."end_date" > "now"()))) AS "active_challenges",
    ( SELECT "count"(*) AS "count"
           FROM "public"."challenge_participants"
          WHERE ("challenge_participants"."completed" = true)) AS "completed_challenges",
    ( SELECT COALESCE("sum"("users"."total_co2_saved"), (0)::numeric) AS "coalesce"
           FROM "public"."users") AS "total_co2_saved",
    ( SELECT COALESCE("sum"("user_actions"."co2_saved"), (0)::numeric) AS "coalesce"
           FROM "public"."user_actions"
          WHERE ("user_actions"."verification_status" = 'approved'::"text")) AS "verified_co2_impact",
    ( SELECT COALESCE("sum"("users"."points"), (0)::bigint) AS "coalesce"
           FROM "public"."users") AS "total_points_awarded",
    ( SELECT "count"(*) AS "count"
           FROM "public"."point_transactions"
          WHERE ("point_transactions"."created_at" >= (CURRENT_DATE - '7 days'::interval))) AS "recent_transactions";


ALTER VIEW "public"."admin_dashboard_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_monthly_trends" AS
 WITH "monthly_data" AS (
         SELECT "date_trunc"('month'::"text", "users"."created_at") AS "month",
            "count"(*) AS "new_users"
           FROM "public"."users"
          WHERE ("users"."created_at" >= (CURRENT_DATE - '1 year'::interval))
          GROUP BY ("date_trunc"('month'::"text", "users"."created_at"))
        ), "monthly_actions" AS (
         SELECT "date_trunc"('month'::"text", "user_actions"."completed_at") AS "month",
            "count"(*) AS "actions_completed"
           FROM "public"."user_actions"
          WHERE (("user_actions"."completed_at" >= (CURRENT_DATE - '1 year'::interval)) AND ("user_actions"."verification_status" = 'approved'::"text"))
          GROUP BY ("date_trunc"('month'::"text", "user_actions"."completed_at"))
        )
 SELECT COALESCE("md"."month", "ma"."month") AS "month",
    COALESCE("md"."new_users", (0)::bigint) AS "new_users",
    COALESCE("ma"."actions_completed", (0)::bigint) AS "actions_completed"
   FROM ("monthly_data" "md"
     FULL JOIN "monthly_actions" "ma" ON (("md"."month" = "ma"."month")))
  ORDER BY COALESCE("md"."month", "ma"."month");


ALTER VIEW "public"."admin_monthly_trends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "permission_type" "text" NOT NULL,
    "granted_by" "uuid" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."admin_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "team_members_role_check" CHECK (("role" = ANY (ARRAY['leader'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_team_stats" AS
 WITH "team_member_counts" AS (
         SELECT "t_1"."id" AS "team_id",
            "count"("tm"."id") AS "member_count",
                CASE
                    WHEN (EXISTS ( SELECT 1
                       FROM "public"."team_members" "tm2"
                      WHERE (("tm2"."team_id" = "t_1"."id") AND ("tm2"."user_id" = "t_1"."team_leader_id")))) THEN 0
                    ELSE 1
                END AS "leader_not_member"
           FROM ("public"."teams" "t_1"
             LEFT JOIN "public"."team_members" "tm" ON (("t_1"."id" = "tm"."team_id")))
          GROUP BY "t_1"."id", "t_1"."team_leader_id"
        )
 SELECT "t"."id",
    "t"."name",
    "t"."description",
    "t"."team_leader_id",
    COALESCE("concat"("u"."first_name", ' ', "u"."last_name"), "u"."email", 'Unknown Leader'::"text") AS "leader_name",
    "t"."total_points",
    "t"."total_co2_saved",
    "t"."max_members",
    ("tmc"."member_count" + "tmc"."leader_not_member") AS "current_members",
    "t"."is_active",
    "t"."created_at"
   FROM (("public"."teams" "t"
     LEFT JOIN "public"."users" "u" ON (("t"."team_leader_id" = "u"."id")))
     LEFT JOIN "team_member_counts" "tmc" ON (("t"."id" = "tmc"."team_id")));


ALTER VIEW "public"."admin_team_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_user_stats" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"text" AS "first_name",
    NULL::"text" AS "last_name",
    NULL::"text" AS "email",
    NULL::"text" AS "department",
    NULL::integer AS "points",
    NULL::integer AS "level",
    NULL::numeric(10,2) AS "total_co2_saved",
    NULL::boolean AS "is_active",
    NULL::boolean AS "is_admin",
    NULL::bigint AS "total_actions",
    NULL::bigint AS "verified_actions",
    NULL::"uuid" AS "team_id",
    NULL::"text" AS "team_name";


ALTER VIEW "public"."admin_user_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."admin_weekly_activity" AS
 WITH "date_series" AS (
         SELECT ("generate_series"((CURRENT_DATE - '6 days'::interval), (CURRENT_DATE)::timestamp without time zone, '1 day'::interval))::"date" AS "day"
        ), "daily_actions" AS (
         SELECT "date"("user_actions"."completed_at") AS "day",
            "count"(*) AS "actions"
           FROM "public"."user_actions"
          WHERE (("user_actions"."completed_at" >= (CURRENT_DATE - '6 days'::interval)) AND ("user_actions"."verification_status" = 'approved'::"text"))
          GROUP BY ("date"("user_actions"."completed_at"))
        ), "daily_users" AS (
         SELECT "date"("users"."created_at") AS "day",
            "count"(*) AS "new_users"
           FROM "public"."users"
          WHERE ("users"."created_at" >= (CURRENT_DATE - '6 days'::interval))
          GROUP BY ("date"("users"."created_at"))
        )
 SELECT "ds"."day",
    "to_char"(("ds"."day")::timestamp with time zone, 'Dy'::"text") AS "day_name",
    COALESCE("da"."actions", (0)::bigint) AS "actions",
    COALESCE("du"."new_users", (0)::bigint) AS "new_users"
   FROM (("date_series" "ds"
     LEFT JOIN "daily_actions" "da" ON (("ds"."day" = "da"."day")))
     LEFT JOIN "daily_users" "du" ON (("ds"."day" = "du"."day")))
  ORDER BY "ds"."day";


ALTER VIEW "public"."admin_weekly_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "icon_url" "text",
    "criteria_type" "text" NOT NULL,
    "criteria_value" integer NOT NULL,
    "badge_color" "text" DEFAULT '#F59E0B'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenge_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenge_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "activity_type" character varying(50) NOT NULL,
    "activity_description" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."challenge_activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenge_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "challenge_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "actions_completed" integer DEFAULT 0,
    "progress_percentage" numeric(5,2) DEFAULT 0.00,
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed" boolean DEFAULT false,
    "current_progress" integer DEFAULT 0
);


ALTER TABLE "public"."challenge_progress" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."challenges_public" AS
 SELECT "id",
    "title",
    "description",
    "challenge_type",
    "category",
    "start_date",
    "end_date",
    "reward_points",
    "target_metric",
    "target_value",
    "reward_description",
    "max_participants",
    "is_active",
    "created_by",
    "created_at"
   FROM "public"."challenges"
  WHERE ("is_active" = true);


ALTER VIEW "public"."challenges_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "type" "text" DEFAULT 'action'::"text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "points" integer DEFAULT 0,
    "co2_impact" numeric(8,2) DEFAULT 0,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "content_items_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"]))),
    CONSTRAINT "content_items_type_check" CHECK (("type" = ANY (ARRAY['action'::"text", 'announcement'::"text", 'educational'::"text", 'challenge'::"text"])))
);


ALTER TABLE "public"."content_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."level_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "level" integer NOT NULL,
    "reward_title" character varying(255) NOT NULL,
    "reward_description" "text" NOT NULL,
    "reward_type" character varying(50) NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "level_rewards_level_check" CHECK ((("level" >= 1) AND ("level" <= 10))),
    CONSTRAINT "level_rewards_reward_type_check" CHECK ((("reward_type")::"text" = ANY ((ARRAY['physical'::character varying, 'digital'::character varying, 'experience'::character varying, 'privilege'::character varying])::"text"[])))
);


ALTER TABLE "public"."level_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."level_thresholds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "level" integer NOT NULL,
    "points_required" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "level_thresholds_level_check" CHECK ((("level" >= 1) AND ("level" <= 10))),
    CONSTRAINT "level_thresholds_points_check" CHECK (("points_required" >= 0))
);


ALTER TABLE "public"."level_thresholds" OWNER TO "postgres";


COMMENT ON TABLE "public"."level_thresholds" IS 'Configurable level thresholds for user progression system';



CREATE TABLE IF NOT EXISTS "public"."news_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "excerpt" "text",
    "featured_image_url" "text",
    "author_id" "uuid" NOT NULL,
    "category" "text" DEFAULT 'general'::"text",
    "tags" "text"[],
    "is_published" boolean DEFAULT false,
    "is_featured" boolean DEFAULT false,
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."news_articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" character varying(50) NOT NULL,
    "title" character varying(255) NOT NULL,
    "message" "text" NOT NULL,
    "link_url" character varying(500),
    "link_type" character varying(50),
    "link_id" "uuid",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS 'Stores in-app notifications for users with links to related content';



CREATE TABLE IF NOT EXISTS "public"."password_resets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."password_resets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."recent_challenge_activities" AS
 SELECT "cal"."id",
    "cal"."challenge_id",
    "cal"."user_id",
    "cal"."activity_type",
    "cal"."activity_description",
    "cal"."metadata",
    "cal"."created_at",
    "c"."title" AS "challenge_title",
    "c"."category" AS "challenge_category",
    "c"."target_metric",
    "u"."first_name",
    "u"."last_name",
    "u"."avatar_url"
   FROM (("public"."challenge_activity_log" "cal"
     JOIN "public"."challenges" "c" ON (("cal"."challenge_id" = "c"."id")))
     JOIN "public"."users" "u" ON (("cal"."user_id" = "u"."id")))
  ORDER BY "cal"."created_at" DESC;


ALTER VIEW "public"."recent_challenge_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "uuid",
    "details" "jsonb",
    "severity" "text" DEFAULT 'medium'::"text",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "security_audit_log_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."security_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_value" "text" NOT NULL,
    "setting_type" "text" DEFAULT 'string'::"text",
    "description" "text",
    "is_public" boolean DEFAULT false,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "key" character varying(100) NOT NULL,
    "category" character varying(50) DEFAULT 'general'::character varying,
    "data_type" character varying(20) DEFAULT 'string'::character varying,
    CONSTRAINT "system_settings_setting_type_check" CHECK (("setting_type" = ANY (ARRAY['string'::"text", 'number'::"text", 'boolean'::"text", 'json'::"text"])))
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."team_performance_summary" AS
 WITH "team_user_stats" AS (
         SELECT DISTINCT "t"."id" AS "team_id",
            "t"."name" AS "team_name",
            "u"."id" AS "user_id",
            "u"."first_name",
            "u"."last_name",
            "u"."email",
            "u"."points",
            "u"."total_co2_saved",
            "u"."level",
            "u"."department",
            "u"."job_title",
                CASE
                    WHEN ("u"."id" = "t"."team_leader_id") THEN true
                    ELSE false
                END AS "is_leader",
            COALESCE("tm"."joined_at", "t"."created_at") AS "joined_at",
            ( SELECT "count"(*) AS "count"
                   FROM "public"."user_actions" "ua"
                  WHERE (("ua"."user_id" = "u"."id") AND ("ua"."verification_status" = 'approved'::"text"))) AS "verified_actions"
           FROM (("public"."teams" "t"
             LEFT JOIN "public"."team_members" "tm" ON (("t"."id" = "tm"."team_id")))
             LEFT JOIN "public"."users" "u" ON (("u"."id" = "tm"."user_id")))
          WHERE (("t"."is_active" = true) AND ("u"."id" IS NOT NULL))
        UNION
         SELECT "t"."id" AS "team_id",
            "t"."name" AS "team_name",
            "u"."id" AS "user_id",
            "u"."first_name",
            "u"."last_name",
            "u"."email",
            "u"."points",
            "u"."total_co2_saved",
            "u"."level",
            "u"."department",
            "u"."job_title",
            true AS "is_leader",
            "t"."created_at" AS "joined_at",
            ( SELECT "count"(*) AS "count"
                   FROM "public"."user_actions" "ua"
                  WHERE (("ua"."user_id" = "u"."id") AND ("ua"."verification_status" = 'approved'::"text"))) AS "verified_actions"
           FROM ("public"."teams" "t"
             JOIN "public"."users" "u" ON (("u"."id" = "t"."team_leader_id")))
          WHERE (("t"."is_active" = true) AND (NOT (EXISTS ( SELECT 1
                   FROM "public"."team_members" "tm"
                  WHERE (("tm"."team_id" = "t"."id") AND ("tm"."user_id" = "t"."team_leader_id"))))))
        )
 SELECT "team_id",
    "team_name",
    "user_id",
    "first_name",
    "last_name",
    "email",
    "points",
    "total_co2_saved",
    "level",
    "department",
    "job_title",
    "is_leader",
    "joined_at",
    "verified_actions",
    "sum"("points") OVER (PARTITION BY "team_id") AS "team_total_points",
    "sum"("total_co2_saved") OVER (PARTITION BY "team_id") AS "team_total_co2",
    "count"(*) OVER (PARTITION BY "team_id") AS "team_member_count",
    "avg"("points") OVER (PARTITION BY "team_id") AS "team_avg_points",
    "avg"("total_co2_saved") OVER (PARTITION BY "team_id") AS "team_avg_co2"
   FROM "team_user_stats"
  ORDER BY "team_id", "is_leader" DESC, "points" DESC;


ALTER VIEW "public"."team_performance_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."team_performance_summary" IS 'Team performance summary view - fixed to prevent duplicate team leader entries';



CREATE TABLE IF NOT EXISTS "public"."user_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_data" "jsonb",
    "session_id" "uuid",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "badge_id" "uuid" NOT NULL,
    "earned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_level_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "level" integer NOT NULL,
    "level_reward_id" "uuid" NOT NULL,
    "claim_status" character varying(20) DEFAULT 'pending'::character varying,
    "claimed_at" timestamp with time zone DEFAULT "now"(),
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "admin_notes" "text",
    "user_email" character varying(255) NOT NULL,
    "user_name" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_level_rewards_claim_status_check" CHECK ((("claim_status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'delivered'::character varying])::"text"[]))),
    CONSTRAINT "user_level_rewards_level_check" CHECK ((("level" >= 1) AND ("level" <= 10)))
);


ALTER TABLE "public"."user_level_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "achievement_alerts" boolean DEFAULT true,
    "leaderboard_updates" boolean DEFAULT false,
    "profile_visibility" "text" DEFAULT 'public'::"text",
    "leaderboard_participation" boolean DEFAULT true,
    "analytics_sharing" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "action_status" boolean DEFAULT true,
    "challenge_progress" boolean DEFAULT true,
    "team_updates" boolean DEFAULT true,
    "announcements" boolean DEFAULT true,
    "educational_content" boolean DEFAULT true,
    "reward_status" boolean DEFAULT true,
    CONSTRAINT "user_preferences_profile_visibility_check" CHECK (("profile_visibility" = ANY (ARRAY['public'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_team_memberships" AS
 SELECT "u"."id" AS "user_id",
    "u"."first_name",
    "u"."last_name",
    "u"."email",
    "t"."id" AS "team_id",
    "t"."name" AS "team_name",
    "t"."description" AS "team_description",
        CASE
            WHEN ("u"."id" = "t"."team_leader_id") THEN 'leader'::"text"
            ELSE 'member'::"text"
        END AS "role",
    COALESCE("tm"."joined_at", "t"."created_at") AS "joined_at",
    "t"."total_points" AS "team_total_points",
    "t"."total_co2_saved" AS "team_total_co2"
   FROM (("public"."users" "u"
     LEFT JOIN "public"."team_members" "tm" ON (("u"."id" = "tm"."user_id")))
     LEFT JOIN "public"."teams" "t" ON ((("t"."id" = "tm"."team_id") OR ("t"."team_leader_id" = "u"."id"))))
  WHERE ("t"."is_active" = true)
  ORDER BY "u"."id", "t"."name";


ALTER VIEW "public"."user_team_memberships" OWNER TO "postgres";


ALTER TABLE ONLY "public"."action_attachments"
    ADD CONSTRAINT "action_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."action_categories"
    ADD CONSTRAINT "action_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."action_categories"
    ADD CONSTRAINT "action_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_activities"
    ADD CONSTRAINT "admin_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_permissions"
    ADD CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_permissions"
    ADD CONSTRAINT "admin_permissions_user_id_permission_type_key" UNIQUE ("user_id", "permission_type");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_activity_log"
    ADD CONSTRAINT "challenge_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_participants"
    ADD CONSTRAINT "challenge_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_participants"
    ADD CONSTRAINT "challenge_participants_unique_participation" UNIQUE ("challenge_id", "user_id");



ALTER TABLE ONLY "public"."challenge_progress"
    ADD CONSTRAINT "challenge_progress_challenge_id_user_id_key" UNIQUE ("challenge_id", "user_id");



ALTER TABLE ONLY "public"."challenge_progress"
    ADD CONSTRAINT "challenge_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_items"
    ADD CONSTRAINT "content_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."level_rewards"
    ADD CONSTRAINT "level_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."level_thresholds"
    ADD CONSTRAINT "level_thresholds_level_unique" UNIQUE ("level");



ALTER TABLE ONLY "public"."level_thresholds"
    ADD CONSTRAINT "level_thresholds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."news_articles"
    ADD CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_resets"
    ADD CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_resets"
    ADD CONSTRAINT "password_resets_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sustainability_actions"
    ADD CONSTRAINT "sustainability_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_user_id_key" UNIQUE ("team_id", "user_id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_user_unique" UNIQUE ("team_id", "user_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_actions"
    ADD CONSTRAINT "user_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_analytics"
    ADD CONSTRAINT "user_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_badge_id_key" UNIQUE ("user_id", "badge_id");



ALTER TABLE ONLY "public"."user_level_rewards"
    ADD CONSTRAINT "user_level_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_level_rewards"
    ADD CONSTRAINT "user_level_rewards_user_id_level_level_reward_id_key" UNIQUE ("user_id", "level", "level_reward_id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_admin_activities_action_type" ON "public"."admin_activities" USING "btree" ("action_type");



CREATE INDEX "idx_admin_activities_admin_id" ON "public"."admin_activities" USING "btree" ("admin_id");



CREATE INDEX "idx_admin_activities_created_at" ON "public"."admin_activities" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_admin_activities_target" ON "public"."admin_activities" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_admin_audit_log_action" ON "public"."admin_audit_log" USING "btree" ("action_type");



CREATE INDEX "idx_admin_audit_log_target" ON "public"."admin_audit_log" USING "btree" ("target_table", "target_id");



CREATE INDEX "idx_admin_permissions_active" ON "public"."admin_permissions" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_challenge_activity_log_activity_type" ON "public"."challenge_activity_log" USING "btree" ("activity_type");



CREATE INDEX "idx_challenge_activity_log_challenge_id" ON "public"."challenge_activity_log" USING "btree" ("challenge_id");



CREATE INDEX "idx_challenge_activity_log_created_at" ON "public"."challenge_activity_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_challenge_activity_log_user_id" ON "public"."challenge_activity_log" USING "btree" ("user_id");



CREATE INDEX "idx_challenge_participants_challenge_completed" ON "public"."challenge_participants" USING "btree" ("challenge_id", "completed");



CREATE INDEX "idx_challenge_participants_challenge_id" ON "public"."challenge_participants" USING "btree" ("challenge_id");



CREATE INDEX "idx_challenge_progress_challenge_id" ON "public"."challenge_progress" USING "btree" ("challenge_id");



CREATE INDEX "idx_challenge_progress_last_updated" ON "public"."challenge_progress" USING "btree" ("last_updated");



CREATE INDEX "idx_challenge_progress_user_id" ON "public"."challenge_progress" USING "btree" ("user_id");



CREATE INDEX "idx_challenges_category" ON "public"."challenges" USING "btree" ("category");



CREATE INDEX "idx_challenges_challenge_type" ON "public"."challenges" USING "btree" ("challenge_type");



CREATE INDEX "idx_challenges_created_by" ON "public"."challenges" USING "btree" ("created_by");



CREATE INDEX "idx_challenges_end_date" ON "public"."challenges" USING "btree" ("end_date");



CREATE INDEX "idx_challenges_start_date" ON "public"."challenges" USING "btree" ("start_date");



CREATE INDEX "idx_content_items_category" ON "public"."content_items" USING "btree" ("category");



CREATE INDEX "idx_content_items_created_by" ON "public"."content_items" USING "btree" ("created_by");



CREATE INDEX "idx_content_items_status" ON "public"."content_items" USING "btree" ("status");



CREATE INDEX "idx_content_items_type" ON "public"."content_items" USING "btree" ("type");



CREATE INDEX "idx_content_items_type_status" ON "public"."content_items" USING "btree" ("type", "status");



CREATE INDEX "idx_level_rewards_active" ON "public"."level_rewards" USING "btree" ("is_active");



CREATE INDEX "idx_level_rewards_level" ON "public"."level_rewards" USING "btree" ("level");



CREATE INDEX "idx_news_articles_category" ON "public"."news_articles" USING "btree" ("category");



CREATE INDEX "idx_news_articles_featured" ON "public"."news_articles" USING "btree" ("is_featured");



CREATE INDEX "idx_news_articles_published" ON "public"."news_articles" USING "btree" ("is_published", "published_at");



CREATE INDEX "idx_news_articles_published_at" ON "public"."news_articles" USING "btree" ("published_at");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at");



CREATE INDEX "idx_notifications_is_read" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("type");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user_type" ON "public"."notifications" USING "btree" ("user_id", "type");



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_password_resets_expires" ON "public"."password_resets" USING "btree" ("expires_at");



CREATE INDEX "idx_point_transactions_reference_type" ON "public"."point_transactions" USING "btree" ("reference_type");



CREATE INDEX "idx_point_transactions_transaction_type" ON "public"."point_transactions" USING "btree" ("transaction_type");



CREATE INDEX "idx_point_transactions_user_id" ON "public"."point_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_security_audit_log_user_time" ON "public"."security_audit_log" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_sustainability_actions_active" ON "public"."sustainability_actions" USING "btree" ("is_active");



CREATE INDEX "idx_sustainability_actions_category_id" ON "public"."sustainability_actions" USING "btree" ("category_id");



CREATE INDEX "idx_sustainability_actions_difficulty" ON "public"."sustainability_actions" USING "btree" ("difficulty_level");



CREATE INDEX "idx_sustainability_actions_pending_submissions" ON "public"."sustainability_actions" USING "btree" ("is_user_created", "is_active", "submitted_by") WHERE (("is_user_created" = true) AND ("is_active" = false));



CREATE INDEX "idx_sustainability_actions_user_created" ON "public"."sustainability_actions" USING "btree" ("is_user_created", "submitted_by") WHERE ("is_user_created" = true);



CREATE INDEX "idx_sustainability_actions_user_submissions" ON "public"."sustainability_actions" USING "btree" ("submitted_by", "is_user_created", "is_active") WHERE ("is_user_created" = true);



CREATE INDEX "idx_system_settings_category" ON "public"."system_settings" USING "btree" ("category");



CREATE INDEX "idx_system_settings_data_type" ON "public"."system_settings" USING "btree" ("data_type");



CREATE INDEX "idx_team_members_team_id" ON "public"."team_members" USING "btree" ("team_id");



CREATE INDEX "idx_team_members_team_role" ON "public"."team_members" USING "btree" ("team_id", "role");



CREATE INDEX "idx_team_members_team_user" ON "public"."team_members" USING "btree" ("team_id", "user_id");



CREATE INDEX "idx_team_members_user_id" ON "public"."team_members" USING "btree" ("user_id");



CREATE INDEX "idx_teams_is_active" ON "public"."teams" USING "btree" ("is_active");



CREATE INDEX "idx_teams_team_leader_id" ON "public"."teams" USING "btree" ("team_leader_id");



CREATE INDEX "idx_teams_total_points" ON "public"."teams" USING "btree" ("total_points");



CREATE INDEX "idx_user_actions_completed_at" ON "public"."user_actions" USING "btree" ("completed_at");



CREATE INDEX "idx_user_actions_user_id" ON "public"."user_actions" USING "btree" ("user_id");



CREATE INDEX "idx_user_actions_user_status" ON "public"."user_actions" USING "btree" ("user_id", "verification_status");



CREATE INDEX "idx_user_actions_user_time" ON "public"."user_actions" USING "btree" ("user_id", "completed_at");



CREATE INDEX "idx_user_actions_verification_status" ON "public"."user_actions" USING "btree" ("verification_status");



CREATE INDEX "idx_user_analytics_event_type" ON "public"."user_analytics" USING "btree" ("event_type");



CREATE INDEX "idx_user_analytics_user_id" ON "public"."user_analytics" USING "btree" ("user_id");



CREATE INDEX "idx_user_level_rewards_level" ON "public"."user_level_rewards" USING "btree" ("level");



CREATE INDEX "idx_user_level_rewards_status" ON "public"."user_level_rewards" USING "btree" ("claim_status");



CREATE INDEX "idx_user_level_rewards_user_id" ON "public"."user_level_rewards" USING "btree" ("user_id");



CREATE INDEX "idx_user_preferences_user_id" ON "public"."user_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_user_sessions_expires" ON "public"."user_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_users_admin_active" ON "public"."users" USING "btree" ("is_admin", "is_active") WHERE ("is_admin" = true);



CREATE INDEX "idx_users_department" ON "public"."users" USING "btree" ("department");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_email_active" ON "public"."users" USING "btree" ("email", "is_active");



CREATE INDEX "idx_users_employee_id" ON "public"."users" USING "btree" ("employee_id");



CREATE INDEX "idx_users_is_active" ON "public"."users" USING "btree" ("is_active");



CREATE INDEX "idx_users_is_admin" ON "public"."users" USING "btree" ("is_admin") WHERE ("is_admin" = true);



CREATE INDEX "idx_users_level" ON "public"."users" USING "btree" ("level");



CREATE INDEX "idx_users_points" ON "public"."users" USING "btree" ("points");



CREATE INDEX "user_preferences_user_id_idx" ON "public"."user_preferences" USING "btree" ("user_id");



CREATE OR REPLACE VIEW "public"."admin_user_stats" AS
 SELECT "u"."id",
    "u"."first_name",
    "u"."last_name",
    "u"."email",
    "u"."department",
    "u"."points",
    "u"."level",
    "u"."total_co2_saved",
    "u"."is_active",
    "u"."is_admin",
    "count"("ua"."id") AS "total_actions",
    "count"(
        CASE
            WHEN ("ua"."verification_status" = 'verified'::"text") THEN 1
            ELSE NULL::integer
        END) AS "verified_actions",
    "tm"."team_id",
    "t"."name" AS "team_name"
   FROM ((("public"."users" "u"
     LEFT JOIN "public"."user_actions" "ua" ON (("u"."id" = "ua"."user_id")))
     LEFT JOIN "public"."team_members" "tm" ON (("u"."id" = "tm"."user_id")))
     LEFT JOIN "public"."teams" "t" ON (("tm"."team_id" = "t"."id")))
  GROUP BY "u"."id", "tm"."team_id", "t"."name";



CREATE OR REPLACE TRIGGER "auto_join_personal_challenge_trigger" AFTER INSERT ON "public"."challenges" FOR EACH ROW EXECUTE FUNCTION "public"."auto_join_personal_challenge"();



CREATE OR REPLACE TRIGGER "award_challenge_rewards_progress_trigger" AFTER UPDATE ON "public"."challenge_progress" FOR EACH ROW EXECUTE FUNCTION "public"."award_challenge_completion_rewards"();



CREATE OR REPLACE TRIGGER "award_challenge_rewards_trigger" AFTER UPDATE ON "public"."challenge_participants" FOR EACH ROW EXECUTE FUNCTION "public"."award_challenge_completion_rewards"();



CREATE OR REPLACE TRIGGER "badge_achievement_notification" AFTER INSERT ON "public"."user_badges" FOR EACH ROW EXECUTE FUNCTION "public"."notify_badge_achievement"();



CREATE OR REPLACE TRIGGER "check_personal_challenge_rate_limit_trigger" BEFORE INSERT ON "public"."challenges" FOR EACH ROW EXECUTE FUNCTION "public"."check_personal_challenge_rate_limit"();



CREATE OR REPLACE TRIGGER "create_user_preferences_trigger" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."create_user_preferences"();



CREATE OR REPLACE TRIGGER "ensure_team_leader_trigger" AFTER INSERT OR UPDATE OF "team_leader_id" ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_team_leader_in_members"();



CREATE OR REPLACE TRIGGER "leaderboard_notification_trigger" AFTER UPDATE ON "public"."users" FOR EACH ROW WHEN (("new"."points" IS DISTINCT FROM "old"."points")) EXECUTE FUNCTION "public"."track_leaderboard_changes"();



CREATE OR REPLACE TRIGGER "level_milestone_notification" AFTER INSERT ON "public"."point_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_points_and_notify"();



CREATE OR REPLACE TRIGGER "log_admin_challenges_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."challenges" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_log_admin_action"();



CREATE OR REPLACE TRIGGER "log_admin_teams_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_log_admin_action"();



CREATE OR REPLACE TRIGGER "log_admin_users_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_log_admin_action"();



CREATE OR REPLACE TRIGGER "log_personal_challenge_security_trigger" AFTER INSERT OR UPDATE ON "public"."challenges" FOR EACH ROW EXECUTE FUNCTION "public"."log_personal_challenge_security_event"();



CREATE OR REPLACE TRIGGER "on_point_transaction_created" AFTER INSERT ON "public"."point_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_points"();



CREATE OR REPLACE TRIGGER "on_team_member_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_team_stats"();



CREATE OR REPLACE TRIGGER "on_user_action_badge_check" AFTER INSERT OR UPDATE ON "public"."user_actions" FOR EACH ROW WHEN (("new"."verification_status" = 'approved'::"text")) EXECUTE FUNCTION "public"."check_and_award_badges"();



CREATE OR REPLACE TRIGGER "on_user_action_for_team_stats" AFTER INSERT OR UPDATE ON "public"."user_actions" FOR EACH ROW WHEN (("new"."verification_status" = 'approved'::"text")) EXECUTE FUNCTION "public"."update_team_stats"();



CREATE OR REPLACE TRIGGER "on_user_stats_for_team_update" AFTER UPDATE ON "public"."users" FOR EACH ROW WHEN ((("old"."points" <> "new"."points") OR ("old"."total_co2_saved" <> "new"."total_co2_saved"))) EXECUTE FUNCTION "public"."update_team_stats"();



CREATE OR REPLACE TRIGGER "on_user_stats_updated" AFTER UPDATE ON "public"."users" FOR EACH ROW WHEN ((("old"."points" <> "new"."points") OR ("old"."total_co2_saved" <> "new"."total_co2_saved"))) EXECUTE FUNCTION "public"."check_and_award_badges"();



CREATE OR REPLACE TRIGGER "simple_on_user_action_approved" AFTER INSERT OR UPDATE ON "public"."user_actions" FOR EACH ROW EXECUTE FUNCTION "public"."simple_update_user_co2_savings"();



CREATE OR REPLACE TRIGGER "trigger_award_new_badge" AFTER INSERT ON "public"."badges" FOR EACH ROW EXECUTE FUNCTION "public"."reevaluate_badge_awards"();



CREATE OR REPLACE TRIGGER "trigger_log_challenge_creation" AFTER INSERT ON "public"."challenges" FOR EACH ROW EXECUTE FUNCTION "public"."log_challenge_creation"();



CREATE OR REPLACE TRIGGER "trigger_notify_action_status_change" AFTER INSERT OR UPDATE OF "verification_status" ON "public"."user_actions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_action_status_change"();



CREATE OR REPLACE TRIGGER "trigger_notify_announcement_created" AFTER INSERT ON "public"."content_items" FOR EACH ROW WHEN ((("new"."type" = 'announcement'::"text") AND ("new"."status" = 'published'::"text"))) EXECUTE FUNCTION "public"."notify_announcement_created"();



CREATE OR REPLACE TRIGGER "trigger_notify_educational_content_created" AFTER INSERT ON "public"."content_items" FOR EACH ROW WHEN ((("new"."type" = 'educational'::"text") AND ("new"."status" = 'published'::"text"))) EXECUTE FUNCTION "public"."notify_educational_content_created"();



CREATE OR REPLACE TRIGGER "trigger_notify_user_action_submission_approved" AFTER UPDATE OF "is_active" ON "public"."sustainability_actions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_user_action_submission_approved"();



CREATE OR REPLACE TRIGGER "trigger_reevaluate_badge_on_update" AFTER UPDATE ON "public"."badges" FOR EACH ROW WHEN ((("new"."criteria_value" IS DISTINCT FROM "old"."criteria_value") OR ("new"."criteria_type" IS DISTINCT FROM "old"."criteria_type") OR ("new"."is_active" IS DISTINCT FROM "old"."is_active"))) EXECUTE FUNCTION "public"."reevaluate_badge_awards"();



CREATE OR REPLACE TRIGGER "trigger_update_user_level" BEFORE UPDATE OF "points" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_level"();



CREATE OR REPLACE TRIGGER "update_challenge_progress_trigger" AFTER INSERT OR UPDATE ON "public"."user_actions" FOR EACH ROW WHEN (("new"."verification_status" = 'approved'::"text")) EXECUTE FUNCTION "public"."update_challenge_progress_on_action"();



CREATE OR REPLACE TRIGGER "validate_level_thresholds_trigger" BEFORE INSERT OR UPDATE ON "public"."level_thresholds" FOR EACH ROW EXECUTE FUNCTION "public"."validate_level_thresholds_order"();



CREATE OR REPLACE TRIGGER "validate_personal_challenge_trigger" BEFORE INSERT OR UPDATE ON "public"."challenges" FOR EACH ROW EXECUTE FUNCTION "public"."validate_personal_challenge"();



ALTER TABLE ONLY "public"."action_attachments"
    ADD CONSTRAINT "action_attachments_user_action_id_fkey" FOREIGN KEY ("user_action_id") REFERENCES "public"."user_actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_activities"
    ADD CONSTRAINT "admin_activities_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."admin_permissions"
    ADD CONSTRAINT "admin_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."admin_permissions"
    ADD CONSTRAINT "admin_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_activity_log"
    ADD CONSTRAINT "challenge_activity_log_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_activity_log"
    ADD CONSTRAINT "challenge_activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_participants"
    ADD CONSTRAINT "challenge_participants_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_participants"
    ADD CONSTRAINT "challenge_participants_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_participants"
    ADD CONSTRAINT "challenge_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_progress"
    ADD CONSTRAINT "challenge_progress_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_progress"
    ADD CONSTRAINT "challenge_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."content_items"
    ADD CONSTRAINT "content_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."news_articles"
    ADD CONSTRAINT "news_articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_resets"
    ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."sustainability_actions"
    ADD CONSTRAINT "sustainability_actions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."action_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sustainability_actions"
    ADD CONSTRAINT "sustainability_actions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_team_leader_id_fkey" FOREIGN KEY ("team_leader_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_actions"
    ADD CONSTRAINT "user_actions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."sustainability_actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_actions"
    ADD CONSTRAINT "user_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_actions"
    ADD CONSTRAINT "user_actions_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_analytics"
    ADD CONSTRAINT "user_analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_level_rewards"
    ADD CONSTRAINT "user_level_rewards_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_level_rewards"
    ADD CONSTRAINT "user_level_rewards_level_reward_id_fkey" FOREIGN KEY ("level_reward_id") REFERENCES "public"."level_rewards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_level_rewards"
    ADD CONSTRAINT "user_level_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can insert admin activities" ON "public"."admin_activities" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true)))) AND ("admin_id" = "auth"."uid"())));



CREATE POLICY "Admins can manage level rewards" ON "public"."level_rewards" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "Admins can update reward claims" ON "public"."user_level_rewards" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "Admins can view all admin activities" ON "public"."admin_activities" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true)))));



CREATE POLICY "Admins can view all preferences" ON "public"."user_preferences" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "Admins can view all reward claims" ON "public"."user_level_rewards" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "System can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can create their own reward claims" ON "public"."user_level_rewards" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own preferences" ON "public"."user_preferences" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own preferences" ON "public"."user_preferences" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view active level rewards" ON "public"."level_rewards" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own preferences" ON "public"."user_preferences" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own reward claims" ON "public"."user_level_rewards" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."action_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "action_attachments_insert_own" ON "public"."action_attachments" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "user_actions"."user_id"
   FROM "public"."user_actions"
  WHERE ("user_actions"."id" = "action_attachments"."user_action_id"))));



CREATE POLICY "action_attachments_select_own" ON "public"."action_attachments" FOR SELECT USING (("auth"."uid"() IN ( SELECT "user_actions"."user_id"
   FROM "public"."user_actions"
  WHERE ("user_actions"."id" = "action_attachments"."user_action_id"))));



ALTER TABLE "public"."action_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "action_categories_delete_admin" ON "public"."action_categories" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "action_categories_insert_admin" ON "public"."action_categories" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "action_categories_select_all" ON "public"."action_categories" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "action_categories_update_admin" ON "public"."action_categories" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



ALTER TABLE "public"."admin_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_audit_log_select_admin" ON "public"."admin_audit_log" FOR SELECT USING (("auth"."uid"() IN ( SELECT "admin_permissions"."user_id"
   FROM "public"."admin_permissions"
  WHERE (("admin_permissions"."permission_type" = 'super_admin'::"text") AND ("admin_permissions"."is_active" = true)))));



ALTER TABLE "public"."admin_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_permissions_select_own" ON "public"."admin_permissions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."badges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "badges_admin_manage" ON "public"."badges" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "badges_select_all" ON "public"."badges" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "challenge_activity_insert_system" ON "public"."challenge_activity_log" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."challenge_activity_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "challenge_activity_select_enhanced" ON "public"."challenge_activity_log" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM ("public"."challenge_participants" "cp"
     JOIN "public"."challenges" "c" ON (("cp"."challenge_id" = "c"."id")))
  WHERE (("cp"."challenge_id" = "challenge_activity_log"."challenge_id") AND ("cp"."user_id" = "auth"."uid"()) AND ("c"."challenge_type" = ANY (ARRAY['team'::"text", 'company'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true))))));



ALTER TABLE "public"."challenge_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "challenge_participants_delete_simple" ON "public"."challenge_participants" FOR DELETE USING (((NOT (EXISTS ( SELECT 1
   FROM "public"."challenges" "c"
  WHERE (("c"."id" = "challenge_participants"."challenge_id") AND ("c"."challenge_type" = 'team'::"text"))))) AND (("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true)))))));



CREATE POLICY "challenge_participants_insert_proper" ON "public"."challenge_participants" FOR INSERT WITH CHECK (((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true))))) AND (EXISTS ( SELECT 1
   FROM "public"."challenges" "c"
  WHERE (("c"."id" = "challenge_participants"."challenge_id") AND ("c"."is_active" = true) AND ("c"."end_date" > "now"())))) AND ((EXISTS ( SELECT 1
   FROM "public"."challenges" "c"
  WHERE (("c"."id" = "challenge_participants"."challenge_id") AND ("c"."challenge_type" = 'individual'::"text") AND ("c"."created_by" = "auth"."uid"()) AND ("auth"."uid"() = "challenge_participants"."user_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."challenges" "c"
  WHERE (("c"."id" = "challenge_participants"."challenge_id") AND ("c"."challenge_type" = 'company'::"text")))) OR ((EXISTS ( SELECT 1
   FROM "public"."challenges" "c"
  WHERE (("c"."id" = "challenge_participants"."challenge_id") AND ("c"."challenge_type" = 'team'::"text")))) AND ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true)))) OR (EXISTS ( SELECT 1
   FROM ("public"."team_members" "tm"
     JOIN "public"."users" "u" ON (("tm"."user_id" = "u"."id")))
  WHERE (("tm"."user_id" = "tm"."user_id") AND ("u"."is_active" = true)))))))));



CREATE POLICY "challenge_participants_join_safe" ON "public"."challenge_participants" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."challenges" "c"
  WHERE (("c"."id" = "challenge_participants"."challenge_id") AND ("c"."is_active" = true) AND ("c"."end_date" > "now"()) AND (("c"."challenge_type" = ANY (ARRAY['team'::"text", 'company'::"text"])) OR (("c"."challenge_type" = 'individual'::"text") AND ("c"."created_by" = "auth"."uid"()))))))));



CREATE POLICY "challenge_participants_select" ON "public"."challenge_participants" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true)))) OR (EXISTS ( SELECT 1
   FROM (("public"."challenges" "c"
     JOIN "public"."team_members" "tm1" ON (("tm1"."user_id" = "auth"."uid"())))
     JOIN "public"."team_members" "tm2" ON (("tm2"."user_id" = "challenge_participants"."user_id")))
  WHERE (("c"."id" = "challenge_participants"."challenge_id") AND ("c"."challenge_type" = 'team'::"text") AND ("tm1"."team_id" = "tm2"."team_id"))))));



CREATE POLICY "challenge_participants_select_all" ON "public"."challenge_participants" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "challenge_participants_select_enhanced" ON "public"."challenge_participants" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."challenges" "c"
  WHERE (("c"."id" = "challenge_participants"."challenge_id") AND ("c"."challenge_type" = ANY (ARRAY['team'::"text", 'company'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true))))));



CREATE POLICY "challenge_participants_update_own" ON "public"."challenge_participants" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() IN ( SELECT "team_members"."user_id"
   FROM "public"."team_members"
  WHERE ("team_members"."team_id" = "challenge_participants"."team_id")))));



ALTER TABLE "public"."challenge_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "challenge_progress_insert_system" ON "public"."challenge_progress" FOR INSERT WITH CHECK (true);



CREATE POLICY "challenge_progress_insert_system_only" ON "public"."challenge_progress" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("current_setting"('role'::"text") = 'service_role'::"text")));



CREATE POLICY "challenge_progress_select_enhanced" ON "public"."challenge_progress" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."challenges" "c"
  WHERE (("c"."id" = "challenge_progress"."challenge_id") AND ("c"."challenge_type" = ANY (ARRAY['team'::"text", 'company'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true))))));



CREATE POLICY "challenge_progress_update_system" ON "public"."challenge_progress" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "challenge_progress_update_system_only" ON "public"."challenge_progress" FOR UPDATE USING (("public"."is_admin"() OR ("current_setting"('role'::"text") = 'service_role'::"text")));



ALTER TABLE "public"."challenges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "challenges_create_enhanced" ON "public"."challenges" FOR INSERT WITH CHECK ((("auth"."uid"() = "created_by") AND ((("challenge_type" = 'individual'::"text") AND ("max_participants" = 1) AND ("reward_points" = 0)) OR (("challenge_type" = 'team'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."team_members" "tm"
     JOIN "public"."teams" "t" ON (("tm"."team_id" = "t"."id")))
  WHERE (("tm"."user_id" = "auth"."uid"()) AND ("t"."is_active" = true))))) OR (("challenge_type" = 'company'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true))))))));



CREATE POLICY "challenges_delete_admin" ON "public"."challenges" FOR DELETE USING (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE (("users"."is_admin" = true) AND ("users"."is_active" = true)))));



CREATE POLICY "challenges_delete_simple" ON "public"."challenges" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true)))) OR ("created_by" = "auth"."uid"())));



CREATE POLICY "challenges_insert_admin_or_creator" ON "public"."challenges" FOR INSERT WITH CHECK ((("auth"."uid"() = "created_by") OR ("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE (("users"."is_admin" = true) AND ("users"."is_active" = true))))));



CREATE POLICY "challenges_select_proper" ON "public"."challenges" FOR SELECT USING ((("challenge_type" = 'company'::"text") OR (("challenge_type" = 'team'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true)))) OR (EXISTS ( SELECT 1
   FROM (("public"."team_members" "tm"
     JOIN "public"."teams" "t" ON (("tm"."team_id" = "t"."id")))
     JOIN "public"."users" "u" ON (("tm"."user_id" = "u"."id")))
  WHERE (("tm"."user_id" = "auth"."uid"()) AND ("t"."is_active" = true) AND ("u"."is_active" = true) AND ("t"."id" = "tm"."team_id")))))) OR (("challenge_type" = 'individual'::"text") AND (("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true))))))));



CREATE POLICY "challenges_update_admin_or_creator" ON "public"."challenges" FOR UPDATE USING ((("auth"."uid"() = "created_by") OR ("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE (("users"."is_admin" = true) AND ("users"."is_active" = true))))));



CREATE POLICY "challenges_update_enhanced" ON "public"."challenges" FOR UPDATE USING (((("auth"."uid"() = "created_by") AND (("challenge_type" <> 'individual'::"text") OR (("challenge_type" = 'individual'::"text") AND ("max_participants" = 1) AND ("reward_points" = 0)))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true)))))) WITH CHECK (((("challenge_type" <> 'individual'::"text") OR (("challenge_type" = 'individual'::"text") AND ("max_participants" = 1) AND ("reward_points" = 0))) AND (("auth"."uid"() = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true) AND ("users"."is_active" = true)))))));



ALTER TABLE "public"."content_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content_items_delete_admin" ON "public"."content_items" FOR DELETE USING (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE (("users"."is_admin" = true) AND ("users"."is_active" = true)))));



CREATE POLICY "content_items_insert_admin" ON "public"."content_items" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE (("users"."is_admin" = true) AND ("users"."is_active" = true)))));



CREATE POLICY "content_items_select_published" ON "public"."content_items" FOR SELECT USING ((("status" = 'published'::"text") OR ("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE (("users"."is_admin" = true) AND ("users"."is_active" = true))))));



CREATE POLICY "content_items_update_admin" ON "public"."content_items" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE (("users"."is_admin" = true) AND ("users"."is_active" = true)))));



ALTER TABLE "public"."level_rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."level_thresholds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "level_thresholds_select_policy" ON "public"."level_thresholds" FOR SELECT USING (true);



ALTER TABLE "public"."news_articles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "news_articles_admin_manage" ON "public"."news_articles" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "news_articles_select_secure" ON "public"."news_articles" FOR SELECT USING ((("is_published" = true) OR "public"."is_admin"()));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_resets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "password_resets_select_own" ON "public"."password_resets" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."point_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "point_transactions_insert_system_only" ON "public"."point_transactions" FOR INSERT WITH CHECK (("public"."is_admin"() OR ("current_setting"('role'::"text") = 'service_role'::"text")));



CREATE POLICY "point_transactions_select_secure" ON "public"."point_transactions" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"()));



ALTER TABLE "public"."security_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "security_audit_log_admin_only" ON "public"."security_audit_log" USING ("public"."is_admin"());



ALTER TABLE "public"."sustainability_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sustainability_actions_delete_policy" ON "public"."sustainability_actions" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "sustainability_actions_insert_policy" ON "public"."sustainability_actions" FOR INSERT WITH CHECK (("public"."is_admin"() OR (("submitted_by" = "auth"."uid"()) AND ("is_user_created" = true) AND ("is_active" = false) AND ("verification_required" = true))));



CREATE POLICY "sustainability_actions_select_policy" ON "public"."sustainability_actions" FOR SELECT USING ((("is_active" = true) OR ("submitted_by" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "sustainability_actions_update_policy" ON "public"."sustainability_actions" FOR UPDATE USING (("public"."is_admin"() OR (("submitted_by" = "auth"."uid"()) AND ("is_user_created" = true) AND ("is_active" = false)))) WITH CHECK (("public"."is_admin"() OR (("submitted_by" = "auth"."uid"()) AND ("is_user_created" = true) AND ("is_active" = false))));



ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_settings_admin_delete" ON "public"."system_settings" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "system_settings_admin_insert" ON "public"."system_settings" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "system_settings_admin_select_all" ON "public"."system_settings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "system_settings_admin_update" ON "public"."system_settings" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_admin" = true)))));



CREATE POLICY "system_settings_select_public" ON "public"."system_settings" FOR SELECT USING (("is_public" = true));



CREATE POLICY "system_settings_select_public_or_admin" ON "public"."system_settings" FOR SELECT USING ((("is_public" = true) OR "public"."is_admin"()));



ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_members_delete_secure" ON "public"."team_members" FOR DELETE USING ((("auth"."uid"() = "user_id") OR "public"."is_team_leader"("auth"."uid"(), "team_id") OR "public"."is_admin"()));



CREATE POLICY "team_members_insert_secure" ON "public"."team_members" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."is_team_leader"("auth"."uid"(), "team_id") OR "public"."is_admin"()));



CREATE POLICY "team_members_select_all" ON "public"."team_members" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teams_delete_admin" ON "public"."teams" FOR DELETE USING (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE (("users"."is_admin" = true) AND ("users"."is_active" = true)))));



CREATE POLICY "teams_delete_admin_only" ON "public"."teams" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "teams_insert_secure" ON "public"."teams" FOR INSERT WITH CHECK (((("auth"."uid"() = "team_leader_id") AND ("auth"."role"() = 'authenticated'::"text")) OR "public"."is_admin"()));



CREATE POLICY "teams_select_all" ON "public"."teams" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "teams_update_leader" ON "public"."teams" FOR UPDATE USING (("auth"."uid"() = "team_leader_id"));



CREATE POLICY "teams_update_secure" ON "public"."teams" FOR UPDATE USING (("public"."is_team_leader"("auth"."uid"(), "id") OR "public"."is_admin"())) WITH CHECK (("public"."is_team_leader"("auth"."uid"(), "id") OR "public"."is_admin"()));



ALTER TABLE "public"."user_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_actions_delete_secure" ON "public"."user_actions" FOR DELETE USING (((("auth"."uid"() = "user_id") AND ("completed_at" > ("now"() - '01:00:00'::interval))) OR "public"."is_admin"()));



CREATE POLICY "user_actions_insert_secure" ON "public"."user_actions" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (( SELECT "count"(*) AS "count"
   FROM "public"."user_actions" "user_actions_1"
  WHERE (("user_actions_1"."user_id" = "auth"."uid"()) AND ("user_actions_1"."completed_at" > ("now"() - '01:00:00'::interval)))) < 20)));



CREATE POLICY "user_actions_select_enhanced" ON "public"."user_actions" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_admin"() OR (("verification_status" = 'approved'::"text") AND ("auth"."role"() = 'authenticated'::"text"))));



CREATE POLICY "user_actions_update_time_limited" ON "public"."user_actions" FOR UPDATE USING (((("auth"."uid"() = "user_id") AND ("completed_at" > ("now"() - '24:00:00'::interval))) OR "public"."is_admin"())) WITH CHECK (((("auth"."uid"() = "user_id") AND ("completed_at" > ("now"() - '24:00:00'::interval))) OR "public"."is_admin"()));



ALTER TABLE "public"."user_analytics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_analytics_insert_own" ON "public"."user_analytics" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_analytics_select_own" ON "public"."user_analytics" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_badges_admin_manage" ON "public"."user_badges" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "user_badges_select_all" ON "public"."user_badges" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."user_level_rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_sessions_delete_own" ON "public"."user_sessions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_sessions_insert_own" ON "public"."user_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_sessions_select_own" ON "public"."user_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_delete_admin" ON "public"."users" FOR DELETE USING (("auth"."uid"() IN ( SELECT "users_1"."id"
   FROM "public"."users" "users_1"
  WHERE (("users_1"."is_admin" = true) AND ("users_1"."is_active" = true)))));



CREATE POLICY "users_delete_admin_only" ON "public"."users" FOR DELETE USING (("public"."is_admin"() AND ("id" <> "auth"."uid"())));



CREATE POLICY "users_insert_secure" ON "public"."users" FOR INSERT WITH CHECK ((("auth"."uid"() = "id") OR "public"."is_admin"()));



CREATE POLICY "users_select_limited_info" ON "public"."users" FOR SELECT USING ((("auth"."uid"() = "id") OR "public"."is_admin"() OR (("auth"."role"() = 'authenticated'::"text") AND ("is_active" = true))));



CREATE POLICY "users_select_own" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "users_update_secure" ON "public"."users" FOR UPDATE USING (((("auth"."uid"() = "id") AND ("is_active" = true)) OR "public"."is_admin"())) WITH CHECK (((("auth"."uid"() = "id") AND ("is_active" = true)) OR "public"."is_admin"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."admin_activities";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."admin_permissions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."badges";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."content_items";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."point_transactions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."security_audit_log";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_analytics";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."users";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."auto_join_personal_challenge"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_join_personal_challenge"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_join_personal_challenge"() TO "service_role";



GRANT ALL ON FUNCTION "public"."award_challenge_completion_rewards"() TO "anon";
GRANT ALL ON FUNCTION "public"."award_challenge_completion_rewards"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_challenge_completion_rewards"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_user_level"("user_points" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_user_level"("user_points" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_user_level"("user_points" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_leave_team_challenge"("participant_user_id" "uuid", "challenge_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_leave_team_challenge"("participant_user_id" "uuid", "challenge_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_leave_team_challenge"("participant_user_id" "uuid", "challenge_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_award_badges"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_award_badges"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_award_badges"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_max_participants"("challenge_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_max_participants"("challenge_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_max_participants"("challenge_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_personal_challenge_rate_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_personal_challenge_rate_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_personal_challenge_rate_limit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_privilege_escalation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_privilege_escalation"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_privilege_escalation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_privilege_escalation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_password_resets"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_password_resets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_password_resets"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_sessions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_sessions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link_url" character varying, "p_link_type" character varying, "p_link_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link_url" character varying, "p_link_type" character varying, "p_link_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link_url" character varying, "p_link_type" character varying, "p_link_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification_if_enabled"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link_url" character varying, "p_link_type" character varying, "p_link_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification_if_enabled"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link_url" character varying, "p_link_type" character varying, "p_link_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification_if_enabled"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link_url" character varying, "p_link_type" character varying, "p_link_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_team_challenge_participants"("p_challenge_id" "uuid", "p_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_team_challenge_participants"("p_challenge_id" "uuid", "p_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_team_challenge_participants"("p_challenge_id" "uuid", "p_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_preferences"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_preferences"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_preferences"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."detect_suspicious_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."detect_suspicious_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."detect_suspicious_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_suspicious_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_team_leader_in_members"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_team_leader_in_members"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_team_leader_in_members"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_department_rankings"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_department_rankings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_department_rankings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_level_thresholds"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_level_thresholds"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_level_thresholds"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recent_admin_activities"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_recent_admin_activities"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recent_admin_activities"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_top_performers"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_top_performers"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_top_performers"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_activity_summary"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_available_rewards"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_available_rewards"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_available_rewards"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_current_level"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_current_level"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_current_level"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_leaderboard_position"("user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_leaderboard_position"("user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_leaderboard_position"("user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_leader"("user_uuid" "uuid", "team_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_leader"("user_uuid" "uuid", "team_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_leader"("user_uuid" "uuid", "team_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_team_member"("user_uuid" "uuid", "team_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_team_member"("user_uuid" "uuid", "team_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_team_member"("user_uuid" "uuid", "team_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_admin_activity"("p_admin_user_id" "uuid", "p_action" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_details" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_admin_activity"("p_admin_user_id" "uuid", "p_action" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_details" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_admin_activity"("p_admin_user_id" "uuid", "p_action" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_details" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_challenge_activity"("p_challenge_id" "uuid", "p_user_id" "uuid", "p_activity_type" character varying, "p_description" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_challenge_activity"("p_challenge_id" "uuid", "p_user_id" "uuid", "p_activity_type" character varying, "p_description" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_challenge_activity"("p_challenge_id" "uuid", "p_user_id" "uuid", "p_activity_type" character varying, "p_description" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_challenge_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_challenge_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_challenge_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_personal_challenge_security_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_personal_challenge_security_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_personal_challenge_security_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_security_event"("p_user_id" "uuid", "p_event_type" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_details" "jsonb", "p_severity" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_security_event"("p_user_id" "uuid", "p_event_type" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_details" "jsonb", "p_severity" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_security_event"("p_user_id" "uuid", "p_event_type" "text", "p_resource_type" "text", "p_resource_id" "uuid", "p_details" "jsonb", "p_severity" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notification_read"("notification_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("notification_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("notification_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_action_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_action_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_action_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_announcement_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_announcement_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_announcement_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_badge_achievement"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_badge_achievement"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_badge_achievement"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_educational_content_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_educational_content_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_educational_content_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_level_milestone"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_level_milestone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_level_milestone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_user_action_submission_approved"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_user_action_submission_approved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_user_action_submission_approved"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_all_challenge_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_all_challenge_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_all_challenge_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_all_user_levels"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_all_user_levels"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_all_user_levels"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_single_team_stats"("target_team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_single_team_stats"("target_team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_single_team_stats"("target_team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reevaluate_badge_awards"() TO "anon";
GRANT ALL ON FUNCTION "public"."reevaluate_badge_awards"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reevaluate_badge_awards"() TO "service_role";



GRANT ALL ON FUNCTION "public"."safe_check_max_participants"("challenge_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."safe_check_max_participants"("challenge_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."safe_check_max_participants"("challenge_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_weekly_points_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."send_weekly_points_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_weekly_points_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."simple_update_user_co2_savings"() TO "anon";
GRANT ALL ON FUNCTION "public"."simple_update_user_co2_savings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."simple_update_user_co2_savings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."track_leaderboard_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."track_leaderboard_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_leaderboard_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_log_admin_action"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_log_admin_action"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_log_admin_action"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_challenge_progress_on_action"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_challenge_progress_on_action"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_challenge_progress_on_action"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_level_threshold"("threshold_level" integer, "new_points_required" integer, "admin_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_level_threshold"("threshold_level" integer, "new_points_required" integer, "admin_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_level_threshold"("threshold_level" integer, "new_points_required" integer, "admin_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_team_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_team_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_team_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_co2_savings"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_co2_savings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_co2_savings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_level"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_level"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_level"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_points"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_points"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_points"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_points_and_notify"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_points_and_notify"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_points_and_notify"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_level_thresholds_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_level_thresholds_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_level_thresholds_order"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_personal_challenge"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_personal_challenge"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_personal_challenge"() TO "service_role";


















GRANT ALL ON TABLE "public"."action_attachments" TO "anon";
GRANT ALL ON TABLE "public"."action_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."action_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."action_categories" TO "anon";
GRANT ALL ON TABLE "public"."action_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."action_categories" TO "service_role";



GRANT ALL ON TABLE "public"."admin_activities" TO "anon";
GRANT ALL ON TABLE "public"."admin_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_activities" TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_log_view" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_log_view" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_log_view" TO "service_role";



GRANT ALL ON TABLE "public"."sustainability_actions" TO "anon";
GRANT ALL ON TABLE "public"."sustainability_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."sustainability_actions" TO "service_role";



GRANT ALL ON TABLE "public"."user_actions" TO "anon";
GRANT ALL ON TABLE "public"."user_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_actions" TO "service_role";



GRANT ALL ON TABLE "public"."admin_category_breakdown" TO "anon";
GRANT ALL ON TABLE "public"."admin_category_breakdown" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_category_breakdown" TO "service_role";



GRANT ALL ON TABLE "public"."challenge_participants" TO "anon";
GRANT ALL ON TABLE "public"."challenge_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_participants" TO "service_role";



GRANT ALL ON TABLE "public"."challenges" TO "anon";
GRANT ALL ON TABLE "public"."challenges" TO "authenticated";
GRANT ALL ON TABLE "public"."challenges" TO "service_role";



GRANT ALL ON TABLE "public"."admin_challenge_stats" TO "anon";
GRANT ALL ON TABLE "public"."admin_challenge_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_challenge_stats" TO "service_role";



GRANT ALL ON TABLE "public"."point_transactions" TO "anon";
GRANT ALL ON TABLE "public"."point_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."point_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."user_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."admin_dashboard_stats" TO "anon";
GRANT ALL ON TABLE "public"."admin_dashboard_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_dashboard_stats" TO "service_role";



GRANT ALL ON TABLE "public"."admin_monthly_trends" TO "anon";
GRANT ALL ON TABLE "public"."admin_monthly_trends" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_monthly_trends" TO "service_role";



GRANT ALL ON TABLE "public"."admin_permissions" TO "anon";
GRANT ALL ON TABLE "public"."admin_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."admin_team_stats" TO "anon";
GRANT ALL ON TABLE "public"."admin_team_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_team_stats" TO "service_role";



GRANT ALL ON TABLE "public"."admin_user_stats" TO "anon";
GRANT ALL ON TABLE "public"."admin_user_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_user_stats" TO "service_role";



GRANT ALL ON TABLE "public"."admin_weekly_activity" TO "anon";
GRANT ALL ON TABLE "public"."admin_weekly_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_weekly_activity" TO "service_role";



GRANT ALL ON TABLE "public"."badges" TO "anon";
GRANT ALL ON TABLE "public"."badges" TO "authenticated";
GRANT ALL ON TABLE "public"."badges" TO "service_role";



GRANT ALL ON TABLE "public"."challenge_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."challenge_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."challenge_progress" TO "anon";
GRANT ALL ON TABLE "public"."challenge_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."challenge_progress" TO "service_role";



GRANT ALL ON TABLE "public"."challenges_public" TO "anon";
GRANT ALL ON TABLE "public"."challenges_public" TO "authenticated";
GRANT ALL ON TABLE "public"."challenges_public" TO "service_role";



GRANT ALL ON TABLE "public"."content_items" TO "anon";
GRANT ALL ON TABLE "public"."content_items" TO "authenticated";
GRANT ALL ON TABLE "public"."content_items" TO "service_role";



GRANT ALL ON TABLE "public"."level_rewards" TO "anon";
GRANT ALL ON TABLE "public"."level_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."level_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."level_thresholds" TO "anon";
GRANT ALL ON TABLE "public"."level_thresholds" TO "authenticated";
GRANT ALL ON TABLE "public"."level_thresholds" TO "service_role";



GRANT ALL ON TABLE "public"."news_articles" TO "anon";
GRANT ALL ON TABLE "public"."news_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."news_articles" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."password_resets" TO "anon";
GRANT ALL ON TABLE "public"."password_resets" TO "authenticated";
GRANT ALL ON TABLE "public"."password_resets" TO "service_role";



GRANT ALL ON TABLE "public"."recent_challenge_activities" TO "anon";
GRANT ALL ON TABLE "public"."recent_challenge_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."recent_challenge_activities" TO "service_role";



GRANT ALL ON TABLE "public"."security_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."security_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."security_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."team_performance_summary" TO "anon";
GRANT ALL ON TABLE "public"."team_performance_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."team_performance_summary" TO "service_role";



GRANT ALL ON TABLE "public"."user_analytics" TO "anon";
GRANT ALL ON TABLE "public"."user_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."user_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."user_level_rewards" TO "anon";
GRANT ALL ON TABLE "public"."user_level_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."user_level_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_team_memberships" TO "anon";
GRANT ALL ON TABLE "public"."user_team_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."user_team_memberships" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























\unrestrict DdMbd7uruyi8grk8leF4lIdqZJocSpXjwe6Djes3rqb3LewDgmDoivAvNjlcICP

RESET ALL;
