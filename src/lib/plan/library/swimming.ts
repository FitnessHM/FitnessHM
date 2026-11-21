import type { DisciplineProfile } from './types';

// The given library (technique/drill, aerobic sets, threshold/CSS sets,
// continuous swim) has no dedicated hard-intensity type -- threshold/CSS is
// already the toughest regular session. A "hard" slot downgrades to
// "moderate" (swim_threshold_css) rather than inventing a type the spec's
// library table didn't list; see common.ts and DisciplineProfile's comment.
export const SWIMMING_PROFILE: DisciplineProfile = {
  discipline: 'swimming',
  unitDistanceMeters: 100,
  types: {
    long: 'swim_continuous',
    moderate: 'swim_threshold_css',
    hard: null,
    easy: ['swim_aerobic_sets', 'swim_aerobic_sets', 'swim_technique_drill'],
  },
  notes: {
    long: "This week's longest continuous swim -- steady aerobic work.",
    moderate: 'Threshold/CSS sets -- your toughest regular swim session.',
    hard: 'Unused -- swimming has no harder tier than threshold/CSS in this library.',
    easy: 'Aerobic sets and technique work -- most of every good week should feel like this.',
  },
};
