ALTER TABLE "athletes" ADD COLUMN "training_weekdays" jsonb;--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "other_training_weekdays" jsonb;--> statement-breakpoint
ALTER TABLE "athletes" ADD COLUMN "unit_system" text DEFAULT 'metric' NOT NULL;--> statement-breakpoint
ALTER TABLE "prescribed_sessions" ADD COLUMN "discipline" text;--> statement-breakpoint
ALTER TABLE "prescribed_sessions" ADD COLUMN "intensity" text;--> statement-breakpoint
ALTER TABLE "prescribed_sessions" ADD COLUMN "steps" jsonb;--> statement-breakpoint
ALTER TABLE "prescribed_sessions" ADD COLUMN "target_pace_seconds_per_100m" double precision;--> statement-breakpoint
ALTER TABLE "prescribed_sessions" ADD COLUMN "target_split_seconds_per_500m" double precision;--> statement-breakpoint
ALTER TABLE "prescribed_sessions" ADD COLUMN "target_zone_label" text;--> statement-breakpoint
ALTER TABLE "prescribed_sessions" ADD COLUMN "target_rpe_min" integer;--> statement-breakpoint
ALTER TABLE "prescribed_sessions" ADD COLUMN "target_rpe_max" integer;--> statement-breakpoint
ALTER TABLE "prescribed_sessions" ADD COLUMN "target_distance_meters" double precision;--> statement-breakpoint
ALTER TABLE "prescribed_sessions" ADD COLUMN "source" text DEFAULT 'generated' NOT NULL;--> statement-breakpoint
ALTER TABLE "prescribed_sessions" ADD COLUMN "edited" boolean DEFAULT false NOT NULL;