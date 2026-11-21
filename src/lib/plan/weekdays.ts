import type { Weekday } from '../../db/schema';

// Monday-first order, matching startOfWeekIso's convention elsewhere in the
// codebase (src/lib/home.ts).
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

// Placeholder convention for athletes with no `trainingWeekdays` set (pre-
// phase-2 accounts that haven't revisited onboarding): spread `n` days
// roughly evenly across the week, Monday-first. Not tuned for "feel" --
// just deterministic and reasonable until the athlete picks real days.
export function defaultTrainingWeekdays(daysPerWeek: number): Weekday[] {
  const n = Math.max(1, Math.min(7, Math.round(daysPerWeek) || 1));
  if (n === 7) return [...WEEK_ORDER];
  const picked = new Set<Weekday>();
  for (let i = 0; i < n; i++) {
    picked.add(WEEK_ORDER[Math.round((i * 7) / n) % 7]);
  }
  // Rounding can collide and under-produce `n` distinct days -- top up from
  // the front of the week in order.
  for (let i = 0; picked.size < n && i < 7; i++) picked.add(WEEK_ORDER[i]);
  return WEEK_ORDER.filter((d) => picked.has(d));
}

export function resolveTrainingWeekdays(athlete: {
  trainingWeekdays?: Weekday[] | null;
  daysPerWeek: number;
}): Weekday[] {
  if (athlete.trainingWeekdays && athlete.trainingWeekdays.length > 0) {
    return WEEK_ORDER.filter((d) => athlete.trainingWeekdays!.includes(d));
  }
  return defaultTrainingWeekdays(athlete.daysPerWeek);
}

export function resolveOtherTrainingWeekdays(athlete: { otherTrainingWeekdays?: Weekday[] | null }): Weekday[] {
  return athlete.otherTrainingWeekdays ?? [];
}
