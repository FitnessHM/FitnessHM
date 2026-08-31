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
  rep: { minSecondsPerKm: number; maxSecondsPerKm: number };
  vo2: { minSecondsPerKm: number; maxSecondsPerKm: number };
  threshold: { minSecondsPerKm: number; maxSecondsPerKm: number };
  tempo: { minSecondsPerKm: number; maxSecondsPerKm: number };
  easy: { minSecondsPerKm: number; maxSecondsPerKm: number };
}

// [fasterPct, slowerPct] of threshold pace. Threshold = ~1hr race pace.
const ZONE_PACE_PERCENT: Record<keyof TrainingZones, [number, number]> = {
  rep: [0.83, 0.89],
  vo2: [0.9, 0.97],
  threshold: [1.0, 1.03],
  tempo: [1.04, 1.07],
  easy: [1.16, 1.29],
};

export function trainingZonesFromBaseline(
  baselineDistanceMeters: number,
  baselineTimeSeconds: number
): TrainingZones {
  const thresholdPace = paceSecondsPerKm(baselineDistanceMeters, baselineTimeSeconds);
  const zones = {} as TrainingZones;
  (Object.keys(ZONE_PACE_PERCENT) as (keyof TrainingZones)[]).forEach((zone) => {
    const [fasterPct, slowerPct] = ZONE_PACE_PERCENT[zone];
    zones[zone] = {
      minSecondsPerKm: thresholdPace * fasterPct,
      maxSecondsPerKm: thresholdPace * slowerPct,
    };
  });
  return zones;
}
