import type { SessionType, Intensity } from '../../db/schema';

// Canonical intensity for every session type. Used both as the generator's
// own choice when building a session and as the read-time fallback for
// pre-phase-2 rows with no `intensity` field (sessionIntensity below). See
// docs/superpowers/specs/2026-11-21-phase2-plans-design.md's "Per-discipline
// session libraries" table -- this is that table, in code.
export const SESSION_INTENSITY: Record<SessionType, Intensity> = {
  easy: 'easy',
  long_run: 'easy',
  tempo: 'moderate',
  threshold: 'moderate',
  vo2max: 'hard',
  reps_short: 'hard',
  reps_800: 'hard',
  fartlek: 'hard',
  hills: 'hard',
  strides: 'easy',
  time_trial: 'hard',
  cross_training: 'easy',
  rest: 'easy',
  bike_endurance: 'easy',
  bike_sweet_spot_threshold: 'moderate',
  bike_vo2_intervals: 'hard',
  bike_long_ride: 'easy',
  bike_recovery_spin: 'easy',
  bike_time_trial: 'hard',
  swim_technique_drill: 'easy',
  swim_aerobic_sets: 'easy',
  swim_threshold_css: 'moderate',
  swim_continuous: 'easy',
  swim_time_trial: 'hard',
  row_steady_state: 'easy',
  row_threshold_pieces: 'moderate',
  row_intervals: 'hard',
  row_time_trial: 'hard',
  walk_brisk: 'easy',
  walk_long: 'easy',
  walk_hills: 'moderate',
};

export function sessionIntensity(session: { type: SessionType; intensity?: Intensity | null }): Intensity {
  return session.intensity ?? SESSION_INTENSITY[session.type];
}

// The discipline-specific checkpoint/test session type -- what the matching
// and checkpoint-retarget logic (phase 5) looks for. Walking has none: it
// never collects a baseline today.
export const CHECKPOINT_TYPES: SessionType[] = ['time_trial', 'bike_time_trial', 'swim_time_trial', 'row_time_trial'];

export function isCheckpointType(type: SessionType): boolean {
  return CHECKPOINT_TYPES.includes(type);
}

// 'rest'/'cross_training' are excluded from every hard/moderate/easy count
// -- they're not part of the 80/20 or hard-session-cap accounting.
export function countsTowardIntensityBudget(type: SessionType): boolean {
  return type !== 'rest' && type !== 'cross_training';
}
