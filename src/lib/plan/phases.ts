import type { Discipline } from '../disciplines';
import { addDaysIso, daysBetweenIso } from './dateUtils';

export type Phase = 'base' | 'build' | 'specific' | 'taper' | 'deload';

export interface WeekPlan {
  weekIndex: number; // 0-based from today's week
  startDate: string; // ISO date this week's 7-day window starts on (= today for week 0)
  phase: Phase;
  isDeload: boolean;
  // 0..1-ish, relative to this plan's peak week. Drives volume.ts's targets.
  volumeFactor: number;
}

const DELOAD_EVERY_N_WEEKS = 4; // "every 3-4 weeks" -- see docs/.../phase2-plans-design.md

// Rough recreational speed per discipline, km/h -- used only to bucket
// taper length into "short/medium/long event," not shown to the user or
// used for any real target. A simplification of the spec's "level-based
// assumed pace": one flat speed per discipline rather than per level/
// discipline, since this only needs to land in the right bucket.
const ROUGH_SPEED_KMH: Partial<Record<Discipline, number>> = {
  running: 10,
  walking: 5.5,
  cycling: 25,
  swimming: 2.5,
  rowing: 12,
};

export function estimateFinishMinutes(discipline: Discipline, distanceMeters: number): number {
  const speed = ROUGH_SPEED_KMH[discipline] ?? 10;
  return (distanceMeters / 1000 / speed) * 60;
}

// Taper length, scaled to event length by estimated finishing time, not raw
// distance (distance isn't comparable across disciplines). Coaching
// convention, not a single research citation -- see docs/plan-evidence.md.
function taperWeeksFor(estimatedMinutes: number): number {
  if (estimatedMinutes < 40) return 4 / 7;
  if (estimatedMinutes < 90) return 1;
  if (estimatedMinutes < 180) return 1.5;
  return 2.5;
}

function isDeloadWeekIndex(weekIndex: number): boolean {
  // Never the very first week of a phase block; every 4th week after that.
  return weekIndex > 0 && (weekIndex + 1) % DELOAD_EVERY_N_WEEKS === 0;
}

/**
 * Phase breakdown for a race-goal block: base -> build -> specific -> taper,
 * with a deload week dropped in every 3-4 weeks (taper supersedes deload --
 * it's already a deliberate volume drop). See the spec's "Phase structure"
 * for the 40/35/25 split and the <3-week fallback.
 */
export function buildRacePhases(today: string, targetDate: string, estimatedFinishMinutes: number): WeekPlan[] {
  const totalDays = daysBetweenIso(today, targetDate);
  if (totalDays <= 0) return [];
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));

  const taperWeeks = Math.min(Math.round(taperWeeksFor(estimatedFinishMinutes)), Math.max(0, totalWeeks - 1));
  const remaining = totalWeeks - taperWeeks;

  let baseWeeks: number;
  let buildWeeks: number;
  let specificWeeks: number;
  if (remaining < 3) {
    // Not enough time for a real base/build progression -- honest fallback
    // rather than pretending there's room for one.
    baseWeeks = 0;
    buildWeeks = 0;
    specificWeeks = remaining;
  } else {
    baseWeeks = Math.max(1, Math.round(remaining * 0.4));
    buildWeeks = Math.max(1, Math.round(remaining * 0.35));
    specificWeeks = remaining - baseWeeks - buildWeeks;
    if (specificWeeks < 1) {
      specificWeeks = 1;
      buildWeeks = Math.max(1, remaining - baseWeeks - specificWeeks);
    }
  }

  const weeks: WeekPlan[] = [];
  let idx = 0;

  const pushPhase = (count: number, phase: Phase, curve: (i: number, n: number) => number) => {
    for (let i = 0; i < count; i++) {
      const isDeload = phase !== 'taper' && isDeloadWeekIndex(idx);
      weeks.push({
        weekIndex: idx,
        startDate: addDaysIso(today, idx * 7),
        phase: isDeload ? 'deload' : phase,
        isDeload,
        volumeFactor: isDeload ? 0.65 : curve(i, count),
      });
      idx++;
    }
  };

  pushPhase(baseWeeks, 'base', (i, n) => 0.5 + 0.2 * frac(i, n)); // 0.50 -> 0.70
  pushPhase(buildWeeks, 'build', (i, n) => 0.75 + 0.25 * frac(i, n)); // 0.75 -> 1.00
  pushPhase(specificWeeks, 'specific', (i, n) => 0.95 - 0.1 * frac(i, n)); // slight recede from peak
  pushPhase(taperWeeks > 0 ? Math.max(1, Math.round(taperWeeks)) : 0, 'taper', (i, n) => 0.6 - 0.4 * frac(i, n)); // 0.60 -> ~0.20

  return weeks.slice(0, totalWeeks);
}

/**
 * Phase breakdown for a general-fitness/weekly-hours block: repeating
 * build-build-build-deload cycles for the life of the block, with a gentle
 * week-1 ramp-in.
 */
export function buildBudgetPhases(today: string, targetDate: string): WeekPlan[] {
  const totalDays = daysBetweenIso(today, targetDate);
  if (totalDays <= 0) return [];
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));

  const weeks: WeekPlan[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    const isDeload = (i + 1) % DELOAD_EVERY_N_WEEKS === 0;
    weeks.push({
      weekIndex: i,
      startDate: addDaysIso(today, i * 7),
      phase: isDeload ? 'deload' : 'build',
      isDeload,
      volumeFactor: isDeload ? 0.65 : i === 0 ? 0.8 : 1,
    });
  }
  return weeks;
}

function frac(i: number, n: number): number {
  return n <= 1 ? 1 : i / (n - 1);
}
