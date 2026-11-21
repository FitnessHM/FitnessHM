import { expect, test } from 'vitest';
import { generatePlan, type GeneratorInput } from './generate';
import { sessionIntensity } from './intensity';
import type { Athlete, PrescribedSession, TrainingBlock } from '../../db/schema';
import { daysBetweenIso, isoWeekday } from './dateUtils';

function athlete(overrides: Partial<Athlete> = {}): Athlete {
  return { id: 1, daysPerWeek: 4, otherTraining: ['none'], trainingWeekdays: [1, 2, 4, 6], otherTrainingWeekdays: [], ...overrides };
}

function block(overrides: Partial<TrainingBlock> = {}): TrainingBlock {
  return {
    id: 'block-1',
    eventDistanceMeters: 5000,
    eventLabel: '5K',
    goalType: 'time',
    goalTimeSeconds: 1200,
    targetDate: '2026-04-01',
    baselineSource: 'unknown',
    raceMantra: null,
    targetSplitSecondsPerKm: null,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    discipline: 'running',
    level: 'intermediate',
    disciplines: ['running'],
    disciplineLevels: { running: 'intermediate' },
    weeklyHours: null,
    sports: null,
    ...overrides,
  };
}

function input(overrides: Partial<GeneratorInput> = {}): GeneratorInput {
  return { today: '2026-01-05', block: block(), athlete: athlete(), baselines: {}, fixedSessions: [], ...overrides };
}

// Shared invariant checks reused across every scenario below.
function assertSensiblePlan(drafts: ReturnType<typeof generatePlan>, trainingWeekdays: number[], otherTrainingWeekdays: number[] = []) {
  expect(drafts.length).toBeGreaterThan(0);

  for (const s of drafts) {
    expect(trainingWeekdays).toContain(isoWeekday(s.date));
    expect(s.targetDurationSeconds).toBeGreaterThan(0);
    expect(s.targetRpeMin).not.toBeNull();
    expect(s.note).toBeTruthy();
    if (sessionIntensity(s) === 'hard') {
      expect(otherTrainingWeekdays).not.toContain(isoWeekday(s.date));
    }
  }

  // Never two non-easy days back-to-back.
  const sorted = [...drafts].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (let i = 1; i < sorted.length; i++) {
    if (sessionIntensity(sorted[i]) === 'easy') continue;
    const gap = daysBetweenIso(sorted[i - 1].date, sorted[i].date);
    if (sessionIntensity(sorted[i - 1]) !== 'easy') {
      expect(gap).toBeGreaterThan(1);
    }
  }

  // Hard-session cap holds in every calendar week.
  const byWeek = new Map<string, number>();
  for (const s of drafts) {
    if (sessionIntensity(s) !== 'hard') continue;
    const weekKey = String(Math.floor(daysBetweenIso('2026-01-05', s.date) / 7));
    byWeek.set(weekKey, (byWeek.get(weekKey) ?? 0) + 1);
  }
  for (const count of byWeek.values()) expect(count).toBeLessThanOrEqual(2);
}

test('12-week intermediate swimming plan for a 1500m produces a full, sensible plan', () => {
  const drafts = generatePlan(
    input({
      today: '2026-01-05',
      block: block({
        eventDistanceMeters: 1500, eventLabel: '1500m', discipline: 'swimming', disciplines: ['swimming'],
        disciplineLevels: { swimming: 'intermediate' }, level: 'intermediate', targetDate: '2026-03-30', // ~12 weeks
      }),
      athlete: athlete({ trainingWeekdays: [1, 2, 4, 6] }),
    })
  );
  assertSensiblePlan(drafts, [1, 2, 4, 6]);
  expect(drafts.every((s) => s.discipline === 'swimming')).toBe(true);
  expect(drafts.some((s) => s.type === 'swim_time_trial')).toBe(true); // no baseline -> checkpoint test injected
  expect(drafts.some((s) => s.type === 'swim_continuous')).toBe(true);
});

test('running 5K plan with a goal time produces a full, sensible plan with real pace targets once baselined', () => {
  const drafts = generatePlan(
    input({
      baselines: { running: { id: 'e1', blockId: 'block-1', date: '2026-01-01', distanceMeters: 5000, timeSeconds: 1500, kind: 'baseline' } },
    })
  );
  assertSensiblePlan(drafts, [1, 2, 4, 6]);
  expect(drafts.some((s) => s.targetPaceSecondsPerKm !== null)).toBe(true);
  expect(drafts.some((s) => s.type === 'long_run')).toBe(true);
});

test('5 hrs/week cycling general-fitness plan produces a full, sensible plan', () => {
  const drafts = generatePlan(
    input({
      block: block({
        eventDistanceMeters: 0, eventLabel: 'General fitness', discipline: 'cycling', disciplines: ['cycling'],
        disciplineLevels: { cycling: 'intermediate' }, level: 'intermediate', goalType: 'consistency', goalTimeSeconds: null,
        weeklyHours: 5, targetDate: '2026-06-01',
      }),
      athlete: athlete({ trainingWeekdays: [1, 3, 4, 6, 0] }),
    })
  );
  assertSensiblePlan(drafts, [1, 3, 4, 6, 0]);
  expect(drafts.every((s) => s.discipline === 'cycling')).toBe(true);
  // Every session has a zone label except the injected baseline checkpoint
  // (a time trial is "give it your best effort," not a target zone).
  expect(drafts.filter((s) => s.type !== 'bike_time_trial').every((s) => s.targetZoneLabel !== null)).toBe(true);
  // deload cadence: at least one lighter week in a ~5-month block
  const deloadNotes = drafts.filter((s) => (s.note ?? '').includes('Zone 1') || (s.note ?? '').includes('recovery'));
  expect(deloadNotes.length).toBeGreaterThan(0);
});

