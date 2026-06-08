CREATE TABLE "progress_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"photo_url" text NOT NULL,
	"category" text NOT NULL,
	"bodyweight" real,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "progress_photos_user_date_idx" ON "progress_photos" ("user_id", "date");
--> statement-breakpoint
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
