CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"muscle_groups" text[] DEFAULT '{}' NOT NULL,
	"category" text NOT NULL,
	"group" text NOT NULL,
	"top_rated" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
