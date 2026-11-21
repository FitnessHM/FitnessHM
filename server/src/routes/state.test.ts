import { randomUUID } from 'crypto';
import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

// This route deletes and re-inserts all of a user's data on every PUT (see
// state.ts's comment above the transaction). Every dependency that could
// touch a real database or a real Clerk account is mocked below -- there is
// no DATABASE_URL or CLERK_SECRET_KEY read by this test, by construction,
// not by discipline. See server/src/test/fakeDb.ts for what the fake
// actually implements.

const TEST_USER_ID = 'user_test_round_trip';

vi.mock('../db/index.js', async () => {
  const { createFakeDb } = await import('../test/fakeDb.js');
  const schema = await import('../db/schema.js');
  const db = createFakeDb();
  // Mirrors the one FK cascade this route's GET/PUT logic depends on:
  // deleting a block deletes its efforts/sessions/logs too.
  db.addCascade(schema.blocks, 'id', schema.efforts, 'blockId');
  db.addCascade(schema.blocks, 'id', schema.prescribedSessions, 'blockId');
  db.addCascade(schema.blocks, 'id', schema.sessionLogs, 'blockId');
  return { db, pool: null, pingDb: async () => false };
});

vi.mock('../lib/users.js', async () => {
  // `db`'s static type (NeonDatabase | null, from the real, un-mocked
  // module signature) doesn't reflect what vi.mock actually swaps in at
  // runtime -- cast to the fake's real shape rather than fighting tsc here.
  const { db } = await import('../db/index.js');
  const { users } = await import('../db/schema.js');
  const { FakeDb } = await import('../test/fakeDb.js');
  const fakeDb = db as unknown as InstanceType<typeof FakeDb>;
  return {
    // Real ensureUser hits Clerk's API; this just makes sure a `users` row
    // exists, which is all the route handlers actually need from it here.
    ensureUser: async (userId: string) => {
      const rows = fakeDb.rowsOf(users);
      if (!rows.some((r: Record<string, unknown>) => r.id === userId)) {
        rows.push({ id: userId, email: `${userId}@example.com`, createdAt: new Date(), stateUpdatedAt: new Date(), updatedAt: new Date() });
      }
    },
  };
});

vi.mock('../lib/auth.js', () => ({
  getAuth: () => ({ userId: 'user_test_round_trip' }),
  requireUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    // Swapped for plain marker objects the fake db knows how to interpret
    // (see fakeDb.ts) -- this test never builds or executes real SQL.
    eq: (col: unknown, val: unknown) => ({ __fakeEq: true, col, val }),
    sql: ((..._args: unknown[]) => ({ __fakeNow: true })) as unknown as typeof actual.sql,
  };
});

const { stateRouter } = await import('./state.js');

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(stateRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function putState(payload: unknown) {
  return fetch(`${baseUrl}/api/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function getState() {
  return fetch(`${baseUrl}/api/state`);
}

test('a full payload round-trips PUT -> GET with every new athlete and session field intact', async () => {
  const blockId = randomUUID();
  const sessionId = randomUUID();
  const effortId = randomUUID();
  const logId = randomUUID();

  const payload = {
    updatedAt: new Date().toISOString(),
    athlete: {
      daysPerWeek: 4,
      otherTraining: ['lifting'],
      trainingWeekdays: [1, 3, 5, 6],
      otherTrainingWeekdays: [2, 4],
      unitSystem: 'imperial',
    },
    blocks: [
      {
        id: blockId,
        eventDistanceMeters: 5000,
        eventLabel: '5K',
        goalType: 'time',
        goalTimeSeconds: 1200,
        targetDate: '2026-12-01',
        baselineSource: 'known',
        raceMantra: null,
        targetSplitSecondsPerKm: null,
        status: 'active',
        createdAt: new Date().toISOString(),
        discipline: 'running',
        level: 'intermediate',
        disciplines: ['running'],
        disciplineLevels: { running: 'intermediate' },
        weeklyHours: null,
        sports: null,
      },
    ],
    efforts: [
      { id: effortId, blockId, date: '2026-09-01', distanceMeters: 5000, timeSeconds: 1300, kind: 'baseline' },
    ],
    sessions: [
      {
        id: sessionId,
        blockId,
        date: '2026-09-10',
        type: 'reps_800',
        discipline: 'running',
        intensity: 'hard',
        reps: 6,
        steps: [{ reps: 6, workMeters: 800, workSeconds: null, restSeconds: 90 }],
        targetPaceSecondsPerKm: 240,
        targetPaceSecondsPer100m: null,
        targetSplitSecondsPer500m: null,
        targetZoneLabel: null,
        targetRpeMin: 7,
        targetRpeMax: 9,
        targetRestSeconds: 90,
        targetDurationSeconds: 1800,
        targetDistanceMeters: 4800,
        note: 'Sharpens leg speed before the taper.',
        source: 'generated',
        edited: true,
      },
    ],
    logs: [
      {
        id: logId,
        sessionId,
        blockId,
        date: '2026-09-10',
        actualReps: 6,
        actualDurationSeconds: 1750,
        actualDistanceMeters: 4800,
        recoveryScore: 4,
        sleepHours: 7.5,
        temperatureC: 18,
        rpe: 8,
        note: 'Felt strong.',
        cutShortReason: null,
        discipline: 'running',
        stravaActivityId: null,
      },
    ],
  };

  const putRes = await putState(payload);
  expect(putRes.status).toBe(200);

  const getRes = await getState();
  expect(getRes.status).toBe(200);
  const body = (await getRes.json()) as Record<string, any>;

  // The bug this test guards against: athlete's GET response used to be
  // hand-built as `{ id: 1, daysPerWeek, otherTraining }`, silently
  // dropping every other field regardless of what was stored.
  expect(body.athlete).toEqual({
    id: 1,
    daysPerWeek: 4,
    otherTraining: ['lifting'],
    trainingWeekdays: [1, 3, 5, 6],
    otherTrainingWeekdays: [2, 4],
    unitSystem: 'imperial',
  });

  expect(body.sessions).toHaveLength(1);
  expect(body.sessions[0]).toMatchObject({
    id: sessionId,
    blockId,
    discipline: 'running',
    intensity: 'hard',
    steps: [{ reps: 6, workMeters: 800, workSeconds: null, restSeconds: 90 }],
    targetPaceSecondsPerKm: 240,
    targetRpeMin: 7,
    targetRpeMax: 9,
    targetDistanceMeters: 4800,
    source: 'generated',
    edited: true,
  });
  // Rows never carry the server-internal columns back to the client.
  expect(body.sessions[0]).not.toHaveProperty('userId');
  expect(body.sessions[0]).not.toHaveProperty('updatedAt');

  expect(body.blocks).toHaveLength(1);
  expect(body.efforts).toHaveLength(1);
  expect(body.logs).toHaveLength(1);
});

test('athlete fields the payload omits come back as null/metric defaults, not dropped keys', async () => {
  await putState({
    updatedAt: new Date().toISOString(),
    athlete: { daysPerWeek: 3, otherTraining: ['none'] },
    blocks: [],
    efforts: [],
    sessions: [],
    logs: [],
  });

  const body = (await (await getState()).json()) as Record<string, any>;
  expect(body.athlete).toEqual({
    id: 1,
    daysPerWeek: 3,
    otherTraining: ['none'],
    trainingWeekdays: null,
    otherTrainingWeekdays: null,
    unitSystem: 'metric',
  });
});
