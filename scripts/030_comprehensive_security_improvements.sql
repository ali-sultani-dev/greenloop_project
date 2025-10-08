-- Comprehensive security improvements for RLS policies and access control

-- =============================================
-- SECURITY UTILITY FUNCTIONS
-- =============================================

-- Standardized admin check function
CREATE OR REPLACE FUNCTION is_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = user_uuid 
    AND is_admin = true 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is team leader
CREATE OR REPLACE FUNCTION is_team_leader(user_uuid uuid DEFAULT auth.uid(), team_uuid uuid DEFAULT NULL)
RETURNS boolean AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is team member
CREATE OR REPLACE FUNCTION is_team_member(user_uuid uuid DEFAULT auth.uid(), team_uuid uuid DEFAULT NULL)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON tm.team_id = t.id
    WHERE tm.user_id = user_uuid 
    AND (team_uuid IS NULL OR tm.team_id = team_uuid)
    AND t.is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- IMPROVED USER POLICIES
-- =============================================

-- Drop overly permissive user policies
DROP POLICY IF EXISTS "users_select_public_info" ON public.users;
DROP POLICY IF EXISTS "users_update_admin_or_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_admin_or_own" ON public.users;

-- More restrictive user information access
CREATE POLICY "users_select_limited_info" ON public.users
FOR SELECT USING (
  auth.uid() = id OR  -- Own data
  is_admin() OR       -- Admin access
  -- Limited public info for authenticated users
  (auth.role() = 'authenticated' AND is_active = true)
);

-- Secure user updates
CREATE POLICY "users_update_secure" ON public.users
FOR UPDATE USING (
  (auth.uid() = id AND is_active = true) OR  -- Own data only if active
  is_admin()  -- Admin override
)
WITH CHECK (
  (auth.uid() = id AND is_active = true) OR
  is_admin()
);

-- Secure user creation (admin only for creating other users)
CREATE POLICY "users_insert_secure" ON public.users
FOR INSERT WITH CHECK (
  auth.uid() = id OR  -- Self registration
  is_admin()          -- Admin creating users
);

-- Admin-only user deletion
CREATE POLICY "users_delete_admin_only" ON public.users
FOR DELETE USING (is_admin() AND id != auth.uid()); -- Prevent self-deletion

-- =============================================
-- ENHANCED ACTION SYSTEM POLICIES
-- =============================================

-- Drop existing user_actions policies for replacement
DROP POLICY IF EXISTS "user_actions_select_own" ON public.user_actions;
DROP POLICY IF EXISTS "user_actions_select_public" ON public.user_actions;
DROP POLICY IF EXISTS "user_actions_insert_own" ON public.user_actions;
DROP POLICY IF EXISTS "user_actions_update_own" ON public.user_actions;

-- Enhanced user actions policies with time restrictions
CREATE POLICY "user_actions_select_enhanced" ON public.user_actions
FOR SELECT USING (
  auth.uid() = user_id OR  -- Own actions
  is_admin() OR            -- Admin access
  (verification_status = 'approved' AND auth.role() = 'authenticated')  -- Public approved actions
);

CREATE POLICY "user_actions_insert_secure" ON public.user_actions
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  -- Rate limiting: max 20 actions per hour
  (SELECT COUNT(*) FROM public.user_actions 
   WHERE user_id = auth.uid() 
   AND completed_at > NOW() - INTERVAL '1 hour') < 20
);

-- Only allow updates within 24 hours and by owner or admin
CREATE POLICY "user_actions_update_time_limited" ON public.user_actions
FOR UPDATE USING (
  (auth.uid() = user_id AND completed_at > NOW() - INTERVAL '24 hours') OR
  is_admin()
)
WITH CHECK (
  (auth.uid() = user_id AND completed_at > NOW() - INTERVAL '24 hours') OR
  is_admin()
);

-- Allow deletion only by owner (recent actions) or admin
CREATE POLICY "user_actions_delete_secure" ON public.user_actions
FOR DELETE USING (
  (auth.uid() = user_id AND completed_at > NOW() - INTERVAL '1 hour') OR
  is_admin()
);

-- =============================================
-- ENHANCED TEAM POLICIES
-- =============================================

-- Drop existing team policies for replacement
DROP POLICY IF EXISTS "teams_insert_admin_or_leader" ON public.teams;
DROP POLICY IF EXISTS "teams_update_admin_or_leader" ON public.teams;
DROP POLICY IF EXISTS "team_members_insert_own_or_leader" ON public.team_members;
DROP POLICY IF EXISTS "team_members_delete_own_or_leader" ON public.team_members;

-- Secure team creation
CREATE POLICY "teams_insert_secure" ON public.teams
FOR INSERT WITH CHECK (
  (auth.uid() = team_leader_id AND auth.role() = 'authenticated') OR
  is_admin()
);

