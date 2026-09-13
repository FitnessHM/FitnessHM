ALTER TABLE "session_logs" ADD COLUMN "strava_activity_id" bigint;--> statement-breakpoint
ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_strava_activity_id_unique" UNIQUE("strava_activity_id");--> statement-breakpoint
ALTER TABLE "strava_accounts" ADD CONSTRAINT "strava_accounts_strava_athlete_id_unique" UNIQUE("strava_athlete_id");