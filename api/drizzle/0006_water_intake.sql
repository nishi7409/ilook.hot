CREATE TABLE "water_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "water_goals" (
	"user_id" text PRIMARY KEY NOT NULL,
	"daily_goal_ml" integer DEFAULT 2500 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "water_logs_user_date_idx" ON "water_logs" ("user_id", "date");
--> statement-breakpoint
ALTER TABLE "water_logs" ADD CONSTRAINT "water_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "water_goals" ADD CONSTRAINT "water_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