-- Secure team updates
CREATE POLICY "teams_update_secure" ON public.teams
FOR UPDATE USING (
  is_team_leader(auth.uid(), id) OR
  is_admin()
)
WITH CHECK (
  is_team_leader(auth.uid(), id) OR
  is_admin()
);

-- Admin-only team deletion
CREATE POLICY "teams_delete_admin_only" ON public.teams
FOR DELETE USING (is_admin());

-- Enhanced team member management
CREATE POLICY "team_members_insert_secure" ON public.team_members
FOR INSERT WITH CHECK (
  auth.uid() = user_id OR  -- Self-joining
  is_team_leader(auth.uid(), team_id) OR  -- Team leader adding members
  is_admin()
);

CREATE POLICY "team_members_delete_secure" ON public.team_members
FOR DELETE USING (
  auth.uid() = user_id OR  -- Self-leaving
  is_team_leader(auth.uid(), team_id) OR  -- Team leader removing members
  is_admin()
);

-- =============================================
-- ENHANCED CHALLENGE POLICIES
-- =============================================

-- Drop existing challenge policies for replacement
DROP POLICY IF EXISTS "challenges_insert_authenticated" ON public.challenges;
DROP POLICY IF EXISTS "challenges_update_creator" ON public.challenges;

-- More restrictive challenge creation
CREATE POLICY "challenges_insert_restricted" ON public.challenges
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND
  (
    challenge_type = 'individual' OR  -- Anyone can create individual challenges
    (challenge_type = 'team' AND is_team_member()) OR  -- Team members can create team challenges
    (challenge_type = 'company' AND is_admin())  -- Only admins can create company challenges
  )
);

-- Secure challenge updates
CREATE POLICY "challenges_update_secure" ON public.challenges
FOR UPDATE USING (
  auth.uid() = created_by OR
  is_admin()
)
WITH CHECK (
  auth.uid() = created_by OR
  is_admin()
);

-- Admin-only challenge deletion
CREATE POLICY "challenges_delete_admin_only" ON public.challenges
FOR DELETE USING (is_admin());

-- =============================================
-- ENHANCED ADMIN POLICIES
-- =============================================

-- Secure admin operations for sustainability actions
DROP POLICY IF EXISTS "sustainability_actions_insert_admin" ON public.sustainability_actions;
DROP POLICY IF EXISTS "sustainability_actions_update_admin" ON public.sustainability_actions;
DROP POLICY IF EXISTS "sustainability_actions_delete_admin" ON public.sustainability_actions;

CREATE POLICY "sustainability_actions_admin_insert" ON public.sustainability_actions
FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "sustainability_actions_admin_update" ON public.sustainability_actions
FOR UPDATE USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "sustainability_actions_admin_delete" ON public.sustainability_actions
FOR DELETE USING (is_admin());

-- =============================================
-- AUDIT AND SECURITY LOGGING
-- =============================================

-- Create security audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id),
  event_type text NOT NULL,
  resource_type text,
  resource_id uuid,
  details jsonb,
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT NOW()
);

-- Enable RLS on security audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view security logs
CREATE POLICY "security_audit_log_admin_only" ON public.security_audit_log
FOR ALL USING (is_admin());

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id uuid,
  p_event_type text,
  p_resource_type text DEFAULT NULL,
  p_resource_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL,
  p_severity text DEFAULT 'medium'
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    user_id, event_type, resource_type, resource_id, details, severity
  ) VALUES (
    p_user_id, p_event_type, p_resource_type, p_resource_id, p_details, p_severity
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGER FOR ADMIN ACTION LOGGING
-- =============================================

-- Function to automatically log admin actions
CREATE OR REPLACE FUNCTION trigger_log_admin_action()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers for critical tables
DROP TRIGGER IF EXISTS log_admin_users_changes ON public.users;
CREATE TRIGGER log_admin_users_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION trigger_log_admin_action();

DROP TRIGGER IF EXISTS log_admin_challenges_changes ON public.challenges;
CREATE TRIGGER log_admin_challenges_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION trigger_log_admin_action();

DROP TRIGGER IF EXISTS log_admin_teams_changes ON public.teams;
CREATE TRIGGER log_admin_teams_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION trigger_log_admin_action();

-- =============================================
-- DATA RETENTION POLICIES
-- =============================================

-- Function to cleanup old sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_sessions 
  WHERE expires_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old password reset tokens
CREATE OR REPLACE FUNCTION cleanup_expired_password_resets()
RETURNS void AS $$
BEGIN
  DELETE FROM public.password_resets 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- GRANT NECESSARY PERMISSIONS
-- =============================================

-- Grant execute permissions on security functions
GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_team_leader(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_event(uuid, text, text, uuid, jsonb, text) TO authenticated;

-- Grant necessary table permissions
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.teams TO authenticated;
GRANT SELECT ON public.team_members TO authenticated;
GRANT INSERT ON public.security_audit_log TO authenticated;
