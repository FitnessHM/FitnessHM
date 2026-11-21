import { db } from './schema';
import type {
  Athlete, TrainingBlock, TimedEffort, PrescribedSession, SessionLog, OtherTraining, Weekday, UnitSystem,
} from './schema';
import { todayIso } from '../lib/dates';

// Bumps db.meta inside the caller's transaction. db/sync.ts hooks this table
// to trigger a debounced push, so every mutator below runs it in the same
// transaction as its actual write.
async function touchMeta(): Promise<void> {
  await db.meta.put({ id: 1, lastModifiedAt: new Date().toISOString() });
}

export async function getAthlete(): Promise<Athlete | undefined> {
  return db.athlete.get(1);
}

export interface SaveAthleteInput {
  daysPerWeek: number;
  otherTraining: OtherTraining[];
  // Both optional, defaulting to null -- callers that haven't been updated
  // for the weekday pickers yet (there are none left after this phase, but
  // kept optional for the same reason every other new field on this object
  // is) fall through to the generator's own `defaultTrainingWeekdays`.
  trainingWeekdays?: Weekday[] | null;
  otherTrainingWeekdays?: Weekday[] | null;
  unitSystem?: UnitSystem;
}

export async function saveAthlete(input: SaveAthleteInput): Promise<Athlete> {
  const athlete: Athlete = {
    id: 1,
    daysPerWeek: input.daysPerWeek,
    otherTraining: input.otherTraining,
    trainingWeekdays: input.trainingWeekdays ?? null,
    otherTrainingWeekdays: input.otherTrainingWeekdays ?? null,
    unitSystem: input.unitSystem ?? 'metric',
  };
  await db.transaction('rw', db.athlete, db.meta, async () => {
    await db.athlete.put(athlete);
    await touchMeta();
  });
  return athlete;
}

export async function createBlock(
  input: Omit<TrainingBlock, 'id' | 'createdAt' | 'status'>
): Promise<TrainingBlock> {
  const block: TrainingBlock = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'active' };
  await db.transaction('rw', db.blocks, db.meta, async () => {
    await db.blocks.add(block);
    await touchMeta();
  });
  return block;
}

export async function getBlock(id: string): Promise<TrainingBlock | undefined> {
  return db.blocks.get(id);
}

export async function getActiveBlock(): Promise<TrainingBlock | undefined> {
  return db.blocks.where('status').equals('active').first();
}

// Archives whatever block is currently active (if any) and creates the new
// one as active, in one transaction, so there's never a moment with zero or
// two active blocks. Use this for anything the user initiates as "a new
// block" (onboarding); use createBlock directly only when there's no
// existing block to worry about (e.g. the one-time demo seed).
export async function startNewBlock(
  input: Omit<TrainingBlock, 'id' | 'createdAt' | 'status'>
): Promise<TrainingBlock> {
  return db.transaction('rw', db.blocks, db.meta, async () => {
    const current = await getActiveBlock();
    if (current) {
      await db.blocks.update(current.id, { status: 'archived' });
    }
    return createBlock(input);
  });
}

export async function addTimedEffort(input: Omit<TimedEffort, 'id'>): Promise<TimedEffort> {
  const effort: TimedEffort = { ...input, id: crypto.randomUUID() };
  await db.transaction('rw', db.efforts, db.meta, async () => {
    await db.efforts.add(effort);
    await touchMeta();
  });
  return effort;
}

export async function listEffortsForBlock(blockId: string): Promise<TimedEffort[]> {
  return db.efforts.where('blockId').equals(blockId).sortBy('date');
}

export async function createPrescribedSession(input: Omit<PrescribedSession, 'id'>): Promise<PrescribedSession> {
  const session: PrescribedSession = { ...input, id: crypto.randomUUID() };
  await db.transaction('rw', db.sessions, db.meta, async () => {
    await db.sessions.add(session);
    await touchMeta();
  });
  return session;
}

// Persists a whole generated plan in one go -- one touchMeta, not one per
// session. Used by onboarding's finish step and Home's "Build my plan".
export async function createPrescribedSessions(inputs: Omit<PrescribedSession, 'id'>[]): Promise<PrescribedSession[]> {
  const sessions: PrescribedSession[] = inputs.map((input) => ({ ...input, id: crypto.randomUUID() }));
  await db.transaction('rw', db.sessions, db.meta, async () => {
    await db.sessions.bulkAdd(sessions);
    await touchMeta();
  });
  return sessions;
}

export async function listSessionsForBlock(blockId: string): Promise<PrescribedSession[]> {
  return db.sessions.where('blockId').equals(blockId).sortBy('date');
}

export async function getNextUnloggedSession(blockId: string): Promise<PrescribedSession | undefined> {
  const sessions = await listSessionsForBlock(blockId);
  const logs = await listLogsForBlock(blockId);
  const loggedSessionIds = new Set(logs.map((l) => l.sessionId).filter((id): id is string => id !== null));
  const today = todayIso();
  return sessions.find((s) => !loggedSessionIds.has(s.id) && s.date >= today);
}

export async function createSessionLog(input: Omit<SessionLog, 'id'>): Promise<SessionLog> {
  const log: SessionLog = { ...input, id: crypto.randomUUID() };
  await db.transaction('rw', db.logs, db.meta, async () => {
    await db.logs.add(log);
    await touchMeta();
  });
  return log;
}

export async function listLogsForBlock(blockId: string): Promise<SessionLog[]> {
  return db.logs.where('blockId').equals(blockId).sortBy('date');
}

export async function countCutShortReasons(blockId: string): Promise<Record<string, number>> {
  const logs = await listLogsForBlock(blockId);
  const counts: Record<string, number> = {};
  for (const log of logs) {
    if (log.cutShortReason) {
      counts[log.cutShortReason] = (counts[log.cutShortReason] ?? 0) + 1;
    }
  }
  return counts;
}
