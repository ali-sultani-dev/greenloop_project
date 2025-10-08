-- Admin Panel Real-Time Features
-- This script creates all missing database views, functions, and audit logging for the admin panel

-- Updated to use action_type column instead of action to match existing schema
-- The admin_audit_log table already exists with action_type column, so we skip table creation
-- and only add missing views and functions

-- Drop existing function first to avoid "not unique" error
DROP FUNCTION IF EXISTS log_admin_activity;

-- Create function to log admin activities (updated to use existing table structure)
CREATE OR REPLACE FUNCTION log_admin_activity(
  p_admin_user_id UUID,
  p_action VARCHAR(100),
  p_resource_type VARCHAR(50),
  p_resource_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    target_table,
    target_id,
    new_values,
    ip_address,
    user_agent
  ) VALUES (
    p_admin_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Create comprehensive admin dashboard statistics view
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT 
  -- User statistics
  (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
  (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_users_30d,
  -- Replace last_login with user_sessions.created_at for recent activity tracking
  (SELECT COUNT(DISTINCT us.user_id) FROM user_sessions us WHERE us.created_at >= CURRENT_DATE - INTERVAL '7 days') as active_users_7d,
  
  -- Action statistics
  (SELECT COUNT(*) FROM user_actions WHERE verification_status = 'approved') as total_verified_actions,
  (SELECT COUNT(*) FROM user_actions WHERE verification_status = 'pending') as pending_actions,
  (SELECT COUNT(*) FROM user_actions WHERE completed_at >= CURRENT_DATE - INTERVAL '30 days') as actions_30d,
  
  -- Team statistics
  (SELECT COUNT(*) FROM teams WHERE is_active = true) as active_teams,
  (SELECT AVG(total_points) FROM teams WHERE is_active = true) as avg_team_points,
  
  -- Challenge statistics
  (SELECT COUNT(*) FROM challenges WHERE is_active = true AND end_date > NOW()) as active_challenges,
  (SELECT COUNT(*) FROM challenge_participants WHERE completed = true) as completed_challenges,
  
  -- Environmental impact
  (SELECT COALESCE(SUM(total_co2_saved), 0) FROM users) as total_co2_saved,
  (SELECT COALESCE(SUM(co2_saved), 0) FROM user_actions WHERE verification_status = 'approved') as verified_co2_impact,
  
  -- Points and engagement
  (SELECT COALESCE(SUM(points), 0) FROM users) as total_points_awarded,
  (SELECT COUNT(*) FROM point_transactions WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as recent_transactions;

-- Create monthly trend data view for dashboard charts
CREATE OR REPLACE VIEW admin_monthly_trends AS
WITH monthly_data AS (
  SELECT 
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as new_users
  FROM users 
  WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
  GROUP BY DATE_TRUNC('month', created_at)
),
monthly_actions AS (
  SELECT 
    DATE_TRUNC('month', completed_at) as month,
    COUNT(*) as actions_completed
  FROM user_actions 
  WHERE completed_at >= CURRENT_DATE - INTERVAL '12 months'
    AND verification_status = 'approved'
  GROUP BY DATE_TRUNC('month', completed_at)
)
SELECT 
  COALESCE(md.month, ma.month) as month,
  COALESCE(md.new_users, 0) as new_users,
  COALESCE(ma.actions_completed, 0) as actions_completed
FROM monthly_data md
FULL OUTER JOIN monthly_actions ma ON md.month = ma.month
ORDER BY month;

-- Create category breakdown view for real action data
CREATE OR REPLACE VIEW admin_category_breakdown AS
SELECT 
  ac.name as category_name,
  COUNT(ua.id) as action_count,
  ROUND(
    (COUNT(ua.id)::DECIMAL / NULLIF((SELECT COUNT(*) FROM user_actions WHERE verification_status = 'approved'), 0)) * 100, 
    1
  ) as percentage,
  COALESCE(SUM(ua.co2_saved), 0) as total_co2_impact,
  COALESCE(SUM(ua.points_earned), 0) as total_points
FROM action_categories ac
LEFT JOIN sustainability_actions sa ON ac.id = sa.category_id
LEFT JOIN user_actions ua ON sa.id = ua.action_id AND ua.verification_status = 'approved'
GROUP BY ac.id, ac.name
ORDER BY action_count DESC;

-- Create weekly activity view for dashboard
CREATE OR REPLACE VIEW admin_weekly_activity AS
WITH date_series AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '6 days',
    CURRENT_DATE,
    '1 day'::interval
  )::date as day
),
daily_actions AS (
  SELECT 
    DATE(completed_at) as day,
    COUNT(*) as actions
  FROM user_actions 
  WHERE completed_at >= CURRENT_DATE - INTERVAL '6 days'
    AND verification_status = 'approved'
  GROUP BY DATE(completed_at)
),
daily_users AS (
  SELECT 
    DATE(created_at) as day,
    COUNT(*) as new_users
  FROM users 
  WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
  GROUP BY DATE(created_at)
)
SELECT 
  ds.day,
  TO_CHAR(ds.day, 'Dy') as day_name,
  COALESCE(da.actions, 0) as actions,
  COALESCE(du.new_users, 0) as new_users
FROM date_series ds
LEFT JOIN daily_actions da ON ds.day = da.day
LEFT JOIN daily_users du ON ds.day = du.day
ORDER BY ds.day;

-- Updated to use existing admin_audit_log table structure with action_type column
-- Create enhanced admin audit log view
CREATE OR REPLACE VIEW admin_audit_log_view AS
SELECT 
  aal.id,
  aal.admin_user_id,
  u.first_name || ' ' || u.last_name as admin_name,
  u.email as admin_email,
  aal.action_type as action,
  aal.target_table as resource_type,
  aal.target_id as resource_id,
  aal.new_values as details,
  aal.ip_address,
  aal.user_agent,
  aal.created_at
FROM admin_audit_log aal
JOIN users u ON aal.admin_user_id = u.id
ORDER BY aal.created_at DESC;

-- Create function to get top performers
CREATE OR REPLACE FUNCTION get_top_performers(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(
  user_id UUID,
  full_name TEXT,
  email VARCHAR,
  department VARCHAR,
  points INTEGER,
  level INTEGER,
  total_co2_saved NUMERIC,
  verified_actions BIGINT,
  team_name VARCHAR
) AS $$
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
$$ LANGUAGE plpgsql;

-- Create function to get recent admin activities
CREATE OR REPLACE FUNCTION get_recent_admin_activities(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  id UUID,
  admin_name TEXT,
  action VARCHAR,
  resource_type VARCHAR,
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
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
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT ON admin_dashboard_stats TO authenticated;
GRANT SELECT ON admin_monthly_trends TO authenticated;
GRANT SELECT ON admin_category_breakdown TO authenticated;
GRANT SELECT ON admin_weekly_activity TO authenticated;
GRANT SELECT ON admin_audit_log_view TO authenticated;
GRANT EXECUTE ON FUNCTION log_admin_activity TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_performers TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_admin_activities TO authenticated;
