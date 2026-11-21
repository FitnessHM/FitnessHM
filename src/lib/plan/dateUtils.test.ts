import { expect, test } from 'vitest';
import { addDaysIso, daysBetweenIso, isoWeekday, weekDatesContaining } from './dateUtils';

// Regression coverage for a real bug: addDaysIso used to add a fixed
// 86,400,000ms instead of incrementing the calendar date. On a DST
// transition day in this machine's timezone (America/New_York), that
// local day is 23 or 25 hours long, so a fixed 24h offset either lands
// back on the *same* day (fall-back) or skips a day (spring-forward).
// The fall-back case hung generatePlan's day-stepping loop forever for
// any block spanning Nov 1, 2026 -- confirmed the hard way, not a
// hypothetical. These dates are fixed historical/near-term DST
// transitions in America/New_York, not derived from "today", so the
// tests stay meaningful regardless of when they're run.
const FALL_BACK_2026 = '2026-11-01'; // clocks move back 1 hour -- this local day is 25 hours long
const SPRING_FORWARD_2026 = '2026-03-08'; // clocks move forward 1 hour -- this local day is 23 hours long

test('addDaysIso advances by exactly one calendar day across a fall-back DST transition', () => {
  expect(addDaysIso('2026-10-31', 1)).toBe(FALL_BACK_2026);
  expect(addDaysIso(FALL_BACK_2026, 1)).toBe('2026-11-02'); // not FALL_BACK_2026 again
});

test('addDaysIso advances by exactly one calendar day across a spring-forward DST transition', () => {
  expect(addDaysIso('2026-03-07', 1)).toBe(SPRING_FORWARD_2026);
  expect(addDaysIso(SPRING_FORWARD_2026, 1)).toBe('2026-03-09'); // not skipped to 03-10
});

test('stepping addDaysIso one day at a time across a DST transition visits every date exactly once', () => {
  const dates: string[] = [];
  let d = '2026-10-29';
  const MAX_ITERATIONS = 20; // real range is 5 days -- this is purely a hang guard
  for (let i = 0; i < MAX_ITERATIONS && d <= '2026-11-03'; i++) {
    dates.push(d);
    d = addDaysIso(d, 1);
  }
  expect(dates).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']);
});

test('daysBetweenIso stays correct across a DST transition (millisecond math is fine here, unlike addDaysIso)', () => {
  expect(daysBetweenIso('2026-10-29', '2026-11-03')).toBe(5);
  expect(daysBetweenIso('2026-03-05', '2026-03-10')).toBe(5);
});

test('weekDatesContaining returns 7 distinct, consecutive dates even when the week spans a DST transition', () => {
  const week = weekDatesContaining(FALL_BACK_2026); // Sunday -- Monday of that week is Oct 26
  expect(week).toHaveLength(7);
  expect(new Set(week).size).toBe(7);
  expect(week[0]).toBe('2026-10-26');
  expect(week[6]).toBe('2026-11-01');
});

test('isoWeekday is unaffected (it only reads the date, never adds to it)', () => {
  expect(isoWeekday(FALL_BACK_2026)).toBe(0); // Sunday
});
