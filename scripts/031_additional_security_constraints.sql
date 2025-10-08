-- Additional security constraints and validation rules

-- =============================================
-- DATA VALIDATION CONSTRAINTS
-- =============================================

-- Add check constraints for data integrity
ALTER TABLE public.users 
ADD CONSTRAINT users_email_format_check 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE public.users 
ADD CONSTRAINT users_points_non_negative_check 
CHECK (points >= 0);

ALTER TABLE public.users 
ADD CONSTRAINT users_co2_non_negative_check 
CHECK (total_co2_saved >= 0);

-- Challenge validation constraints
ALTER TABLE public.challenges 
ADD CONSTRAINT challenges_dates_logical_check 
CHECK (end_date > start_date);

ALTER TABLE public.challenges 
ADD CONSTRAINT challenges_target_value_positive_check 
CHECK (target_value > 0);

ALTER TABLE public.challenges 
ADD CONSTRAINT challenges_reward_points_non_negative_check 
CHECK (reward_points >= 0);

-- User actions validation
ALTER TABLE public.user_actions 
ADD CONSTRAINT user_actions_points_non_negative_check 
CHECK (points_earned >= 0);

ALTER TABLE public.user_actions 
ADD CONSTRAINT user_actions_co2_non_negative_check 
CHECK (co2_saved >= 0);

-- Team constraints
ALTER TABLE public.teams 
ADD CONSTRAINT teams_max_members_positive_check 
CHECK (max_members > 0 AND max_members <= 1000);

-- =============================================
-- SECURITY INDEXES FOR PERFORMANCE
-- =============================================

-- Indexes for security-related queries
CREATE INDEX IF NOT EXISTS idx_users_admin_active ON public.users(is_admin, is_active) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_users_email_active ON public.users(email, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON public.password_resets(expires_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_time ON public.security_audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_actions_user_time ON public.user_actions(user_id, completed_at);

-- =============================================
-- ADDITIONAL RLS POLICIES FOR MISSING TABLES
-- =============================================

-- Point transactions enhanced security
DROP POLICY IF EXISTS "point_transactions_select_own" ON public.point_transactions;
DROP POLICY IF EXISTS "point_transactions_insert_own" ON public.point_transactions;

CREATE POLICY "point_transactions_select_secure" ON public.point_transactions
FOR SELECT USING (
  auth.uid() = user_id OR
  is_admin()
);

-- Only system or admin can create point transactions
CREATE POLICY "point_transactions_insert_system_only" ON public.point_transactions
FOR INSERT WITH CHECK (
  is_admin() OR
  -- Allow system-generated transactions (via triggers/functions)
  current_setting('role') = 'service_role'
);

-- User badges security
DROP POLICY IF EXISTS "user_badges_insert_own" ON public.user_badges;

CREATE POLICY "user_badges_insert_system_only" ON public.user_badges
FOR INSERT WITH CHECK (
  is_admin() OR
  -- Allow system-generated badges (via triggers/functions)
  current_setting('role') = 'service_role'
);

-- News articles enhanced security
DROP POLICY IF EXISTS "news_articles_select_published" ON public.news_articles;

CREATE POLICY "news_articles_select_secure" ON public.news_articles
FOR SELECT USING (
  is_published = true OR
  is_admin()
);

CREATE POLICY "news_articles_admin_manage" ON public.news_articles
FOR ALL USING (is_admin())
WITH CHECK (is_admin());

-- System settings enhanced security
CREATE POLICY "system_settings_select_public_or_admin" ON public.system_settings
FOR SELECT USING (
  is_public = true OR
  is_admin()
);

-- =============================================
-- SECURITY MONITORING FUNCTIONS
-- =============================================

-- Function to detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity()
RETURNS TABLE(user_id uuid, activity_type text, count bigint, severity text) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for privilege escalation attempts
CREATE OR REPLACE FUNCTION check_privilege_escalation()
RETURNS TABLE(user_id uuid, event_type text, details jsonb) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on monitoring functions to admins only
REVOKE EXECUTE ON FUNCTION detect_suspicious_activity() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION check_privilege_escalation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION detect_suspicious_activity() TO authenticated;
GRANT EXECUTE ON FUNCTION check_privilege_escalation() TO authenticated;

-- =============================================
-- FINAL SECURITY VALIDATIONS
-- =============================================

-- Ensure all critical tables have RLS enabled
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'users', 'user_actions', 'challenges', 'teams', 'team_members',
            'point_transactions', 'user_badges', 'sustainability_actions',
            'challenge_participants', 'admin_permissions', 'security_audit_log'
        )
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    END LOOP;
END $$;
