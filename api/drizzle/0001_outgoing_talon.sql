ALTER TABLE "program_day_exercises" ALTER COLUMN "reps" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "program_day_exercises" ALTER COLUMN "reps" SET DATA TYPE integer USING (
  CASE WHEN "reps" ~ '^\d+$' THEN "reps"::integer ELSE 10 END
);--> statement-breakpoint
ALTER TABLE "program_day_exercises" ALTER COLUMN "reps" SET DEFAULT 10;