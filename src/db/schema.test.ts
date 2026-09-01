import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './schema';

beforeEach(async () => {
  await db.athlete.clear();
  await db.blocks.clear();
  await db.efforts.clear();
  await db.sessions.clear();
  await db.logs.clear();
});

test('all tables exist and accept typed rows', async () => {
  await db.athlete.put({ id: 1, daysPerWeek: 3, otherTraining: ['lifting'] });
  const block = {
    id: 'b1',
    eventDistanceMeters: 5000,
    eventLabel: '5K',
    goalType: 'time' as const,
    goalTimeSeconds: 1200,
    targetDate: '2026-11-01',
    baselineSource: 'known' as const,
    raceMantra: null,
    targetSplitSecondsPerKm: null,
    status: 'active' as const,
    createdAt: '2026-08-30T00:00:00.000Z',
  };
  await db.blocks.put(block);

  const savedAthlete = await db.athlete.get(1);
  const savedBlock = await db.blocks.get('b1');

  expect(savedAthlete?.daysPerWeek).toBe(3);
  expect(savedBlock?.eventLabel).toBe('5K');
});

test('efforts and sessions are queryable by blockId', async () => {
  await db.efforts.put({
    id: 'e1', blockId: 'b1', date: '2026-08-23',
    distanceMeters: 5000, timeSeconds: 1530, kind: 'baseline',
  });
  const efforts = await db.efforts.where('blockId').equals('b1').toArray();
  expect(efforts).toHaveLength(1);
});
