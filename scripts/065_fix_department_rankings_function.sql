-- Fix department rankings function to show accurate data
DROP FUNCTION IF EXISTS get_department_rankings();

CREATE OR REPLACE FUNCTION get_department_rankings()
RETURNS TABLE (
  department TEXT,
  total_users BIGINT,
  total_points BIGINT,
  total_co2_saved NUMERIC,
  avg_points_per_user NUMERIC,
  avg_co2_per_user NUMERIC,
  total_actions BIGINT,
  rank_by_points INTEGER,
  rank_by_co2 INTEGER,
  rank_by_actions INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_department_rankings() TO authenticated;
