import { expect, test } from 'vitest';
import { buildSessionFromProfile } from './common';
import { RUNNING_PROFILE } from './running';
import { CYCLING_PROFILE } from './cycling';
import { SWIMMING_PROFILE } from './swimming';
import { WALKING_PROFILE } from './walking';
import { ROWING_PROFILE } from './rowing';
import { trainingZonesFromBaseline } from '../../paceMath';
import type { WeekPlan } from '../phases';

const weekPlan: WeekPlan = { weekIndex: 3, startDate: '2026-02-01', phase: 'build', isDeload: false, volumeFactor: 1 };

test('every session always carries a duration and an RPE fallback, baseline or not', () => {
  const session = buildSessionFromProfile(RUNNING_PROFILE, {
    slot: 'easy', weekPlan, baselineZones: null, durationSeconds: 1800, variety: 0,
  });
  expect(session.targetDurationSeconds).toBe(1800);
  expect(session.targetRpeMin).toBeGreaterThan(0);
  expect(session.targetRpeMax).toBeGreaterThanOrEqual(session.targetRpeMin);
});

test('with no baseline, pace/split/distance targets stay null -- duration + RPE only', () => {
  const session = buildSessionFromProfile(RUNNING_PROFILE, {
    slot: 'long', weekPlan, baselineZones: null, durationSeconds: 2400, variety: 0,
  });
  expect(session.targetPaceSecondsPerKm).toBeNull();
  expect(session.targetDistanceMeters).toBeNull();
  expect(session.note).toBeTruthy();
});

test('once a baseline exists, running fills in a real pace and a derived distance', () => {
  const zones = trainingZonesFromBaseline(5000, 1200, 1000); // 4:00/km threshold-ish
  const session = buildSessionFromProfile(RUNNING_PROFILE, {
    slot: 'easy', weekPlan, baselineZones: zones, durationSeconds: 1800, variety: 0,
  });
  expect(session.targetPaceSecondsPerKm).not.toBeNull();
  expect(session.targetDistanceMeters).toBeGreaterThan(0);
});

test('swimming targets pace per 100m, not per km', () => {
  const zones = trainingZonesFromBaseline(1500, 1500, 100); // 1:40/100m-ish threshold
  const session = buildSessionFromProfile(SWIMMING_PROFILE, {
    slot: 'moderate', weekPlan, baselineZones: zones, durationSeconds: 1800, variety: 0,
  });
  expect(session.targetPaceSecondsPer100m).not.toBeNull();
  expect(session.targetPaceSecondsPerKm).toBeNull();
});

test('rowing targets split per 500m', () => {
  const zones = trainingZonesFromBaseline(2000, 420, 500);
  const session = buildSessionFromProfile(ROWING_PROFILE, {
    slot: 'moderate', weekPlan, baselineZones: zones, durationSeconds: 1500, variety: 0,
  });
  expect(session.targetSplitSecondsPer500m).not.toBeNull();
});

test('cycling always carries a zone label, never a numeric pace -- no baseline model exists for it', () => {
  const session = buildSessionFromProfile(CYCLING_PROFILE, {
    slot: 'hard', weekPlan, baselineZones: null, durationSeconds: 1800, variety: 0,
  });
  expect(session.targetZoneLabel).toBeTruthy();
  expect(session.targetPaceSecondsPerKm).toBeNull();
  expect(session.targetPaceSecondsPer100m).toBeNull();
});

test('a hard slot on swimming (no hard-tier type) downgrades to its moderate type', () => {
  const session = buildSessionFromProfile(SWIMMING_PROFILE, {
    slot: 'hard', weekPlan, baselineZones: null, durationSeconds: 1800, variety: 0,
  });
  expect(session.type).toBe('swim_threshold_css');
  expect(session.intensity).toBe('moderate');
});

test('a hard slot on walking (no hard-tier type) downgrades to its moderate type', () => {
  const session = buildSessionFromProfile(WALKING_PROFILE, {
    slot: 'hard', weekPlan, baselineZones: null, durationSeconds: 1800, variety: 0,
  });
  expect(session.type).toBe('walk_hills');
  expect(session.intensity).toBe('moderate');
});

test('a hard running slot carries structured reps x work + rest', () => {
  const session = buildSessionFromProfile(RUNNING_PROFILE, {
    slot: 'hard', weekPlan, baselineZones: null, durationSeconds: 1800, variety: 1, // reps_800
  });
  expect(session.steps).not.toBeNull();
  expect(session.steps![0].reps).toBeGreaterThan(0);
  expect(session.reps).toBe(session.steps![0].reps);
});

test('the `variety` counter rotates among a discipline\'s same-intensity type options', () => {
  const types = new Set<string>();
  for (let i = 0; i < RUNNING_PROFILE.types.hard!.length; i++) {
    const session = buildSessionFromProfile(RUNNING_PROFILE, {
      slot: 'hard', weekPlan, baselineZones: null, durationSeconds: 1800, variety: i,
    });
    types.add(session.type);
  }
  expect(types.size).toBe((RUNNING_PROFILE.types.hard as string[]).length);
});
