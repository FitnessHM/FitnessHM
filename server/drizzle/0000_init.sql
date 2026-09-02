CREATE TABLE "athletes" (
	"user_id" text PRIMARY KEY NOT NULL,
	"days_per_week" integer NOT NULL,
	"other_training" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_distance_meters" double precision NOT NULL,
	"event_label" text NOT NULL,
	"goal_type" text NOT NULL,
	"goal_time_seconds" integer,
	"target_date" text NOT NULL,
	"baseline_source" text NOT NULL,
	"race_mantra" text,
	"target_split_seconds_per_km" double precision,
	"status" text NOT NULL,
	"discipline" text,
	"level" text,
	"disciplines" jsonb,
	"discipline_levels" jsonb,
	"weekly_hours" double precision,
	"sports" jsonb,
	"created_at" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "efforts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"block_id" uuid NOT NULL,
	"date" text NOT NULL,
	"distance_meters" double precision NOT NULL,
	"time_seconds" double precision NOT NULL,
	"kind" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescribed_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"block_id" uuid NOT NULL,
	"date" text NOT NULL,
	"type" text NOT NULL,
	"reps" integer,
	"target_pace_seconds_per_km" double precision,
	"target_rest_seconds" integer,
	"target_duration_seconds" integer,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"block_id" uuid NOT NULL,
	"session_id" uuid,
	"date" text NOT NULL,
	"actual_reps" integer,
	"actual_duration_seconds" integer,
	"actual_distance_meters" double precision,
	"recovery_score" integer,
	"sleep_hours" double precision,
	"temperature_c" double precision,
	"rpe" integer,
	"note" text,
	"cut_short_reason" text,
	"discipline" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strava_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"strava_athlete_id" bigint NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"scope" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "efforts" ADD CONSTRAINT "efforts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "efforts" ADD CONSTRAINT "efforts_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescribed_sessions" ADD CONSTRAINT "prescribed_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescribed_sessions" ADD CONSTRAINT "prescribed_sessions_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_session_id_prescribed_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."prescribed_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strava_accounts" ADD CONSTRAINT "strava_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocks_user_status_idx" ON "blocks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "efforts_block_date_idx" ON "efforts" USING btree ("block_id","date");--> statement-breakpoint
CREATE INDEX "prescribed_sessions_block_date_idx" ON "prescribed_sessions" USING btree ("block_id","date");--> statement-breakpoint
CREATE INDEX "session_logs_block_date_idx" ON "session_logs" USING btree ("block_id","date");