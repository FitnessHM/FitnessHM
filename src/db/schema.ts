import Dexie, { type Table } from 'dexie';

export type GoalType = 'time' | 'finish' | 'consistency';
export type OtherTraining = 'lifting' | 'sport' | 'classes' | 'none';
export type SessionType =
  | 'easy' | 'long_run' | 'tempo' | 'threshold' | 'vo2max'
  | 'reps_short' | 'reps_800' | 'fartlek' | 'hills' | 'strides'
  | 'time_trial' | 'cross_training' | 'rest';
export type CutShortReason = 'heat' | 'fatigue' | 'pain' | 'time' | 'life';
export type EffortKind = 'baseline' | 'checkpoint' | 'race';
export type BaselineSource = 'known' | 'estimate' | 'unknown';

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
  createdAt: string;
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
}

export class FitnessHMDatabase extends Dexie {
  athlete!: Table<Athlete, number>;
  blocks!: Table<TrainingBlock, string>;
  efforts!: Table<TimedEffort, string>;
  sessions!: Table<PrescribedSession, string>;
  logs!: Table<SessionLog, string>;

  constructor() {
    super('fitnesshm');
    this.version(1).stores({
      athlete: 'id',
      blocks: 'id, targetDate, createdAt',
      efforts: 'id, blockId, date, [blockId+date]',
      sessions: 'id, blockId, date, [blockId+date]',
      logs: 'id, blockId, sessionId, date, [blockId+date]',
    });
  }
}

export const db = new FitnessHMDatabase();
