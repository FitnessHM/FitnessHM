import { isoDateLocal } from '../dates';
import type { Weekday } from '../../db/schema';

const DAY_MS = 86400000;

// Calendar arithmetic via setDate, NOT a fixed-86400000ms offset. The local
// calendar day a DST transition lands on is 23 or 25 hours long -- adding
// exactly 24h to that day's local midnight does not land on the next day's
// local midnight, it lands on the *same* day (fall-back) or skips a day
// (spring-forward). Confirmed the hard way: generatePlan's day-stepping
// loop (`for (let d = today; d <= targetDate; d = addDaysIso(d, 1))`) hung
// forever for any `today`/`targetDate` range spanning Nov 1, 2026 -- the US
// fall-back date -- because `addDaysIso(d, 1)` kept returning the same `d`.
// `setDate` is immune: it operates on the calendar date field and lets the
// engine recompute the correct local time for that day, DST included.
export function addDaysIso(dateIso: string, days: number): string {
  const date = new Date(dateIso + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return isoDateLocal(date);
}

// Millisecond math here is safe (unlike addDaysIso above): this computes a
// difference between two local midnights and rounds, and a DST transition
// can only shift that raw difference by +/-1 hour -- Math.round absorbs an
// error that small without ever landing on the wrong integer day count.
export function daysBetweenIso(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso + 'T00:00:00').getTime() - new Date(fromIso + 'T00:00:00').getTime()) / DAY_MS);
}

export function isoWeekday(dateIso: string): Weekday {
  return new Date(dateIso + 'T00:00:00').getDay() as Weekday;
}

/** The 7 calendar dates (Monday-first) of the week containing `dateIso`. */
export function weekDatesContaining(dateIso: string): string[] {
  const weekday = isoWeekday(dateIso);
  const daysSinceMonday = (weekday + 6) % 7;
  const monday = addDaysIso(dateIso, -daysSinceMonday);
  return Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
}
