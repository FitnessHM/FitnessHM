import { expect, test } from 'vitest';
import { defaultTrainingWeekdays, resolveTrainingWeekdays, resolveOtherTrainingWeekdays } from './weekdays';

test('defaultTrainingWeekdays spreads n days roughly evenly, Monday-first order', () => {
  expect(defaultTrainingWeekdays(1)).toHaveLength(1);
  expect(defaultTrainingWeekdays(3)).toEqual([1, 3, 6]); // Mon, Wed, Sat
  expect(defaultTrainingWeekdays(7)).toEqual([1, 2, 3, 4, 5, 6, 0]);
});

test('defaultTrainingWeekdays always returns exactly n distinct days', () => {
  for (let n = 1; n <= 7; n++) {
    const days = defaultTrainingWeekdays(n);
    expect(new Set(days).size).toBe(n);
  }
});

test('resolveTrainingWeekdays prefers the athlete-chosen days, sorted Monday-first', () => {
  expect(resolveTrainingWeekdays({ trainingWeekdays: [0, 3, 1], daysPerWeek: 5 })).toEqual([1, 3, 0]);
});

test('resolveTrainingWeekdays falls back to the default when unset or empty', () => {
  expect(resolveTrainingWeekdays({ trainingWeekdays: null, daysPerWeek: 3 })).toEqual([1, 3, 6]);
  expect(resolveTrainingWeekdays({ trainingWeekdays: [], daysPerWeek: 3 })).toEqual([1, 3, 6]);
});

test('resolveOtherTrainingWeekdays defaults to empty', () => {
  expect(resolveOtherTrainingWeekdays({})).toEqual([]);
  expect(resolveOtherTrainingWeekdays({ otherTrainingWeekdays: [2, 4] })).toEqual([2, 4]);
});
