CREATE TABLE "workout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"name" text NOT NULL,
	"program_day_id" text,
	"completed" boolean DEFAULT false NOT NULL,
	"duration_seconds" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_session_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"exercise_name" text NOT NULL,
	"muscle_groups" text[] DEFAULT '{}' NOT NULL,
	"category" text NOT NULL,
	"target_sets" integer DEFAULT 3 NOT NULL,
	"target_reps" integer DEFAULT 10 NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"session_exercise_id" text NOT NULL,
	"set_number" integer NOT NULL,
	"reps" integer NOT NULL,
	"weight" numeric(8, 2) DEFAULT '0' NOT NULL,
	"weight_unit" text DEFAULT 'lbs' NOT NULL,
	"completed" boolean DEFAULT true NOT NULL,
	"is_personal_record" boolean DEFAULT false NOT NULL,
	"completed_at" text
);
--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workout_session_exercises" ADD CONSTRAINT "workout_session_exercises_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_session_exercise_id_fk" FOREIGN KEY ("session_exercise_id") REFERENCES "public"."workout_session_exercises"("id") ON DELETE cascade ON UPDATE no action;
