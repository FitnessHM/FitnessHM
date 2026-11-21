import Dexie, { type Table } from 'dexie';
import type { Discipline, Level } from '../lib/disciplines';

export type GoalType = 'time' | 'finish' | 'consistency';
export type OtherTraining = 'lifting' | 'sport' | 'classes' | 'none';
// Running types, unchanged, plus one block per other cardio discipline (see
// docs/superpowers/specs/2026-11-21-phase2-plans-design.md's "Per-discipline
// session libraries" -- names are literal matches to that table, nothing
// invented beyond what's listed there). `rest`/`cross_training` are shared
// across every discipline.
export type SessionType =
  | 'easy' | 'long_run' | 'tempo' | 'threshold' | 'vo2max'
  | 'reps_short' | 'reps_800' | 'fartlek' | 'hills' | 'strides'
  | 'time_trial' | 'cross_training' | 'rest'
  | 'bike_endurance' | 'bike_sweet_spot_threshold' | 'bike_vo2_intervals'
  | 'bike_long_ride' | 'bike_recovery_spin' | 'bike_time_trial'
  | 'swim_technique_drill' | 'swim_aerobic_sets' | 'swim_threshold_css'
  | 'swim_continuous' | 'swim_time_trial'
  | 'row_steady_state' | 'row_threshold_pieces' | 'row_intervals' | 'row_time_trial'
  | 'walk_brisk' | 'walk_long' | 'walk_hills';
export type CutShortReason = 'heat' | 'fatigue' | 'pain' | 'time' | 'life';
export type EffortKind = 'baseline' | 'checkpoint' | 'race';
export type BaselineSource = 'known' | 'estimate' | 'unknown';
export type BlockStatus = 'active' | 'archived';
// Drives the 80/20-style volume rules and the hard-session-per-week caps.
// 'rest'/'cross_training' sessions are excluded from every count that reads
// this field, regardless of what it's set to.
export type Intensity = 'easy' | 'moderate' | 'hard';
// 'user' only when a human created the session from nothing via "add a
// session" (Plan screen, phase 4+) -- a generated session a human then
// edits stays 'generated' with `edited: true`.
export type SessionSource = 'generated' | 'user';
// Date#getDay() convention: 0 = Sunday .. 6 = Saturday.
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type UnitSystem = 'metric' | 'imperial';

// reps x work + rest. One uniform block per session -- no pyramids or
// mixed-rep-distance sets in this phase (see spec's Non-goals).
export interface IntervalStep {
  reps: number;
  workSeconds: number | null;  // exactly one of workSeconds/workMeters is set
  workMeters: number | null;
  restSeconds: number;
}

export interface Athlete {
  id: 1;
  // Kept for back-compat; derived as `trainingWeekdays.length` going
  // forward rather than collected as its own number.
  daysPerWeek: number;
  otherTraining: OtherTraining[];
  // Specific weekdays available for cardio training. Undefined/null on
  // athletes who onboarded before this phase -- the generator falls back to
  // `defaultTrainingWeekdays(daysPerWeek)` (src/lib/plan/weekdays.ts) until
  // they revisit onboarding.
  trainingWeekdays?: Weekday[] | null;
  // Weekdays already spoken for by lifting/sport. The scheduler never
  // places a *hard* cardio session on one of these -- it may still place an
  // easy one, since a day can be both a training day and an "other
  // training" day. Undefined/null = none known.
  otherTrainingWeekdays?: Weekday[] | null;
  // Display/entry only -- storage is always meters. Defaults to 'metric' at
  // every read site that predates this field (`athlete.unitSystem ??
  // 'metric'`), not backfilled in place.
  unitSystem?: UnitSystem;
}

export interface TrainingBlock {
  id: string;
  eventDistanceMeters: number;
  eventLabel: string;
  goalType: GoalType;
  goalTimeSeconds: number | null;
  targetDate: string;
  baselineSource: BaselineSource;
  raceMantra: string | null;
  targetSplitSecondsPerKm: number | null;
  status: BlockStatus;
  createdAt: string;
  // Cardio discipline this block's event belongs to. Optional: blocks saved
  // before disciplines existed have none -- read them as Running (see
  // lib/disciplines.disciplineConfig).
  discipline?: Discipline;
  // Level for `discipline`. For a "Mix" block, every chosen discipline's
  // level also lives in `disciplineLevels`.
  level?: Level | null;
  // Every discipline the athlete wants trained (one entry for a single-choice
  // block, several for a "Mix" block).
  disciplines?: Discipline[];
  disciplineLevels?: Partial<Record<Discipline, Level>>;
  // Hours per week, set instead of a time goal when the event is "General
  // fitness" or the discipline is not a race sport (Lifting, Sports).
  weeklyHours?: number | null;
  // The specific sports chosen when `discipline` is 'sports'.
  sports?: string[] | null;
}

export interface TimedEffort {
  id: string;
  blockId: string;
  date: string;
  distanceMeters: number;
  timeSeconds: number;
  kind: EffortKind;
}

