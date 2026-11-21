import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './schema';
import {
  getAthlete, saveAthlete, createBlock, getBlock, getActiveBlock, startNewBlock,
  addTimedEffort, listEffortsForBlock, createPrescribedSession, createPrescribedSessions,
  listSessionsForBlock, getNextUnloggedSession, createSessionLog,
  listLogsForBlock, countCutShortReasons,
} from './repository';

beforeEach(async () => {
  await Promise.all([db.athlete.clear(), db.blocks.clear(), db.efforts.clear(), db.sessions.clear(), db.logs.clear()]);
});

test('saveAthlete/getAthlete round-trip the singleton', async () => {
  expect(await getAthlete()).toBeUndefined();
  await saveAthlete({
    daysPerWeek: 4,
    otherTraining: ['lifting', 'sport'],
    trainingWeekdays: [1, 3, 5, 6],
    otherTrainingWeekdays: [2, 4],
    unitSystem: 'imperial',
  });
  const athlete = await getAthlete();
  expect(athlete?.daysPerWeek).toBe(4);
  expect(athlete?.otherTraining).toEqual(['lifting', 'sport']);
  expect(athlete?.trainingWeekdays).toEqual([1, 3, 5, 6]);
  expect(athlete?.otherTrainingWeekdays).toEqual([2, 4]);
  expect(athlete?.unitSystem).toBe('imperial');
});

test('saveAthlete defaults the new fields when the caller omits them', async () => {
  await saveAthlete({ daysPerWeek: 3, otherTraining: ['none'] });
  const athlete = await getAthlete();
  expect(athlete?.trainingWeekdays).toBeNull();
  expect(athlete?.otherTrainingWeekdays).toBeNull();
  expect(athlete?.unitSystem).toBe('metric');
});

test('createBlock assigns id/createdAt/active status and getBlock retrieves it', async () => {
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1200,
    targetDate: '2026-11-01', baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  expect(block.id).toBeTruthy();
  expect(block.createdAt).toBeTruthy();
  expect(block.status).toBe('active');
  expect(await getBlock(block.id)).toEqual(block);
});

test('startNewBlock archives whatever was active and makes the new block active', async () => {
  expect(await getActiveBlock()).toBeUndefined();

  const first = await startNewBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1200,
    targetDate: '2026-11-01', baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  expect(first.status).toBe('active');
  expect((await getActiveBlock())?.id).toBe(first.id);

  const second = await startNewBlock({
    eventDistanceMeters: 10000, eventLabel: '10K', goalType: 'time', goalTimeSeconds: 2400,
    targetDate: '2027-01-01', baselineSource: 'unknown', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  expect(second.status).toBe('active');
  expect((await getActiveBlock())?.id).toBe(second.id);

  const archivedFirst = await getBlock(first.id);
  expect(archivedFirst?.status).toBe('archived');
});

test('addTimedEffort and listEffortsForBlock sort by date', async () => {
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1200,
    targetDate: '2026-11-01', baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  await addTimedEffort({ blockId: block.id, date: '2026-09-10', distanceMeters: 5000, timeSeconds: 1500, kind: 'checkpoint' });
  await addTimedEffort({ blockId: block.id, date: '2026-08-20', distanceMeters: 5000, timeSeconds: 1530, kind: 'baseline' });
  const efforts = await listEffortsForBlock(block.id);
  expect(efforts.map((e) => e.date)).toEqual(['2026-08-20', '2026-09-10']);
});

test('getNextUnloggedSession returns the soonest future session with no log', async () => {
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1200,
    targetDate: '2026-11-01', baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  const today = new Date().toISOString().slice(0, 10);
  const future1 = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const future2 = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const s1 = await createPrescribedSession({
    blockId: block.id, date: future1, type: 'easy', reps: null,
    targetPaceSecondsPerKm: null, targetRestSeconds: null, targetDurationSeconds: 1800, note: null,
  });
  await createPrescribedSession({
    blockId: block.id, date: future2, type: 'tempo', reps: null,
    targetPaceSecondsPerKm: null, targetRestSeconds: null, targetDurationSeconds: 1200, note: null,
  });

  const next = await getNextUnloggedSession(block.id);
  expect(next?.id).toBe(s1.id);

  await createSessionLog({
    sessionId: s1.id, blockId: block.id, date: today, actualReps: null,
    actualDurationSeconds: 1800, actualDistanceMeters: null, recoveryScore: null,
    sleepHours: null, temperatureC: null, rpe: null, note: null, cutShortReason: null,
  });
  const listedLogs = await listLogsForBlock(block.id);
  expect(listedLogs).toHaveLength(1);

  const nextAfterLog = await getNextUnloggedSession(block.id);
  expect(nextAfterLog?.date).toBe(future2);
});

test('createPrescribedSessions bulk-inserts a whole plan in one touchMeta', async () => {
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1200,
    targetDate: '2026-11-01', baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  const drafts = [
    { blockId: block.id, date: '2026-09-01', type: 'easy' as const, reps: null, targetPaceSecondsPerKm: null, targetRestSeconds: null, targetDurationSeconds: 1800, note: null },
    { blockId: block.id, date: '2026-09-03', type: 'tempo' as const, reps: null, targetPaceSecondsPerKm: null, targetRestSeconds: null, targetDurationSeconds: 1200, note: null },
  ];
  const created = await createPrescribedSessions(drafts);
  expect(created).toHaveLength(2);
  expect(new Set(created.map((s) => s.id)).size).toBe(2);

  const stored = await listSessionsForBlock(block.id);
  expect(stored.map((s) => s.date)).toEqual(['2026-09-01', '2026-09-03']);
});

test('countCutShortReasons tallies reasons across logs', async () => {
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1200,
    targetDate: '2026-11-01', baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  await createSessionLog({
    sessionId: null, blockId: block.id, date: '2026-08-20', actualReps: null,
    actualDurationSeconds: 900, actualDistanceMeters: null, recoveryScore: null,
    sleepHours: null, temperatureC: null, rpe: null, note: null, cutShortReason: 'heat',
  });
  await createSessionLog({
    sessionId: null, blockId: block.id, date: '2026-08-22', actualReps: null,
    actualDurationSeconds: 900, actualDistanceMeters: null, recoveryScore: null,
    sleepHours: null, temperatureC: null, rpe: null, note: null, cutShortReason: 'heat',
  });
  await createSessionLog({
    sessionId: null, blockId: block.id, date: '2026-08-24', actualReps: null,
    actualDurationSeconds: 900, actualDistanceMeters: null, recoveryScore: null,
    sleepHours: null, temperatureC: null, rpe: null, note: null, cutShortReason: 'fatigue',
  });
  const counts = await countCutShortReasons(block.id);
  expect(counts).toEqual({ heat: 2, fatigue: 1 });
});
