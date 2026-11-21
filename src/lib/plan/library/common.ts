import type { Intensity, SessionType } from '../../../db/schema';
import type { TrainingZones } from '../../paceMath';
import type { BuildSessionParams, DisciplineProfile, SessionContent, SlotKind } from './types';

const SLOT_INTENSITY: Record<SlotKind, Intensity> = { long: 'easy', moderate: 'moderate', hard: 'hard', easy: 'easy' };

// 1-10 RPE fallback range, always set regardless of whether a numeric
// target exists -- the spec's "always include duration and an RPE
// fallback." Ballpark convention, not measured.
const RPE_RANGE: Record<Intensity, [number, number]> = {
  easy: [2, 4],
  moderate: [5, 6],
  hard: [7, 9],
};

// Which baseline zone a slot's pace target is drawn from.
const SLOT_ZONE: Record<SlotKind, keyof TrainingZones> = {
  long: 'easy',
  easy: 'easy',
  moderate: 'tempo',
  hard: 'vo2',
};

function pickType(option: SessionType | SessionType[] | null, variety: number): SessionType | null {
  if (option === null) return null;
  return Array.isArray(option) ? option[variety % option.length] : option;
}

/**
 * Generic session builder shared by every discipline profile. A "hard" slot
 * on a discipline with no hard-tier type (profile.types.hard === null) is
 * downgraded to "moderate" (and "moderate" with none to "easy") -- see
 * DisciplineProfile's doc comment.
 */
export function buildSessionFromProfile(profile: DisciplineProfile, p: BuildSessionParams): SessionContent {
  let slot = p.slot;
  if (slot === 'hard' && profile.types.hard === null) slot = 'moderate';
  if (slot === 'moderate' && profile.types.moderate === null) slot = 'easy';

  const type = pickType(profile.types[slot], p.variety) ?? pickType(profile.types.easy, p.variety)!;
  const intensity = SLOT_INTENSITY[slot];
  const [rpeMin, rpeMax] = RPE_RANGE[intensity];

  const zone = p.baselineZones?.[SLOT_ZONE[slot]] ?? null;
  const paceSecondsPerUnit = zone ? (zone.minSecondsPerUnit + zone.maxSecondsPerUnit) / 2 : null;

  let targetPaceSecondsPerKm: number | null = null;
  let targetPaceSecondsPer100m: number | null = null;
  let targetSplitSecondsPer500m: number | null = null;
  let targetDistanceMeters: number | null = null;

  if (paceSecondsPerUnit !== null && profile.unitDistanceMeters !== null) {
    targetDistanceMeters = Math.round((p.durationSeconds / paceSecondsPerUnit) * profile.unitDistanceMeters);
    if (profile.unitDistanceMeters === 1000) targetPaceSecondsPerKm = paceSecondsPerUnit;
    else if (profile.unitDistanceMeters === 100) targetPaceSecondsPer100m = paceSecondsPerUnit;
    else if (profile.unitDistanceMeters === 500) targetSplitSecondsPer500m = paceSecondsPerUnit;
  }

  const targetZoneLabel = profile.unitDistanceMeters === null ? profile.zoneLabels?.[slot] ?? null : null;

  const steps = slot === 'hard' && profile.buildSteps ? profile.buildSteps(type, p.durationSeconds) : null;

  return {
    type,
    intensity,
    reps: steps ? steps[0]?.reps ?? null : null,
    steps,
    targetPaceSecondsPerKm,
    targetPaceSecondsPer100m,
    targetSplitSecondsPer500m,
    targetZoneLabel,
    targetRpeMin: rpeMin,
    targetRpeMax: rpeMax,
    targetRestSeconds: steps ? steps[0]?.restSeconds ?? null : null,
    targetDurationSeconds: Math.round(p.durationSeconds),
    targetDistanceMeters,
    note: profile.notes[slot],
  };
}
