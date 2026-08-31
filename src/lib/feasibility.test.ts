import { expect, test } from 'vitest';
import { requiredImprovementRate, assessFeasibility } from './feasibility';

test('requiredImprovementRate computes gap and weekly rate needed', () => {
  const today = new Date('2026-08-30');
  const targetDate = new Date('2026-10-11'); // 6 weeks out
  const result = requiredImprovementRate(1530, 1380, today, targetDate); // 25:30 -> 23:00
  expect(result.gapSeconds).toBe(150);
  expect(result.weeksRemaining).toBeCloseTo(6, 0);
  expect(result.requiredSecondsPerWeek).toBeCloseTo(25, 0);
});

test('assessFeasibility marks an achievable goal as feasible with no suggestion', () => {
  const today = new Date('2026-08-30');
  const targetDate = new Date('2027-08-30'); // a full year — plenty of time
  const result = assessFeasibility(1530, 1500, today, targetDate); // tiny 30s gap
  expect(result.isFeasible).toBe(true);
  expect(result.suggestedGoalTimeSeconds).toBeNull();
  expect(result.suggestedTargetDate).toBeNull();
});

test('assessFeasibility flags an unrealistic goal and suggests an achievable alternative', () => {
  const today = new Date('2026-08-30');
  const targetDate = new Date('2026-09-13'); // 2 weeks — too fast for a 3-minute drop
  const result = assessFeasibility(1530, 1350, today, targetDate); // 25:30 -> 22:30
  expect(result.isFeasible).toBe(false);
  expect(result.suggestedGoalTimeSeconds).not.toBeNull();
  expect(result.suggestedGoalTimeSeconds!).toBeGreaterThan(1350);
  expect(result.suggestedTargetDate).not.toBeNull();
  expect(result.suggestedTargetDate!.getTime()).toBeGreaterThan(targetDate.getTime());
});
