import type { Athlete, PrescribedSession, SessionType, TimedEffort, TrainingBlock } from '../../db/schema';
import type { Discipline, Level } from '../disciplines';
import { CARDIO_DISCIPLINES } from '../disciplines';
import { trainingZonesFromBaseline, type TrainingZones } from '../paceMath';
import { addDaysIso, daysBetweenIso, isoWeekday } from './dateUtils';
import { resolveTrainingWeekdays, resolveOtherTrainingWeekdays } from './weekdays';
import { buildRacePhases, buildBudgetPhases, estimateFinishMinutes, type WeekPlan } from './phases';
import { longestSessionTarget, typicalSessionSeconds, maxHardSessionsPerWeek, includeModerateSession } from './volume';
import { disciplineProfile, buildSessionFromProfile, type SlotKind, type SessionContent } from './library';
import { sessionIntensity } from './intensity';
import { DisciplineCycle, buildDisciplineShares } from './mix';

export type PrescribedSessionDraft = Omit<PrescribedSession, 'id'>;

export interface GeneratorInput {
  today: string;
  block: TrainingBlock;
  athlete: Athlete;
  // Most recent/best effort per discipline, if any. In practice (phases
  // 1-3) this only ever has an entry for the block's primary discipline --
  // secondary Mix disciplines have no baseline-collection path yet.
  baselines: Partial<Record<Discipline, TimedEffort>>;
  // Sessions the generator must treat as fixed: dated >= today, and either
  // edited: true or source: 'user'. Always [] until Plan editing (phase 4)
  // exists -- see docs/.../phase2-plans-design.md's "Update plan" section
  // for what this is for.
  fixedSessions: PrescribedSession[];
}

const CHECKPOINT_TYPE_BY_DISCIPLINE: Partial<Record<Discipline, SessionType>> = {
  running: 'time_trial',
  cycling: 'bike_time_trial',
  swimming: 'swim_time_trial',
  rowing: 'row_time_trial',
  // walking has none -- it never collects a baseline in this app.
};

