-- Add missing RPC functions that the admin panel expects

-- Drop existing function first to avoid conflicts, then recreate
DROP FUNCTION IF EXISTS log_admin_activity;

-- Function to log admin activity
CREATE OR REPLACE FUNCTION log_admin_activity(
    p_admin_user_id uuid,
    p_action text,
    p_resource_type text,
    p_resource_id uuid,
    p_details jsonb DEFAULT NULL
) RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_admin_activity TO authenticated;
