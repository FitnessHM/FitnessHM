import { isoDateLocal } from '../dates';
import type { Weekday } from '../../db/schema';

const DAY_MS = 86400000;

export function addDaysIso(dateIso: string, days: number): string {
  return isoDateLocal(new Date(new Date(dateIso + 'T00:00:00').getTime() + days * DAY_MS));
}

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
