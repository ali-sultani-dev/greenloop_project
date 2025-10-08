-- Create missing content_items table and add missing columns
-- This fixes the "table not found" and "column not found" errors

-- Create content_items table (referenced in admin panel but missing from schema)
CREATE TABLE IF NOT EXISTS "public"."content_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "type" "text" NOT NULL DEFAULT 'action',
    "category" "text" NOT NULL DEFAULT 'general',
    "status" "text" NOT NULL DEFAULT 'draft',
    "points" integer DEFAULT 0,
    "co2_impact" numeric(8,2) DEFAULT 0,
    "tags" "text"[] DEFAULT '{}',
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "content_items_type_check" CHECK (("type" = ANY (ARRAY['action'::"text", 'announcement'::"text", 'educational'::"text", 'challenge'::"text"]))),
    CONSTRAINT "content_items_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);

ALTER TABLE "public"."content_items" OWNER TO "postgres";

-- Add primary key and constraints
ALTER TABLE ONLY "public"."content_items"
    ADD CONSTRAINT "content_items_pkey" PRIMARY KEY ("id");

-- Add foreign key for created_by
ALTER TABLE ONLY "public"."content_items"
    ADD CONSTRAINT "content_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");

-- Add missing category column to challenges table
ALTER TABLE "public"."challenges" 
ADD COLUMN IF NOT EXISTS "category" "text" DEFAULT 'general';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "idx_content_items_type" ON "public"."content_items" USING "btree" ("type");
CREATE INDEX IF NOT EXISTS "idx_content_items_status" ON "public"."content_items" USING "btree" ("status");
CREATE INDEX IF NOT EXISTS "idx_content_items_category" ON "public"."content_items" USING "btree" ("category");
CREATE INDEX IF NOT EXISTS "idx_content_items_created_by" ON "public"."content_items" USING "btree" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_challenges_category" ON "public"."challenges" USING "btree" ("category");

-- Enable RLS on content_items
ALTER TABLE "public"."content_items" ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for content_items
CREATE POLICY "content_items_select_published" ON "public"."content_items" 
FOR SELECT 
USING ("status" = 'published' OR auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true AND is_active = true
));

CREATE POLICY "content_items_insert_admin" ON "public"."content_items" 
FOR INSERT 
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM users WHERE is_admin = true AND is_active = true
    )
);

CREATE POLICY "content_items_update_admin" ON "public"."content_items" 
FOR UPDATE 
USING (
    auth.uid() IN (
        SELECT id FROM users WHERE is_admin = true AND is_active = true
    )
);

CREATE POLICY "content_items_delete_admin" ON "public"."content_items" 
FOR DELETE 
USING (
    auth.uid() IN (
        SELECT id FROM users WHERE is_admin = true AND is_active = true
    )
);
