import type { Level } from '../disciplines';
import type { WeekPlan } from './phases';

// Seed durations (seconds) for the week's longest session, by level --
// ballpark coaching-convention defaults, not measured. Only used to seed
// week 1 / whenever there's no rolling history yet; growth from there is
// governed by the cap below.
const PEAK_LONG_SESSION_SECONDS: Record<Level, number> = {
  beginner: 35 * 60,
  intermediate: 60 * 60,
  advanced: 90 * 60,
  competitive: 120 * 60,
};

// A non-"long" session's typical duration (seconds), by level. Scaled by
// the week's volumeFactor the same way the long session is.
const TYPICAL_SESSION_SECONDS: Record<Level, number> = {
  beginner: 25 * 60,
  intermediate: 35 * 60,
  advanced: 45 * 60,
  competitive: 55 * 60,
};

// Conservative reading of the popular "10% rule" -- explicitly a ceiling,
// not a target, and explicitly not strongly supported by controlled
// research (see docs/plan-evidence.md). Deload/taper weeks are exempt: they
// deliberately shrink, so the cap (which only ever limits growth) doesn't
// apply.
const GROWTH_CAP = 1.1;

/** This week's target duration (seconds) for the week's single longest session, growth-capped against recent non-deload/taper weeks. */
export function longestSessionTarget(weekPlan: WeekPlan, level: Level, recentPeaksSeconds: number[]): number {
  const raw = PEAK_LONG_SESSION_SECONDS[level] * weekPlan.volumeFactor;
  if (weekPlan.isDeload || weekPlan.phase === 'taper' || recentPeaksSeconds.length === 0) return raw;
  const cap = Math.max(...recentPeaksSeconds) * GROWTH_CAP;
  return Math.min(raw, cap);
}

/** Target duration (seconds) for an ordinary (non-"long") session this week. */
export function typicalSessionSeconds(weekPlan: WeekPlan, level: Level): number {
  return TYPICAL_SESSION_SECONDS[level] * weekPlan.volumeFactor;
}

/** Max hard (high-intensity) sessions this week, counted across every discipline combined -- it's the same athlete's recovery regardless of sport. */
export function maxHardSessionsPerWeek(level: Level, weekPlan: WeekPlan): number {
  if (weekPlan.isDeload) return level === 'beginner' ? 0 : 1;
  if (weekPlan.phase === 'taper') return 1; // one short sharpening effort, early in taper
  return level === 'beginner' ? 1 : 2;
}

/** Whether this week should include one moderate (tempo/threshold-ish) session, on top of (or in place of) the hard-session budget. */
export function includeModerateSession(level: Level, weekPlan: WeekPlan, totalSlotsThisWeek: number): boolean {
  if (weekPlan.isDeload) return false;
  if (level === 'beginner' && weekPlan.phase !== 'specific') return false;
  return totalSlotsThisWeek >= 4;
}
