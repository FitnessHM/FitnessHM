import { expect, test } from 'vitest';
import { paceSecondsPerKm, splitsFromGoal, riegelEquivalent, trainingZonesFromBaseline, bestEquivalentEffort } from './paceMath';

test('paceSecondsPerKm computes seconds per km', () => {
  expect(paceSecondsPerKm(5000, 1500)).toBeCloseTo(300); // 5:00/km for a 25:00 5K
});

test('splitsFromGoal derives km/mile/lap splits from a goal time', () => {
  const splits = splitsFromGoal(5000, 1500); // 25:00 5K -> 5:00/km
  expect(splits.secondsPerKm).toBeCloseTo(300);
  expect(splits.secondsPerMile).toBeCloseTo(482.8, 0);
  expect(splits.secondsPerLap400m).toBeCloseTo(120);
});

test('riegelEquivalent predicts a longer-distance time from a known result', () => {
  // 20:00 5K -> predicted 10K should be slower than double (fatigue factor)
  const predicted10k = riegelEquivalent(5000, 1200, 10000);
  expect(predicted10k).toBeGreaterThan(2400);
  expect(predicted10k).toBeLessThan(2600);
});

test('trainingZonesFromBaseline orders zones from fastest (rep) to slowest (easy)', () => {
  const zones = trainingZonesFromBaseline(5000, 1200); // 4:00/km threshold-ish baseline
  expect(zones.rep.minSecondsPerKm).toBeLessThan(zones.vo2.minSecondsPerKm);
  expect(zones.vo2.minSecondsPerKm).toBeLessThan(zones.threshold.minSecondsPerKm);
  expect(zones.threshold.minSecondsPerKm).toBeLessThan(zones.tempo.minSecondsPerKm);
  expect(zones.tempo.minSecondsPerKm).toBeLessThan(zones.easy.minSecondsPerKm);
  expect(zones.easy.minSecondsPerKm).toBeLessThan(zones.easy.maxSecondsPerKm);
});

test('bestEquivalentEffort returns null for an empty list', () => {
  expect(bestEquivalentEffort([], 5000)).toBeNull();
});

test('bestEquivalentEffort returns the only effort when there is exactly one', () => {
  const effort = { distanceMeters: 5000, timeSeconds: 1500 };
  expect(bestEquivalentEffort([effort], 5000)).toBe(effort);
});

test('bestEquivalentEffort picks the faster of two same-distance efforts regardless of order', () => {
  const faster = { distanceMeters: 5000, timeSeconds: 1500 }; // 25:00
  const slower = { distanceMeters: 5000, timeSeconds: 1600 }; // 26:40, logged later
  expect(bestEquivalentEffort([faster, slower], 5000)).toBe(faster);
  expect(bestEquivalentEffort([slower, faster], 5000)).toBe(faster);
});

test('bestEquivalentEffort normalizes across distances via Riegel instead of comparing raw seconds', () => {
  // A 5000m in 1500s (25:00) vs a 10000m in 2900s (48:20).
  // Raw seconds would wrongly favor the 5K (1500 < 2900), but the 10K's
  // Riegel-equivalent 5K time is ~1391s (~23:11) -- genuinely faster.
  const shortRace = { distanceMeters: 5000, timeSeconds: 1500 };
  const longRace = { distanceMeters: 10000, timeSeconds: 2900 };
  const best = bestEquivalentEffort([shortRace, longRace], 5000);
  expect(best).toBe(longRace);
  expect(riegelEquivalent(longRace.distanceMeters, longRace.timeSeconds, 5000)).toBeLessThan(shortRace.timeSeconds);
});
