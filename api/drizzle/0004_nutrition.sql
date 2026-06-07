CREATE TABLE "nutrition_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"food_id" text NOT NULL,
	"food_name" text NOT NULL,
	"brand" text,
	"serving_size" numeric(10, 3) DEFAULT '100' NOT NULL,
	"serving_unit" text DEFAULT 'g' NOT NULL,
	"calories" numeric(8, 2) DEFAULT '0' NOT NULL,
	"protein" numeric(8, 2) DEFAULT '0' NOT NULL,
	"carbs" numeric(8, 2) DEFAULT '0' NOT NULL,
	"fat" numeric(8, 2) DEFAULT '0' NOT NULL,
	"meal_type" text NOT NULL,
	"servings" numeric(6, 2) DEFAULT '1' NOT NULL,
	"logged_at" text NOT NULL,
	"source" text DEFAULT 'custom' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_goals" (
	"user_id" text PRIMARY KEY NOT NULL,
	"calories" integer DEFAULT 2400 NOT NULL,
	"protein" integer DEFAULT 180 NOT NULL,
	"carbs" integer DEFAULT 250 NOT NULL,
	"fat" integer DEFAULT 80 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nutrition_logs" ADD CONSTRAINT "nutrition_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "nutrition_goals" ADD CONSTRAINT "nutrition_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
