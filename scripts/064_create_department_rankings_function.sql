-- Create function to get department rankings
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
      COUNT(u.id) as user_count,
      COALESCE(SUM(u.points), 0) as dept_points,
      COALESCE(SUM(u.total_co2_saved), 0) as dept_co2_saved,
      COALESCE(AVG(u.points), 0) as avg_points,
      COALESCE(AVG(u.total_co2_saved), 0) as avg_co2,
      COALESCE(COUNT(ua.id), 0) as action_count
    FROM users u
    LEFT JOIN user_actions ua ON u.id = ua.user_id AND ua.verification_status = 'approved'
    WHERE u.is_active = true AND u.department IS NOT NULL AND u.department != ''
    GROUP BY u.department
    HAVING COUNT(u.id) > 0
  ),
  ranked_departments AS (
    SELECT 
      ds.*,
      ROW_NUMBER() OVER (ORDER BY ds.dept_points DESC) as points_rank,
      ROW_NUMBER() OVER (ORDER BY ds.dept_co2_saved DESC) as co2_rank,
      ROW_NUMBER() OVER (ORDER BY ds.action_count DESC) as actions_rank
    FROM department_stats ds
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
