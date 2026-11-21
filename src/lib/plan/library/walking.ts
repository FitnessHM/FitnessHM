import type { DisciplineProfile } from './types';

// The given library (brisk, long, hills) has no hard-intensity type at all
// -- walking is inherently low-impact. A "hard" slot downgrades to
// "moderate" (walk_hills); see common.ts and DisciplineProfile's comment.
// Walking also never collects a baseline in this app (no event/time-trial
// path), so its pace target stays null until that changes -- duration + RPE
// only, same as any no-baseline discipline.
export const WALKING_PROFILE: DisciplineProfile = {
  discipline: 'walking',
  unitDistanceMeters: 1000,
  types: {
    long: 'walk_long',
    moderate: 'walk_hills',
    hard: null,
    easy: 'walk_brisk',
  },
  notes: {
    long: "This week's longest walk -- time on feet, building your base.",
    moderate: 'Hills add real effort without any impact risk.',
    hard: 'Unused -- walking has no harder tier than hills in this library.',
    easy: 'A brisk walk -- most of every good week should feel like this.',
  },
};
