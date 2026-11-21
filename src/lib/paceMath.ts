export function paceSecondsPerKm(distanceMeters: number, timeSeconds: number): number {
  return timeSeconds / (distanceMeters / 1000);
}

export interface Splits {
  secondsPerKm: number;
  secondsPerMile: number;
  secondsPerLap400m: number;
}

export function splitsFromGoal(distanceMeters: number, goalTimeSeconds: number): Splits {
  const perKm = paceSecondsPerKm(distanceMeters, goalTimeSeconds);
  return {
    secondsPerKm: perKm,
    secondsPerMile: perKm * 1.60934,
    secondsPerLap400m: perKm * 0.4,
  };
}

export function riegelEquivalent(
  knownDistanceMeters: number,
  knownTimeSeconds: number,
  targetDistanceMeters: number,
  exponent = 1.06
): number {
  return knownTimeSeconds * Math.pow(targetDistanceMeters / knownDistanceMeters, exponent);
}

export interface TrainingZones {
  rep: { minSecondsPerUnit: number; maxSecondsPerUnit: number };
  vo2: { minSecondsPerUnit: number; maxSecondsPerUnit: number };
  threshold: { minSecondsPerUnit: number; maxSecondsPerUnit: number };
  tempo: { minSecondsPerUnit: number; maxSecondsPerUnit: number };
  easy: { minSecondsPerUnit: number; maxSecondsPerUnit: number };
}

// [fasterPct, slowerPct] of threshold pace. Threshold = ~1hr race pace.
const ZONE_PACE_PERCENT: Record<keyof TrainingZones, [number, number]> = {
  rep: [0.83, 0.89],
  vo2: [0.9, 0.97],
  threshold: [1.0, 1.03],
  tempo: [1.04, 1.07],
  easy: [1.16, 1.29],
};

// `unitDistanceMeters` is the "per" in the returned pace -- 1000 (per km,
// the default) for running/walking, 100 for swimming, 500 for rowing. The
// percent-of-threshold-pace table above is discipline-agnostic (it's a
// ratio, not an absolute pace) -- only the denominator changes. Existing
// running callers passing no third argument are unaffected.
export function trainingZonesFromBaseline(
  baselineDistanceMeters: number,
  baselineTimeSeconds: number,
  unitDistanceMeters = 1000
): TrainingZones {
  const thresholdPace = baselineTimeSeconds / (baselineDistanceMeters / unitDistanceMeters);
  const zones = {} as TrainingZones;
  (Object.keys(ZONE_PACE_PERCENT) as (keyof TrainingZones)[]).forEach((zone) => {
    const [fasterPct, slowerPct] = ZONE_PACE_PERCENT[zone];
    zones[zone] = {
      minSecondsPerUnit: thresholdPace * fasterPct,
      maxSecondsPerUnit: thresholdPace * slowerPct,
    };
  });
  return zones;
}

// Picks the strongest effort by Riegel-normalizing every effort to
// targetDistanceMeters first — a slower-looking raw time at a longer
// distance can be the genuinely better result once normalized, and a
// same-distance comparison should always favor the faster time regardless
// of which was logged more recently.
export function bestEquivalentEffort<T extends { distanceMeters: number; timeSeconds: number }>(
  efforts: T[],
  targetDistanceMeters: number
): T | null {
  if (efforts.length === 0) return null;
  let best = efforts[0];
  let bestEquivalentSeconds = riegelEquivalent(best.distanceMeters, best.timeSeconds, targetDistanceMeters);
  for (let i = 1; i < efforts.length; i++) {
    const equivalentSeconds = riegelEquivalent(efforts[i].distanceMeters, efforts[i].timeSeconds, targetDistanceMeters);
    if (equivalentSeconds < bestEquivalentSeconds) {
      best = efforts[i];
      bestEquivalentSeconds = equivalentSeconds;
    }
  }
  return best;
}