export function generatePlan(input: GeneratorInput): PrescribedSessionDraft[] {
  const { today, block, athlete } = input;
  const targetDate = block.targetDate;
  if (!targetDate || daysBetweenIso(today, targetDate) <= 0) return [];

  const disciplines = resolveDisciplines(block);
  if (disciplines.length === 0) return []; // Lifting/Sports blocks: nothing cardio to generate

  const primary = resolveBlockDiscipline(block, disciplines);
  const levels = resolveLevels(block, disciplines);
  const trainingWeekdays = resolveTrainingWeekdays(athlete);
  const otherTrainingWeekdays = resolveOtherTrainingWeekdays(athlete);

  const isBudgetGoal = block.weeklyHours != null && block.weeklyHours > 0;
  const weeks = isBudgetGoal
    ? buildBudgetPhases(today, targetDate)
    : buildRacePhases(today, targetDate, estimateFinishMinutes(primary, block.eventDistanceMeters));
  if (weeks.length === 0) return [];

  const zonesByDiscipline: Partial<Record<Discipline, TrainingZones>> = {};
  for (const d of disciplines) {
    const baseline = input.baselines[d];
    const profile = disciplineProfile(d);
    if (baseline && profile?.unitDistanceMeters != null) {
      zonesByDiscipline[d] = trainingZonesFromBaseline(baseline.distanceMeters, baseline.timeSeconds, profile.unitDistanceMeters);
    }
  }

  const shares = buildDisciplineShares(disciplines, primary);
  const cycle = new DisciplineCycle(disciplines, shares);
  const varietyBySlot = new Map<string, number>();
  const nextVariety = (discipline: Discipline, slot: SlotKind): number => {
    const key = `${discipline}:${slot}`;
    const v = varietyBySlot.get(key) ?? 0;
    varietyBySlot.set(key, v + 1);
    return v;
  };

  const fixedByDate = new Map<string, PrescribedSession[]>();
  for (const s of input.fixedSessions) {
    const arr = fixedByDate.get(s.date) ?? [];
    arr.push(s);
    fixedByDate.set(s.date, arr);
  }
  const hasNonEasyFixedOn = (d: string): boolean => {
    const list = fixedByDate.get(d);
    return !!list && list.some((s) => sessionIntensity(s) !== 'easy');
  };

  // Every candidate calendar date (fixed or to-be-generated), in order.
  const allDates: string[] = [];
  for (let d = today; d <= targetDate; d = addDaysIso(d, 1)) {
    if (trainingWeekdays.includes(isoWeekday(d))) allDates.push(d);
  }

  const primaryLevel = levels[primary] ?? 'intermediate';
  const needsBaselineTest = new Set(disciplines.filter((d) => !input.baselines[d] && CHECKPOINT_TYPE_BY_DISCIPLINE[d]));
  const baselineTestDone = new Set<Discipline>();
  const drafts: PrescribedSessionDraft[] = [];
  const recentPeaks: number[] = [];
  let lastNonEasyDate: string | null = null;
  let currentWeekIndex = -1;
  let hardBudget = 0;
  let moderateBudget = 0;
  let longDate: string | null = null;
  let longestSeconds = 0;

  for (const date of allDates) {
    const weekIndex = Math.floor(daysBetweenIso(today, date) / 7);
    const weekPlan = weeks[Math.min(weekIndex, weeks.length - 1)];

    if (weekIndex !== currentWeekIndex) {
      // Close out the previous week's volume bookkeeping.
      if (currentWeekIndex >= 0) {
        const prevPlan = weeks[Math.min(currentWeekIndex, weeks.length - 1)];
        if (longDate && !prevPlan.isDeload && prevPlan.phase !== 'taper') {
          recentPeaks.push(longestSeconds);
          if (recentPeaks.length > 3) recentPeaks.shift();
        }
      }
      currentWeekIndex = weekIndex;

      const weekDates = Array.from({ length: 7 }, (_, i) => addDaysIso(weekPlan.startDate, i)).filter(
        (d) => d >= today && d <= targetDate
      );
      const weekTrainingDates = weekDates.filter((d) => trainingWeekdays.includes(isoWeekday(d)));
      const fixedThisWeek = weekDates.flatMap((d) => fixedByDate.get(d) ?? []);

      hardBudget = Math.max(
        0,
        maxHardSessionsPerWeek(primaryLevel, weekPlan) - fixedThisWeek.filter((s) => sessionIntensity(s) === 'hard').length
      );
      moderateBudget = Math.max(
        0,
        (includeModerateSession(primaryLevel, weekPlan, weekTrainingDates.length) ? 1 : 0) -
          fixedThisWeek.filter((s) => sessionIntensity(s) === 'moderate').length
      );

      const openDatesThisWeek = weekTrainingDates.filter((d) => !fixedByDate.has(d));
      longDate = openDatesThisWeek.length > 0 ? openDatesThisWeek[openDatesThisWeek.length - 1] : null;
      longestSeconds = longDate ? longestSessionTarget(weekPlan, primaryLevel, recentPeaks) : 0;
    }

    const fixedToday = fixedByDate.get(date);
    if (fixedToday) {
      // Fixed input, not ours to generate -- but its load still counts
      // toward adjacency tracking (never schedule a new hard/moderate
      // session next to one that's already fixed).
      if (fixedToday.some((s) => sessionIntensity(s) !== 'easy')) lastNonEasyDate = date;
      continue;
    }

    const discipline = cycle.next();
    const profile = disciplineProfile(discipline);
    if (!profile) continue; // defensive -- resolveDisciplines already filters to cardio only

    const level = levels[discipline] ?? 'intermediate';
    const isLong = date === longDate;
    const canBeHardToday = !otherTrainingWeekdays.includes(isoWeekday(date));
    // Adjacency looks both ways: backward via lastNonEasyDate (covers a
    // previously generated OR fixed non-easy day), and forward via a
    // direct lookup (covers an *upcoming* fixed non-easy day, which
    // lastNonEasyDate can't know about yet since fixed sessions aren't
    // discovered in chronological order relative to what's being decided
    // right now).
    const adjacentToNonEasy =
      (lastNonEasyDate != null && Math.abs(daysBetweenIso(lastNonEasyDate, date)) <= 1) ||
      hasNonEasyFixedOn(addDaysIso(date, 1)) ||
      hasNonEasyFixedOn(addDaysIso(date, -1));

    let slot: SlotKind;
    if (isLong) {
      slot = 'long';
    } else if (hardBudget > 0 && canBeHardToday && profile.types.hard !== null && !adjacentToNonEasy) {
      slot = 'hard';
    } else if (moderateBudget > 0 && profile.types.moderate !== null && !adjacentToNonEasy) {
      slot = 'moderate';
    } else {
      slot = 'easy';
    }

    const durationSeconds = isLong ? longestSeconds : typicalSessionSeconds(weekPlan, level);

    // A discipline with no baseline gets its checkpoint test at the first
    // *safe* opportunity -- whichever slot is that discipline's toughest
    // regularly-schedulable tier (hard, or moderate for a discipline with
    // no hard-tier type), so it still goes through the exact same budget
    // and adjacency gating a real hard/moderate session would. This is
    // deliberately not "always the very first calendar day": forcing it in
    // regardless of budget/adjacency broke both invariants in testing.
    const isCheckpointOpportunity =
      (slot === 'hard' || slot === 'moderate') && needsBaselineTest.has(discipline) && !baselineTestDone.has(discipline);

    const content = isCheckpointOpportunity
      ? checkpointContent(discipline, durationSeconds)
      : buildSessionFromProfile(profile, {
          slot,
          weekPlan,
          baselineZones: zonesByDiscipline[discipline] ?? null,
          durationSeconds,
          variety: nextVariety(discipline, slot),
        });
    if (isCheckpointOpportunity) baselineTestDone.add(discipline);

    // Budget bookkeeping is keyed on `slot` (which pool this turn drew
    // from), not `content.intensity` -- a checkpoint test scheduled via a
    // discipline's "moderate" slot (swimming, walking) must still debit
    // moderateBudget, even though the test itself is a hard/max effort.
    if (!isLong && slot === 'hard') hardBudget--;
    if (!isLong && slot === 'moderate') moderateBudget--;
    if (slot !== 'easy' && slot !== 'long') lastNonEasyDate = date;

    drafts.push({
      blockId: block.id,
      date,
      type: content.type,
      discipline,
      intensity: content.intensity,
      reps: content.reps,
      steps: content.steps,
      targetPaceSecondsPerKm: content.targetPaceSecondsPerKm,
      targetPaceSecondsPer100m: content.targetPaceSecondsPer100m,
      targetSplitSecondsPer500m: content.targetSplitSecondsPer500m,
      targetZoneLabel: content.targetZoneLabel,
      targetRpeMin: content.targetRpeMin,
      targetRpeMax: content.targetRpeMax,
      targetRestSeconds: content.targetRestSeconds,
      targetDurationSeconds: content.targetDurationSeconds,
      targetDistanceMeters: content.targetDistanceMeters,
      note: content.note,
      source: 'generated',
      edited: false,
    });
  }

  return drafts;
}