export interface PrescribedSession {
  id: string;
  blockId: string;
  date: string;
  type: SessionType;
  // Which cardio discipline this session belongs to. Undefined on
  // pre-phase-2 rows -- read as `discipline ?? block.discipline ?? 'running'`
  // (same fallback pattern as TrainingBlock.discipline).
  discipline?: Discipline;
  // Undefined on pre-phase-2 rows -- read through SESSION_INTENSITY[type]
  // (src/lib/plan/intensity.ts) rather than defaulted blindly, so old rows
  // get a correct value instead of a guess.
  intensity?: Intensity;
  reps: number | null;               // simple rep count (e.g. strides); ignored when `steps` is set
  steps?: IntervalStep[] | null;      // structured reps x work + rest; null/undefined for continuous/steady sessions
  targetPaceSecondsPerKm: number | null;       // running & walking
  targetPaceSecondsPer100m?: number | null;    // swimming
  targetSplitSecondsPer500m?: number | null;   // rowing
  targetZoneLabel?: string | null;             // cycling ("Zone 2", "Sweet spot", "VO2max"), and anyone else with no numeric target
  targetRpeMin?: number | null;                // universal fallback, always set on a freshly-generated session
  targetRpeMax?: number | null;
  targetRestSeconds: number | null;  // rest between reps when `steps` is unset
  targetDurationSeconds: number | null;  // always set; the universal fallback alongside RPE
  targetDistanceMeters?: number | null;   // total session distance target, meters always
  note: string | null;
  // Undefined is read as 'generated' -- an old row behaves exactly like a
  // fresh generated one, which is correct: it was never user-edited.
  source?: SessionSource;
  // Once true, "Update plan" (phase 4+) never touches this session's
  // content or deletes it for being regenerated.
  edited?: boolean;
}

export interface SessionLog {
  id: string;
  sessionId: string | null;
  blockId: string;
  date: string;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: number | null;
  recoveryScore: number | null;
  sleepHours: number | null;
  temperatureC: number | null;
  rpe: number | null;
  note: string | null;
  cutShortReason: CutShortReason | null;
  // Which discipline this session was. Optional: unset on logs saved before
  // multi-discipline support, and on single-discipline blocks it just mirrors
  // the block's discipline.
  discipline?: Discipline | null;
  // Set when this log came from a synced Strava activity (backfill or
  // webhook), never set by the app itself. Lets the UI mark it as
  // Strava-sourced without a separate lookup.
  stravaActivityId?: number | null;
}

// Singleton row tracking when local data last changed. Bumped by every
// repository.ts mutator; watched by db/sync.ts to trigger a debounced push.
// Deliberately not on individual rows (see the sync plan) — step 3 syncs
// the whole payload at once, keyed by this one timestamp.
export interface SyncMeta {
  id: 1;
  lastModifiedAt: string;
}

export class FitnessHMDatabase extends Dexie {
  athlete!: Table<Athlete, number>;
  blocks!: Table<TrainingBlock, string>;
  efforts!: Table<TimedEffort, string>;
  sessions!: Table<PrescribedSession, string>;
  logs!: Table<SessionLog, string>;
  meta!: Table<SyncMeta, number>;

  constructor() {
    super('fitnesshm');
    this.version(1).stores({
      athlete: 'id',
      blocks: 'id, targetDate, createdAt',
      efforts: 'id, blockId, date, [blockId+date]',
      sessions: 'id, blockId, date, [blockId+date]',
      logs: 'id, blockId, sessionId, date, [blockId+date]',
    });
    // v2 adds `status` to blocks so exactly one block can be "active" at a
    // time (start-a-new-block archives the previous one instead of leaving
    // it live forever). Existing installs get every block marked active on
    // upgrade — matches pre-v2 behavior, where the newest block was implicitly
    // "the" block.
    this.version(2).stores({
      athlete: 'id',
      blocks: 'id, targetDate, createdAt, status',
      efforts: 'id, blockId, date, [blockId+date]',
      sessions: 'id, blockId, date, [blockId+date]',
      logs: 'id, blockId, sessionId, date, [blockId+date]',
    }).upgrade((tx) =>
      tx.table('blocks').toCollection().modify((block) => {
        block.status = 'active';
      })
    );
    // v3 adds the sync-meta table (step 3: server sync).
    this.version(3).stores({
      athlete: 'id',
      blocks: 'id, targetDate, createdAt, status',
      efforts: 'id, blockId, date, [blockId+date]',
      sessions: 'id, blockId, date, [blockId+date]',
      logs: 'id, blockId, sessionId, date, [blockId+date]',
      meta: 'id',
    }).upgrade((tx) =>
      tx.table('meta').put({ id: 1, lastModifiedAt: new Date().toISOString() })
    );
    // v4 (phase 2: plan generator) adds fields to `athlete` and `sessions`
    // for multi-discipline plans -- see schema.ts's Athlete/PrescribedSession
    // comments. None of them are indexed, and every one is optional/
    // undefined-safe at every read site, so there's no store-shape change
    // and no `.upgrade()` transform: existing rows are read correctly by
    // the fallbacks already documented on each field. The version bump
    // exists purely as an explicit marker, parallel to the server's own
    // drizzle migration for the same fields.
    this.version(4).stores({
      athlete: 'id',
      blocks: 'id, targetDate, createdAt, status',
      efforts: 'id, blockId, date, [blockId+date]',
      sessions: 'id, blockId, date, [blockId+date]',
      logs: 'id, blockId, sessionId, date, [blockId+date]',
      meta: 'id',
    });
  }
}

export const db = new FitnessHMDatabase();
