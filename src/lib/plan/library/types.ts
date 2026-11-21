import type { Discipline } from '../../disciplines';
import type { SessionType, Intensity, IntervalStep } from '../../../db/schema';
import type { TrainingZones } from '../../paceMath';
import type { WeekPlan } from '../phases';

export type SlotKind = 'long' | 'hard' | 'moderate' | 'easy';

// What a discipline library module hands back -- everything generate.ts
// needs to merge with id/blockId/date/source/edited to get a full
// PrescribedSessionDraft.
export interface SessionContent {
  type: SessionType;
  intensity: Intensity;
  reps: number | null;
  steps: IntervalStep[] | null;
  targetPaceSecondsPerKm: number | null;
  targetPaceSecondsPer100m: number | null;
  targetSplitSecondsPer500m: number | null;
  targetZoneLabel: string | null;
  targetRpeMin: number;
  targetRpeMax: number;
  targetRestSeconds: number | null;
  targetDurationSeconds: number;
  targetDistanceMeters: number | null;
  note: string;
}

export interface BuildSessionParams {
  slot: SlotKind;
  weekPlan: WeekPlan;
  // Precomputed via trainingZonesFromBaseline(dist, time, profile.unitDistanceMeters)
  // by generate.ts, once per discipline per baseline -- null until a
  // checkpoint/time-trial effort exists for this discipline.
  baselineZones: TrainingZones | null;
  durationSeconds: number;
  // A rotating counter (how many sessions of this exact slot this
  // discipline has produced so far in the plan) -- picks among same-
  // intensity type options (e.g. running's hard types) for variety.
  variety: number;
}

// One discipline's fixed session-type vocabulary and how to target it.
// `hard: null` means this discipline's given library has no dedicated
// hard-intensity type (swimming, walking) -- generate.ts downgrades a
// "hard" slot to "moderate" for these rather than inventing a type the
// spec's library table didn't list.
export interface DisciplineProfile {
  discipline: Discipline;
  // null for cycling -- it has no pace baseline in this app (see spec's
  // Non-goals), so it always uses `targetZoneLabel` instead of a numeric
  // per-unit pace.
  unitDistanceMeters: number | null;
  types: {
    long: SessionType;
    moderate: SessionType | SessionType[] | null;
    hard: SessionType | SessionType[] | null;
    easy: SessionType | SessionType[];
  };
  // Only required for a cycling-like profile (unitDistanceMeters: null).
  zoneLabels?: { easy: string; moderate: string; hard: string; long: string };
  notes: Record<SlotKind, string>;
  // Only set for slots that should carry structured reps x work + rest
  // (running's rep-based hard types, cycling/rowing intervals).
  buildSteps?: (type: SessionType, durationSeconds: number) => IntervalStep[] | null;
}
