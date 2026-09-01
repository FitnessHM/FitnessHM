import { expect, test } from 'vitest';
import { timeAwareGreeting, startOfWeekIso, buildWeekView, computeInsight } from './home';
import type { PrescribedSession, SessionLog, TimedEffort, TrainingBlock } from '../db/schema';

test('timeAwareGreeting picks the right band for each hour', () => {
  expect(timeAwareGreeting(new Date(2026, 0, 1, 3))).toBe('Still up');
  expect(timeAwareGreeting(new Date(2026, 0, 1, 9))).toBe('Good morning');
  expect(timeAwareGreeting(new Date(2026, 0, 1, 14))).toBe('Good afternoon');
  expect(timeAwareGreeting(new Date(2026, 0, 1, 19))).toBe('Good evening');
  expect(timeAwareGreeting(new Date(2026, 0, 1, 22))).toBe('Good night');
});

test('startOfWeekIso finds Monday regardless of which day of the week is passed', () => {
  // 2026-01-05 is a Monday.
  expect(startOfWeekIso(new Date(2026, 0, 5))).toBe('2026-01-05'); // Monday itself
  expect(startOfWeekIso(new Date(2026, 0, 7))).toBe('2026-01-05'); // Wednesday
  expect(startOfWeekIso(new Date(2026, 0, 11))).toBe('2026-01-05'); // Sunday
});

function session(overrides: Partial<PrescribedSession>): PrescribedSession {
  return {
    id: overrides.id ?? 's1', blockId: 'b1', date: '2026-01-05', type: 'easy',
    reps: null, targetPaceSecondsPerKm: null, targetRestSeconds: null, targetDurationSeconds: null, note: null,
    ...overrides,
  };
}

test('buildWeekView marks a logged session as completed', () => {
  const today = new Date(2026, 0, 7); // Wednesday
  const s = session({ id: 's1', date: '2026-01-07', type: 'tempo' });
  const log: SessionLog = {
    id: 'l1', sessionId: 's1', blockId: 'b1', date: '2026-01-07', actualReps: null,
    actualDurationSeconds: 1200, actualDistanceMeters: null, recoveryScore: null,
    sleepHours: null, temperatureC: null, rpe: null, note: null, cutShortReason: null,
  };
  const days = buildWeekView([s], [log], today);
  const wednesday = days.find((d) => d.date === '2026-01-07');
  expect(wednesday?.state).toBe('completed');
  expect(wednesday?.isToday).toBe(true);
});

test('buildWeekView marks a past unlogged session as missed and a future one as future', () => {
  const today = new Date(2026, 0, 7); // Wednesday
  const monday = session({ id: 'mon', date: '2026-01-05', type: 'easy' });
  const friday = session({ id: 'fri', date: '2026-01-09', type: 'long_run' });
  const days = buildWeekView([monday, friday], [], today);
  expect(days.find((d) => d.date === '2026-01-05')?.state).toBe('missed');
  expect(days.find((d) => d.date === '2026-01-09')?.state).toBe('future');
});

test('buildWeekView treats a day with no session, or an explicit rest session, as rest', () => {
  const today = new Date(2026, 0, 7);
  const restDay = session({ id: 'rest', date: '2026-01-06', type: 'rest' });
  const days = buildWeekView([restDay], [], today);
  expect(days.find((d) => d.date === '2026-01-06')?.state).toBe('rest'); // explicit rest type
  expect(days.find((d) => d.date === '2026-01-05')?.state).toBe('rest'); // nothing scheduled
});

function block(overrides: Partial<TrainingBlock>): TrainingBlock {
  return {
    id: 'b1', eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1200,
    targetDate: '2026-03-01', baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
    status: 'active', createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('computeInsight returns null when there is nothing real to say', () => {
  const result = computeInsight({
    block: block({ goalTimeSeconds: null, goalType: 'finish' }),
    efforts: [], logs: [], sessions: [], currentBestEquivalentSeconds: null, today: new Date(2026, 0, 7),
  });
  expect(result).toBeNull();
});

test('computeInsight reports the live gap to goal pace when no easy-pace signal is available', () => {
  const b = block({ targetDate: '2026-02-06' }); // 30 days after Jan 7
  const result = computeInsight({
    block: b, efforts: [], logs: [], sessions: [],
    currentBestEquivalentSeconds: 1230, // 30s slower than the 1200s goal
    today: new Date(2026, 0, 7),
  });
  expect(result?.text).toContain('30 seconds off goal pace');
  expect(result?.text).toContain('30 days left');
});

test('computeInsight flags easy runs that are creeping faster than the easy-pace ceiling', () => {
  const b = block({});
  const baseline: TimedEffort = { id: 'e1', blockId: 'b1', date: '2026-01-01', distanceMeters: 5000, timeSeconds: 1200, kind: 'baseline' };
  const easySession1 = session({ id: 'e1s', date: '2026-01-05', type: 'easy' });
  const easySession2 = session({ id: 'e2s', date: '2026-01-06', type: 'easy' });
  // Easy zone ceiling (fastest allowed easy pace) at a 1200s/5000m baseline is
  // thresholdPace(240 s/km) * 1.16 = 278.4 s/km. Log both easy runs well
  // under that -- e.g. 250 s/km -- to trip the "too fast" branch.
  const logs: SessionLog[] = [
    { id: 'l1', sessionId: 'e1s', blockId: 'b1', date: '2026-01-05', actualReps: null, actualDurationSeconds: 1250, actualDistanceMeters: 5000, recoveryScore: null, sleepHours: null, temperatureC: null, rpe: null, note: null, cutShortReason: null },
    { id: 'l2', sessionId: 'e2s', blockId: 'b1', date: '2026-01-06', actualReps: null, actualDurationSeconds: 1250, actualDistanceMeters: 5000, recoveryScore: null, sleepHours: null, temperatureC: null, rpe: null, note: null, cutShortReason: null },
  ];
  const result = computeInsight({
    block: b, efforts: [baseline], logs, sessions: [easySession1, easySession2],
    currentBestEquivalentSeconds: 1200, today: new Date(2026, 0, 7),
  });
  expect(result?.text).toContain('easy-pace ceiling');
});
