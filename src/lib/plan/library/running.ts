import type { IntervalStep, SessionType } from '../../../db/schema';
import type { DisciplineProfile } from './types';

function runningSteps(type: SessionType, durationSeconds: number): IntervalStep[] | null {
  switch (type) {
    case 'reps_800':
      return [{ reps: clamp(Math.round(durationSeconds / 400), 3, 8), workMeters: 800, workSeconds: null, restSeconds: 90 }];
    case 'reps_short':
      return [{ reps: clamp(Math.round(durationSeconds / 180), 4, 12), workMeters: 400, workSeconds: null, restSeconds: 90 }];
    case 'vo2max':
      return [{ reps: clamp(Math.round(durationSeconds / 300), 4, 8), workMeters: null, workSeconds: 180, restSeconds: 120 }];
    case 'hills':
      return [{ reps: clamp(Math.round(durationSeconds / 240), 5, 10), workMeters: null, workSeconds: 60, restSeconds: 120 }];
    default:
      return null; // fartlek: continuous, varied pace by feel -- no fixed rep structure
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export const RUNNING_PROFILE: DisciplineProfile = {
  discipline: 'running',
  unitDistanceMeters: 1000,
  types: {
    long: 'long_run',
    moderate: ['tempo', 'threshold'],
    hard: ['vo2max', 'reps_800', 'reps_short', 'hills', 'fartlek'],
    easy: ['easy', 'easy', 'easy', 'strides'],
  },
  notes: {
    long: "This week's longest run -- the time on feet that actually builds endurance.",
    moderate: 'Comfortably hard -- raises your threshold without digging into next week.',
    hard: 'Short, sharp, and capped -- the one or two efforts a week that really move fitness.',
    easy: 'Easy miles build your aerobic base -- most of every good week should feel like this.',
  },
  buildSteps: runningSteps,
};
