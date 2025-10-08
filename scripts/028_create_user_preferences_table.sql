-- Create user_preferences table for storing individual user settings
CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    
    -- Notification preferences
    "email_notifications" boolean DEFAULT true,
    "weekly_digest" boolean DEFAULT true,
    "achievement_alerts" boolean DEFAULT true,
    "leaderboard_updates" boolean DEFAULT true,
    "team_invitations" boolean DEFAULT true,
    
    -- Privacy settings
    "profile_visibility" "text" DEFAULT 'public' CHECK ("profile_visibility" IN ('public', 'private')),
    "leaderboard_participation" boolean DEFAULT true,
    "analytics_sharing" boolean DEFAULT true,
    
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    
    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id"),
    CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own preferences" ON "public"."user_preferences"
    FOR SELECT USING ("user_id" = "auth"."uid"());

CREATE POLICY "Users can update their own preferences" ON "public"."user_preferences"
    FOR UPDATE USING ("user_id" = "auth"."uid"());

CREATE POLICY "Users can insert their own preferences" ON "public"."user_preferences"
    FOR INSERT WITH CHECK ("user_id" = "auth"."uid"());

-- Admins can view all preferences
CREATE POLICY "Admins can view all preferences" ON "public"."user_preferences"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "public"."users" 
            WHERE "users"."id" = "auth"."uid"() 
            AND "users"."is_admin" = true
        )
    );

-- Create function to automatically create preferences for new users
CREATE OR REPLACE FUNCTION "public"."create_user_preferences"()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "public"."user_preferences" ("user_id")
    VALUES (NEW."id");
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create preferences
DROP TRIGGER IF EXISTS "create_user_preferences_trigger" ON "public"."users";
CREATE TRIGGER "create_user_preferences_trigger"
    AFTER INSERT ON "public"."users"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."create_user_preferences"();

-- Grant permissions
GRANT ALL ON "public"."user_preferences" TO "authenticated";
GRANT ALL ON "public"."user_preferences" TO "service_role";

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "user_preferences_user_id_idx" ON "public"."user_preferences" ("user_id");
