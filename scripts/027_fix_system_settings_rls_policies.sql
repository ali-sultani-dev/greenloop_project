-- Add RLS policies for system_settings table to allow admin operations

-- Policy to allow admins to select all system settings (not just public ones)
CREATE POLICY "system_settings_admin_select_all" ON "public"."system_settings" 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM "public"."users" 
    WHERE "users"."id" = "auth"."uid"() 
    AND "users"."is_admin" = true
  )
);

-- Policy to allow admins to insert new system settings
CREATE POLICY "system_settings_admin_insert" ON "public"."system_settings" 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "public"."users" 
    WHERE "users"."id" = "auth"."uid"() 
    AND "users"."is_admin" = true
  )
);

-- Policy to allow admins to update system settings
CREATE POLICY "system_settings_admin_update" ON "public"."system_settings" 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM "public"."users" 
    WHERE "users"."id" = "auth"."uid"() 
    AND "users"."is_admin" = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "public"."users" 
    WHERE "users"."id" = "auth"."uid"() 
    AND "users"."is_admin" = true
  )
);

-- Policy to allow admins to delete system settings
CREATE POLICY "system_settings_admin_delete" ON "public"."system_settings" 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM "public"."users" 
    WHERE "users"."id" = "auth"."uid"() 
    AND "users"."is_admin" = true
  )
);

-- Grant necessary permissions to authenticated users for the users table
-- (needed for the RLS policies to check admin status)
GRANT SELECT ON "public"."users" TO authenticated;
