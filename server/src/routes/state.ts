import { eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { athletes, blocks, efforts, prescribedSessions, sessionLogs, users } from '../db/schema.js';
import { getAuth, requireUser } from '../lib/auth.js';
import { ensureUser } from '../lib/users.js';

const athleteSchema = z.object({
  daysPerWeek: z.number().int(),
  otherTraining: z.array(z.enum(['lifting', 'sport', 'classes', 'none'])),
});

const blockSchema = z.object({
  id: z.string().uuid(),
  eventDistanceMeters: z.number(),
  eventLabel: z.string(),
  goalType: z.enum(['time', 'finish', 'consistency']),
  goalTimeSeconds: z.number().nullable(),
  targetDate: z.string(),
  baselineSource: z.enum(['known', 'estimate', 'unknown']),
  raceMantra: z.string().nullable(),
  targetSplitSecondsPerKm: z.number().nullable(),
  status: z.enum(['active', 'archived']),
  createdAt: z.string(),
  discipline: z.string().nullish(),
  level: z.string().nullish(),
  disciplines: z.array(z.string()).nullish(),
  disciplineLevels: z.record(z.string(), z.string()).nullish(),
  weeklyHours: z.number().nullish(),
  sports: z.array(z.string()).nullish(),
});

const effortSchema = z.object({
  id: z.string().uuid(),
  blockId: z.string().uuid(),
  date: z.string(),
  distanceMeters: z.number(),
  timeSeconds: z.number(),
  kind: z.enum(['baseline', 'checkpoint', 'race']),
});

const sessionSchema = z.object({
  id: z.string().uuid(),
  blockId: z.string().uuid(),
  date: z.string(),
  type: z.enum([
    'easy', 'long_run', 'tempo', 'threshold', 'vo2max',
    'reps_short', 'reps_800', 'fartlek', 'hills', 'strides',
    'time_trial', 'cross_training', 'rest',
  ]),
  reps: z.number().nullable(),
  targetPaceSecondsPerKm: z.number().nullable(),
  targetRestSeconds: z.number().nullable(),
  targetDurationSeconds: z.number().nullable(),
  note: z.string().nullable(),
});

const logSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid().nullable(),
  blockId: z.string().uuid(),
  date: z.string(),
  actualReps: z.number().nullable(),
  actualDurationSeconds: z.number().nullable(),
  actualDistanceMeters: z.number().nullable(),
  recoveryScore: z.number().nullable(),
  sleepHours: z.number().nullable(),
  temperatureC: z.number().nullable(),
  rpe: z.number().nullable(),
  note: z.string().nullable(),
  cutShortReason: z.enum(['heat', 'fatigue', 'pain', 'time', 'life']).nullable(),
  discipline: z.string().nullish(),
  stravaActivityId: z.number().nullish(),
});

const statePayloadSchema = z.object({
  updatedAt: z.string(),
  athlete: athleteSchema.nullable(),
  blocks: z.array(blockSchema),
  efforts: z.array(effortSchema),
  sessions: z.array(sessionSchema),
  logs: z.array(logSchema),
});

function omit<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> {
  const clone = { ...obj };
  for (const k of keys) delete clone[k];
  return clone;
}

export const stateRouter = Router();

stateRouter.get('/api/state', requireUser, async (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'db_not_configured' });
    return;
  }
  const { userId } = getAuth(req);
  await ensureUser(userId!);

  const [athleteRow] = await db.select().from(athletes).where(eq(athletes.userId, userId!));
  const blockRows = await db.select().from(blocks).where(eq(blocks.userId, userId!));

  if (!athleteRow && blockRows.length === 0) {
    res.json(null);
    return;
  }

  const [[user], effortRows, sessionRows, logRows] = await Promise.all([
    db.select({ stateUpdatedAt: users.stateUpdatedAt }).from(users).where(eq(users.id, userId!)),
    db.select().from(efforts).where(eq(efforts.userId, userId!)),
    db.select().from(prescribedSessions).where(eq(prescribedSessions.userId, userId!)),
    db.select().from(sessionLogs).where(eq(sessionLogs.userId, userId!)),
  ]);

  res.json({
    updatedAt: user!.stateUpdatedAt.toISOString(),
    athlete: athleteRow ? { id: 1, daysPerWeek: athleteRow.daysPerWeek, otherTraining: athleteRow.otherTraining } : null,
    blocks: blockRows.map((r) => omit(r, ['userId', 'updatedAt'])),
    efforts: effortRows.map((r) => omit(r, ['userId', 'updatedAt'])),
    sessions: sessionRows.map((r) => omit(r, ['userId', 'updatedAt'])),
    logs: logRows.map((r) => omit(r, ['userId', 'updatedAt'])),
  });
});

stateRouter.put('/api/state', requireUser, async (req, res) => {
  if (!db) {
    res.status(500).json({ error: 'db_not_configured' });
    return;
  }
  const parsed = statePayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
    return;
  }
  const payload = parsed.data;
  const { userId } = getAuth(req);
  const uid = userId!;
  await ensureUser(uid);

  // Whole-payload last-write-wins, gated on a dedicated per-user watermark
  // (not max(row.updated_at) — that can't detect a deletion, which would let
  // a stale client push resurrect something a Strava webhook just removed).
  const [athleteRow] = await db.select({ userId: athletes.userId }).from(athletes).where(eq(athletes.userId, uid));
  const blockRows = await db.select({ id: blocks.id }).from(blocks).where(eq(blocks.userId, uid));
  const hasExisting = athleteRow != null || blockRows.length > 0;

  if (hasExisting) {
    const [user] = await db.select({ stateUpdatedAt: users.stateUpdatedAt }).from(users).where(eq(users.id, uid));
    if (new Date(payload.updatedAt) < user!.stateUpdatedAt) {
      res.status(409).json({ error: 'stale', serverUpdatedAt: user!.stateUpdatedAt.toISOString() });
      return;
    }
  }

  const updatedAt = await db.transaction(async (tx) => {
    // Deleting blocks cascades to efforts/prescribed_sessions/session_logs.
    await tx.delete(blocks).where(eq(blocks.userId, uid));

    if (payload.athlete) {
      await tx
        .insert(athletes)
        .values({ userId: uid, daysPerWeek: payload.athlete.daysPerWeek, otherTraining: payload.athlete.otherTraining })
        .onConflictDoUpdate({
          target: athletes.userId,
          set: {
            daysPerWeek: payload.athlete.daysPerWeek,
            otherTraining: payload.athlete.otherTraining,
            updatedAt: sql`now()`,
          },
        });
    } else {
      await tx.delete(athletes).where(eq(athletes.userId, uid));
    }

    if (payload.blocks.length > 0) {
      await tx.insert(blocks).values(payload.blocks.map((b) => ({ ...b, userId: uid })));
    }
    if (payload.efforts.length > 0) {
      await tx.insert(efforts).values(payload.efforts.map((e) => ({ ...e, userId: uid })));
    }
    if (payload.sessions.length > 0) {
      await tx.insert(prescribedSessions).values(payload.sessions.map((s) => ({ ...s, userId: uid })));
    }
    if (payload.logs.length > 0) {
      await tx.insert(sessionLogs).values(payload.logs.map((l) => ({ ...l, userId: uid })));
    }

    const [updated] = await tx
      .update(users)
      .set({ stateUpdatedAt: sql`now()` })
      .where(eq(users.id, uid))
      .returning({ stateUpdatedAt: users.stateUpdatedAt });
    return updated!.stateUpdatedAt;
  });

  res.json({ updatedAt: updatedAt.toISOString() });
});
