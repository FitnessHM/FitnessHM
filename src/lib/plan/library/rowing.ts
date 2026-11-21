import type { IntervalStep, SessionType } from '../../../db/schema';
import type { DisciplineProfile } from './types';

function rowSteps(type: SessionType, durationSeconds: number): IntervalStep[] | null {
  if (type !== 'row_intervals') return null;
  const reps = Math.max(4, Math.min(8, Math.round(durationSeconds / 300)));
  return [{ reps, workMeters: 500, workSeconds: null, restSeconds: 120 }];
}

// No dedicated "long" type in the given library (steady state, threshold
// pieces, intervals) -- the week's longest row reuses row_steady_state at a
// longer duration rather than inventing a type the spec's library table
// didn't list.
export const ROWING_PROFILE: DisciplineProfile = {
  discipline: 'rowing',
  unitDistanceMeters: 500,
  types: {
    long: 'row_steady_state',
    moderate: 'row_threshold_pieces',
    hard: 'row_intervals',
    easy: 'row_steady_state',
  },
  notes: {
    long: "This week's longest row -- steady state, building your aerobic base.",
    moderate: 'Threshold pieces -- comfortably hard, repeatable week to week.',
    hard: 'Short, high-end intervals -- the one or two efforts a week that really move fitness.',
    easy: 'Steady state rowing -- most of every good week should feel like this.',
  },
  buildSteps: rowSteps,
};
