import Dexie, { type Table } from 'dexie';
import type { Discipline, Level } from '../lib/disciplines';

export type GoalType = 'time' | 'finish' | 'consistency';
export type OtherTraining = 'lifting' | 'sport' | 'classes' | 'none';
export type SessionType =
  | 'easy' | 'long_run' | 'tempo' | 'threshold' | 'vo2max'
  | 'reps_short' | 'reps_800' | 'fartlek' | 'hills' | 'strides'
  | 'time_trial' | 'cross_training' | 'rest';
export type CutShortReason = 'heat' | 'fatigue' | 'pain' | 'time' | 'life';
export type EffortKind = 'baseline' | 'checkpoint' | 'race';
export type BaselineSource = 'known' | 'estimate' | 'unknown';
export type BlockStatus = 'active' | 'archived';

export interface Athlete {
  id: 1;
  daysPerWeek: number;
  otherTraining: OtherTraining[];
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
  reps: number | null;
  targetPaceSecondsPerKm: number | null;
  targetRestSeconds: number | null;
  targetDurationSeconds: number | null;
  note: string | null;
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
  }
}

export const db = new FitnessHMDatabase();
