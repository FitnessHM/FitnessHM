ALTER TABLE "strava_accounts" ADD COLUMN "athlete_first_name" text;--> statement-breakpoint
ALTER TABLE "strava_accounts" ADD COLUMN "athlete_avatar_url" text;--> statement-breakpoint
ALTER TABLE "strava_accounts" ADD COLUMN "last_synced_at" timestamp with time zone;