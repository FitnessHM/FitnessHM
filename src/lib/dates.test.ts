import { expect, test } from 'vitest';
import { isoDateLocal, todayIso } from './dates';

test('isoDateLocal formats a local date as yyyy-mm-dd', () => {
  expect(isoDateLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
  expect(isoDateLocal(new Date(2026, 11, 31))).toBe('2026-12-31');
});

test('isoDateLocal uses local calendar fields, not UTC', () => {
  // Late-evening local time is already the next day in UTC for negative
  // offsets and the previous day for positive ones — the local date wins.
  const lateEvening = new Date(2026, 5, 15, 23, 30);
  expect(isoDateLocal(lateEvening)).toBe('2026-06-15');

  const earlyMorning = new Date(2026, 5, 15, 0, 30);
  expect(isoDateLocal(earlyMorning)).toBe('2026-06-15');
});

test('todayIso returns a yyyy-mm-dd string', () => {
  expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(todayIso()).toBe(isoDateLocal(new Date()));
});
