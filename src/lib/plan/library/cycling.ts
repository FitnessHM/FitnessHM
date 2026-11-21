import type { IntervalStep, SessionType } from '../../../db/schema';
import type { DisciplineProfile } from './types';

function bikeSteps(type: SessionType, durationSeconds: number): IntervalStep[] | null {
  if (type !== 'bike_vo2_intervals') return null;
  const reps = Math.max(4, Math.min(8, Math.round(durationSeconds / 300)));
  return [{ reps, workMeters: null, workSeconds: 180, restSeconds: 180 }];
}

// No power meter or cycling time trial feeds a pace/power model in this app
// (see spec's Non-goals) -- every slot carries a descriptive zone label
// plus the universal RPE/duration fallback, never a fabricated number.
export const CYCLING_PROFILE: DisciplineProfile = {
  discipline: 'cycling',
  unitDistanceMeters: null,
  types: {
    long: 'bike_long_ride',
    moderate: 'bike_sweet_spot_threshold',
    hard: 'bike_vo2_intervals',
    easy: ['bike_endurance', 'bike_endurance', 'bike_recovery_spin'],
  },
  zoneLabels: {
    long: 'Zone 2 (endurance)',
    easy: 'Zone 1-2 (easy)',
    moderate: 'Sweet spot / threshold',
    hard: 'Zone 5 (VO2max)',
  },
  notes: {
    long: "This week's longest ride -- steady Zone 2, building your aerobic engine.",
    moderate: 'Sweet spot work -- hard enough to raise threshold, repeatable week to week.',
    hard: 'Short, high-end intervals -- the one or two efforts a week that really move fitness.',
    easy: 'Easy riding (or a recovery spin) -- most of every good week should feel like this.',
  },
  buildSteps: bikeSteps,
};