// With no baseline, a discipline's checkpoint test stands in for its first
// safely-schedulable hard/moderate session (see isCheckpointOpportunity
// above) -- "use time + RPE until a test is logged, then fill in pace
// targets." Always a max/near-max effort regardless of which budget pool
// scheduled it.
function checkpointContent(discipline: Discipline, durationSeconds: number): SessionContent {
  return {
    type: CHECKPOINT_TYPE_BY_DISCIPLINE[discipline]!,
    intensity: 'hard',
    reps: null,
    steps: null,
    targetPaceSecondsPerKm: null,
    targetPaceSecondsPer100m: null,
    targetSplitSecondsPer500m: null,
    targetZoneLabel: null,
    targetRpeMin: 8,
    targetRpeMax: 10,
    targetRestSeconds: null,
    targetDurationSeconds: Math.round(durationSeconds),
    targetDistanceMeters: null,
    note: "A baseline test tells us where you're really starting from -- give this one your honest best effort.",
  };
}

function resolveDisciplines(block: TrainingBlock): Discipline[] {
  const list = block.disciplines?.length ? block.disciplines : [block.discipline ?? 'running'];
  return list.filter((d): d is Discipline => (CARDIO_DISCIPLINES as string[]).includes(d));
}

function resolveBlockDiscipline(block: TrainingBlock, disciplines: Discipline[]): Discipline {
  const d = block.discipline;
  return d && disciplines.includes(d) ? d : disciplines[0];
}

function resolveLevels(block: TrainingBlock, disciplines: Discipline[]): Partial<Record<Discipline, Level>> {
  const levels: Partial<Record<Discipline, Level>> = {};
  if (block.level && block.discipline) levels[block.discipline] = block.level;
  Object.assign(levels, block.disciplineLevels);
  for (const d of disciplines) if (!levels[d]) levels[d] = 'intermediate';
  return levels;
}
