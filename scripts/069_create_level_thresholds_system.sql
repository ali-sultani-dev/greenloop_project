-- Create level thresholds table for dynamic level management
CREATE TABLE IF NOT EXISTS "public"."level_thresholds" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "level" integer NOT NULL,
    "points_required" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "level_thresholds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "level_thresholds_level_unique" UNIQUE ("level"),
    CONSTRAINT "level_thresholds_level_check" CHECK (("level" >= 1) AND ("level" <= 10)),
    CONSTRAINT "level_thresholds_points_check" CHECK (("points_required" >= 0))
);

-- Insert default level thresholds based on current hardcoded values
INSERT INTO "public"."level_thresholds" ("level", "points_required") VALUES
(1, 0),      -- Level 1: 0 points
(2, 100),    -- Level 2: 100 points  
(3, 250),    -- Level 3: 250 points
(4, 500),    -- Level 4: 500 points
(5, 1000),   -- Level 5: 1000 points
(6, 2000),   -- Level 6: 2000 points
(7, 5000),   -- Level 7: 5000 points
(8, 10000),  -- Level 8: 10000 points
(9, 20000),  -- Level 9: 20000 points
(10, 50000)  -- Level 10: 50000 points
ON CONFLICT ("level") DO NOTHING;

-- Create function to get level thresholds
CREATE OR REPLACE FUNCTION "public"."get_level_thresholds"()
RETURNS TABLE("level" integer, "points_required" integer)
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT lt.level, lt.points_required
    FROM level_thresholds lt
    ORDER BY lt.level ASC;
END;
$$;

-- Update the calculate_user_level function to use dynamic thresholds
CREATE OR REPLACE FUNCTION "public"."calculate_user_level"("user_points" integer) 
RETURNS integer
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

-- Update the get_user_current_level function to use dynamic thresholds
CREATE OR REPLACE FUNCTION "public"."get_user_current_level"("user_uuid" uuid) 
RETURNS integer
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

-- Create function to update level thresholds (admin only)
CREATE OR REPLACE FUNCTION "public"."update_level_threshold"(
    "threshold_level" integer,
    "new_points_required" integer,
    "admin_user_id" uuid
)
RETURNS boolean
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
    is_admin boolean := false;
BEGIN
    -- Check if user is admin
    SELECT users.is_admin INTO is_admin
    FROM users
    WHERE users.id = admin_user_id;
    
    IF NOT is_admin THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    -- Update the threshold
    UPDATE level_thresholds
    SET points_required = new_points_required,
        updated_at = now()
    WHERE level = threshold_level;
    
    -- Recalculate all user levels after threshold change
    UPDATE users 
    SET level = calculate_user_level(points),
        updated_at = now();
    
    RETURN true;
END;
$$;

-- Grant necessary permissions
GRANT SELECT ON "public"."level_thresholds" TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_level_thresholds"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."update_level_threshold"(integer, integer, uuid) TO "authenticated";

-- Add RLS policies for level_thresholds
ALTER TABLE "public"."level_thresholds" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "level_thresholds_select_policy" ON "public"."level_thresholds"
    FOR SELECT USING (true);

-- Add comment
COMMENT ON TABLE "public"."level_thresholds" IS 'Configurable level thresholds for user progression system';
