import { expect, test } from 'vitest';
import { paceSecondsPerKm, splitsFromGoal, riegelEquivalent, trainingZonesFromBaseline } from './paceMath';

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