test('a run + bike mix produces sessions for both disciplines, weighted toward the primary', () => {
  const drafts = generatePlan(
    input({
      block: block({
        discipline: 'running', disciplines: ['running', 'cycling'],
        disciplineLevels: { running: 'intermediate', cycling: 'intermediate' },
      }),
      athlete: athlete({ trainingWeekdays: [1, 2, 3, 4, 5, 6] }),
    })
  );
  assertSensiblePlan(drafts, [1, 2, 3, 4, 5, 6]);
  const running = drafts.filter((s) => s.discipline === 'running').length;
  const cycling = drafts.filter((s) => s.discipline === 'cycling').length;
  expect(running).toBeGreaterThan(0);
  expect(cycling).toBeGreaterThan(0);
  expect(running).toBeGreaterThan(cycling);
});

test('a beginner never gets more than one hard session a week', () => {
  const drafts = generatePlan(
    input({
      block: block({ disciplineLevels: { running: 'beginner' }, level: 'beginner' }),
    })
  );
  const byWeek = new Map<number, number>();
  for (const s of drafts) {
    if (sessionIntensity(s) !== 'hard') continue;
    const wk = Math.floor(daysBetweenIso('2026-01-05', s.date) / 7);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1);
  }
  for (const count of byWeek.values()) expect(count).toBeLessThanOrEqual(1);
});

test('no hard sessions land on a lifting/sport day', () => {
  const drafts = generatePlan(input({ athlete: athlete({ trainingWeekdays: [1, 2, 3, 4, 5, 6], otherTrainingWeekdays: [2, 4] }) }));
  for (const s of drafts) {
    if (sessionIntensity(s) === 'hard') expect([2, 4]).not.toContain(isoWeekday(s.date));
  }
});

test('fixed/edited sessions are respected: no new session lands on their date, and they count toward the week\'s hard-session cap', () => {
  const fixed: PrescribedSession = {
    id: 'fixed-1', blockId: 'block-1', date: '2026-01-06', type: 'vo2max', discipline: 'running', intensity: 'hard',
    reps: null, steps: null, targetPaceSecondsPerKm: null, targetPaceSecondsPer100m: null, targetSplitSecondsPer500m: null,
    targetZoneLabel: null, targetRpeMin: 8, targetRpeMax: 9, targetRestSeconds: null, targetDurationSeconds: 1800,
    targetDistanceMeters: null, note: 'user-added hard day', source: 'user', edited: true,
  };
  const drafts = generatePlan(input({ fixedSessions: [fixed] }));

  expect(drafts.some((s) => s.date === '2026-01-06')).toBe(false); // nothing new generated on the fixed date

  // That first week should have at most 1 *new* hard session (cap of 2 for
  // intermediate, minus the 1 already used by the fixed session).
  const weekOneNewHard = drafts.filter((s) => {
    const wk = Math.floor(daysBetweenIso('2026-01-05', s.date) / 7);
    return wk === 0 && sessionIntensity(s) === 'hard';
  });
  expect(weekOneNewHard.length).toBeLessThanOrEqual(1);

  // Nothing new lands immediately adjacent to the fixed hard day either.
  expect(drafts.some((s) => ['2026-01-05', '2026-01-07'].includes(s.date) && sessionIntensity(s) !== 'easy')).toBe(false);
});

test('returns nothing for a Lifting-only block -- lifting is not a cardio discipline the generator covers', () => {
  const drafts = generatePlan(
    input({ block: block({ discipline: 'lifting', disciplines: ['lifting'], disciplineLevels: { lifting: 'intermediate' } }) })
  );
  expect(drafts).toEqual([]);
});

test('returns nothing when the target date has already passed', () => {
  expect(generatePlan(input({ today: '2026-06-01', block: block({ targetDate: '2026-01-01' }) }))).toEqual([]);
});

// Regression: this exact range (today before, targetDate after Nov 1,
// 2026 -- the fall-back DST transition in America/New_York) used to hang
// generatePlan forever (see dateUtils.test.ts for the root cause in
// addDaysIso). Confirmed in a real browser, not just a theory: the
// design-pass screenshot harness seeded a block seven weeks out and the
// page froze solid. Vitest's own per-test timeout is the safety net here
// if this regresses -- a clean test failure, not a hung CI run.
test('terminates for a block whose date range crosses a DST transition', () => {
  const drafts = generatePlan(
    input({ today: '2026-10-20', block: block({ targetDate: '2026-12-15' }) })
  );
  expect(drafts.length).toBeGreaterThan(0);
  expect(drafts.every((s) => s.date >= '2026-10-20' && s.date <= '2026-12-15')).toBe(true);
});
