CREATE TABLE "day_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" text NOT NULL,
	"day_id" text NOT NULL,
	"day_name" text NOT NULL,
	"start_date" text NOT NULL,
	"frequency_count" integer DEFAULT 1 NOT NULL,
	"frequency_unit" text DEFAULT 'week' NOT NULL,
	"end_date" text,
	"excluded_dates" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_day_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"day_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"exercise_name" text NOT NULL,
	"muscle_groups" text[] DEFAULT '{}' NOT NULL,
	"category" text NOT NULL,
	"sets" integer DEFAULT 3 NOT NULL,
	"reps" text DEFAULT '8-12' NOT NULL,
	"weight" numeric(8, 2) DEFAULT '0' NOT NULL,
	"weight_unit" text DEFAULT 'lbs' NOT NULL,
	"rest_seconds" integer,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_days" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" text NOT NULL,
	"name" text NOT NULL,
	"is_rest" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"start_date" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"hashed_password" text NOT NULL,
	"calendar_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_calendar_hash_unique" UNIQUE("calendar_hash")
);
--> statement-breakpoint
ALTER TABLE "day_schedules" ADD CONSTRAINT "day_schedules_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_schedules" ADD CONSTRAINT "day_schedules_day_id_program_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."program_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_day_exercises" ADD CONSTRAINT "program_day_exercises_day_id_program_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."program_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_days" ADD CONSTRAINT "program_days_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;