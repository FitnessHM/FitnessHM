import { expect, test } from 'vitest';
import { longestSessionTarget, maxHardSessionsPerWeek, includeModerateSession } from './volume';
import type { WeekPlan } from './phases';

function week(overrides: Partial<WeekPlan>): WeekPlan {
  return { weekIndex: 1, startDate: '2026-02-01', phase: 'build', isDeload: false, volumeFactor: 1, ...overrides };
}

test('longestSessionTarget never exceeds 110% of the recent peak outside deload/taper', () => {
  const target = longestSessionTarget(week({ volumeFactor: 3 }), 'intermediate', [1800, 2000]);
  expect(target).toBeLessThanOrEqual(2000 * 1.1 + 0.001);
});

test('longestSessionTarget is exempt from the growth cap during deload and taper', () => {
  const deload = longestSessionTarget(week({ isDeload: true, phase: 'deload', volumeFactor: 0.65 }), 'intermediate', [10000]);
  const taper = longestSessionTarget(week({ phase: 'taper', volumeFactor: 0.2 }), 'intermediate', [10000]);
  expect(deload).toBeLessThan(10000); // it's shrinking, just not by the growth formula
  expect(taper).toBeLessThan(10000);
});

test('longestSessionTarget seeds from a level-based default when there is no history yet', () => {
  const beginner = longestSessionTarget(week({}), 'beginner', []);
  const competitive = longestSessionTarget(week({}), 'competitive', []);
  expect(beginner).toBeGreaterThan(0);
  expect(competitive).toBeGreaterThan(beginner);
});

test('maxHardSessionsPerWeek caps beginners at 1, everyone else at 2, outside deload/taper', () => {
  expect(maxHardSessionsPerWeek('beginner', week({}))).toBe(1);
  expect(maxHardSessionsPerWeek('intermediate', week({}))).toBe(2);
  expect(maxHardSessionsPerWeek('advanced', week({}))).toBe(2);
});

test('maxHardSessionsPerWeek drops further during deload, and caps at 1 during taper', () => {
  expect(maxHardSessionsPerWeek('intermediate', week({ isDeload: true }))).toBe(1);
  expect(maxHardSessionsPerWeek('beginner', week({ isDeload: true }))).toBe(0);
  expect(maxHardSessionsPerWeek('advanced', week({ phase: 'taper' }))).toBe(1);
});

test('includeModerateSession never fires during deload', () => {
  expect(includeModerateSession('advanced', week({ isDeload: true }), 6)).toBe(false);
});

test('includeModerateSession needs enough weekly slots to fit', () => {
  expect(includeModerateSession('intermediate', week({}), 2)).toBe(false);
  expect(includeModerateSession('intermediate', week({}), 5)).toBe(true);
});
