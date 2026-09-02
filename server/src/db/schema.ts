import {
  bigint,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Postgres mirror of the client's Dexie model (src/db/schema.ts in the app).
// Rules of this schema:
//  - Every table carries `user_id` (not just `blocks`) so every query filters
//    cheaply and a stray foreign key can't leak rows across accounts.
//  - Fields the client treats as opaque strings (ISO dates, `created_at`,
//    effort `date`, ...) stay `text` to match the app exactly and avoid
//    timezone drift.
//  - `updated_at` is server-managed on every table now, so the planned move
//    from whole-payload last-write-wins to per-entity sync needs no migration.
//  - Strava tokens are stored encrypted (AES-256-GCM); columns are suffixed
//    `_encrypted` and never hold plaintext.

const updatedAt = timestamp('updated_at', { withTimezone: true })
  .notNull()
  .default(sql`now()`);

export const users = pgTable('users', {
  // Clerk user id (e.g. "user_2ab..."). Not a uuid.
  id: text('id').primaryKey(),
  // Stored lowercased by the app before write (no citext extension yet).
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt,
});

export const athletes = pgTable('athletes', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  daysPerWeek: integer('days_per_week').notNull(),
  otherTraining: jsonb('other_training').notNull().default(sql`'[]'::jsonb`),
  updatedAt,
});

export const blocks = pgTable(
  'blocks',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventDistanceMeters: doublePrecision('event_distance_meters').notNull(),
    eventLabel: text('event_label').notNull(),
    goalType: text('goal_type').notNull(),
    goalTimeSeconds: integer('goal_time_seconds'),
    targetDate: text('target_date').notNull(),
    baselineSource: text('baseline_source').notNull(),
    raceMantra: text('race_mantra'),
    targetSplitSecondsPerKm: doublePrecision('target_split_seconds_per_km'),
    status: text('status').notNull(),
    discipline: text('discipline'),
    level: text('level'),
    disciplines: jsonb('disciplines'),
    disciplineLevels: jsonb('discipline_levels'),
    weeklyHours: doublePrecision('weekly_hours'),
    sports: jsonb('sports'),
    createdAt: text('created_at').notNull(),
    updatedAt,
  },
  (t) => [index('blocks_user_status_idx').on(t.userId, t.status)],
);

export const efforts = pgTable(
  'efforts',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockId: uuid('block_id')
      .notNull()
      .references(() => blocks.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    distanceMeters: doublePrecision('distance_meters').notNull(),
    timeSeconds: doublePrecision('time_seconds').notNull(),
    kind: text('kind').notNull(),
    updatedAt,
  },
  (t) => [index('efforts_block_date_idx').on(t.blockId, t.date)],
);

export const prescribedSessions = pgTable(
  'prescribed_sessions',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockId: uuid('block_id')
      .notNull()
      .references(() => blocks.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    type: text('type').notNull(),
    reps: integer('reps'),
    targetPaceSecondsPerKm: doublePrecision('target_pace_seconds_per_km'),
    targetRestSeconds: integer('target_rest_seconds'),
    targetDurationSeconds: integer('target_duration_seconds'),
    note: text('note'),
    updatedAt,
  },
  (t) => [index('prescribed_sessions_block_date_idx').on(t.blockId, t.date)],
);

export const sessionLogs = pgTable(
  'session_logs',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockId: uuid('block_id')
      .notNull()
      .references(() => blocks.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => prescribedSessions.id, {
      onDelete: 'set null',
    }),
    date: text('date').notNull(),
    actualReps: integer('actual_reps'),
    actualDurationSeconds: integer('actual_duration_seconds'),
    actualDistanceMeters: doublePrecision('actual_distance_meters'),
    recoveryScore: integer('recovery_score'),
    sleepHours: doublePrecision('sleep_hours'),
    temperatureC: doublePrecision('temperature_c'),
    rpe: integer('rpe'),
    note: text('note'),
    cutShortReason: text('cut_short_reason'),
    discipline: text('discipline'),
    updatedAt,
  },
  (t) => [index('session_logs_block_date_idx').on(t.blockId, t.date)],
);

export const stravaAccounts = pgTable('strava_accounts', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  stravaAthleteId: bigint('strava_athlete_id', { mode: 'number' }).notNull(),
  // AES-256-GCM ciphertext, base64. Never plaintext.
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  scope: text('scope'),
  updatedAt,
});
