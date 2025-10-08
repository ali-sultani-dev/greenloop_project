-- Fix admin_dashboard_stats view to include missing total_users and avg_points fields
-- This addresses the issue where Total Users shows only active users and Avg Points shows N/A

-- Drop and recreate the admin_dashboard_stats view with the missing fields
DROP VIEW IF EXISTS admin_dashboard_stats;

CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT 
  -- User statistics
  (SELECT COUNT(*) FROM users) as total_users, -- Added total_users field for all registered users
  (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
  (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_users_30d,
  -- Replace last_login with user_sessions.created_at for recent activity tracking
  (SELECT COUNT(DISTINCT us.user_id) FROM user_sessions us WHERE us.created_at >= CURRENT_DATE - INTERVAL '7 days') as active_users_7d,
  
  -- Points statistics
  (SELECT ROUND(AVG(points), 1) FROM users WHERE points > 0) as avg_points, -- Added avg_points calculation
  
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

-- Grant necessary permissions
GRANT SELECT ON admin_dashboard_stats TO authenticated;
