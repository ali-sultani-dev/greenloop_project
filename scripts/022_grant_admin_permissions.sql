-- Grant admin permissions to enable sustainability actions management
-- This script grants 'manage_content' permission to the specified user

-- Replace 'YOUR_USER_EMAIL' with the actual email of the user who needs admin access
-- You can find the user_id by checking the users table or auth.users view

-- Option 1: Grant permissions by email (recommended)
INSERT INTO admin_permissions (user_id, permission_type, granted_by, is_active)
SELECT 
    u.id as user_id,
    'manage_content' as permission_type,
    u.id as granted_by, -- Self-granted for initial setup
    true as is_active
FROM auth.users u 
WHERE u.email = 'YOUR_USER_EMAIL' -- Replace with actual email
AND NOT EXISTS (
    SELECT 1 FROM admin_permissions ap 
    WHERE ap.user_id = u.id 
    AND ap.permission_type = 'manage_content'
    AND ap.is_active = true
);

-- Option 2: Grant super_admin permissions (highest level access)
-- Uncomment the lines below if you need full admin access instead of just content management

-- INSERT INTO admin_permissions (user_id, permission_type, granted_by, is_active)
-- SELECT 
--     u.id as user_id,
--     'super_admin' as permission_type,
--     u.id as granted_by,
--     true as is_active
-- FROM auth.users u 
-- WHERE u.email = 'YOUR_USER_EMAIL' -- Replace with actual email
-- AND NOT EXISTS (
--     SELECT 1 FROM admin_permissions ap 
--     WHERE ap.user_id = u.id 
--     AND ap.permission_type = 'super_admin'
--     AND ap.is_active = true
-- );

-- Verify the permissions were granted
SELECT 
    u.email,
    ap.permission_type,
    ap.is_active,
    ap.granted_at
FROM auth.users u
JOIN admin_permissions ap ON u.id = ap.user_id
WHERE u.email = 'YOUR_USER_EMAIL' -- Replace with actual email
AND ap.is_active = true;
