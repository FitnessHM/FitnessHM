import { db } from './schema';
import { createBlock, addTimedEffort, createPrescribedSession } from './repository';
import { isoDateLocal } from '../lib/dates';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seedExampleBlockIfEmpty(): Promise<void> {
  // One transaction so the count check and the inserts are atomic: React
  // StrictMode's double-invoked effect (and two open tabs) would otherwise
  // both see an empty table and each seed a block.
  await db.transaction('rw', db.blocks, db.efforts, db.sessions, db.meta, async () => {
    const blockCount = await db.blocks.count();
    if (blockCount > 0) return;

    const today = new Date();
    const targetDate = new Date(today.getTime() + 70 * DAY_MS);

    const block = await createBlock({
      eventDistanceMeters: 5000,
      eventLabel: '5K',
      goalType: 'time',
      goalTimeSeconds: 23 * 60,
      targetDate: isoDateLocal(targetDate),
      baselineSource: 'known',
      raceMantra: null,
      targetSplitSecondsPerKm: null,
    });

    await addTimedEffort({
      blockId: block.id,
      date: isoDateLocal(new Date(today.getTime() - 7 * DAY_MS)),
      distanceMeters: 5000,
      timeSeconds: 25 * 60 + 30,
      kind: 'baseline',
    });

    await createPrescribedSession({
      blockId: block.id,
      date: isoDateLocal(new Date(today.getTime() + 1 * DAY_MS)),
      type: 'easy',
      reps: null, targetPaceSecondsPerKm: null, targetRestSeconds: null,
      targetDurationSeconds: 30 * 60,
      note: 'Easy pace builds your aerobic base without adding fatigue.',
    });
    await createPrescribedSession({
      blockId: block.id,
      date: isoDateLocal(new Date(today.getTime() + 3 * DAY_MS)),
      type: 'tempo',
      reps: null, targetPaceSecondsPerKm: 5 * 60, targetRestSeconds: null,
      targetDurationSeconds: 20 * 60,
      note: 'Tempo pace raises the pace you can sustain before fatigue piles up.',
    });
    await createPrescribedSession({
      blockId: block.id,
      date: isoDateLocal(new Date(today.getTime() + 5 * DAY_MS)),
      type: 'long_run',
      reps: null, targetPaceSecondsPerKm: null, targetRestSeconds: null,
      targetDurationSeconds: 50 * 60,
      note: 'Long runs build the endurance base everything else is built on.',
    });
    await createPrescribedSession({
      blockId: block.id,
      date: isoDateLocal(new Date(today.getTime() + 10 * DAY_MS)),
      type: 'time_trial',
      reps: null, targetPaceSecondsPerKm: null, targetRestSeconds: null, targetDurationSeconds: null,
      note: 'Checkpoint test — measures real progress against the goal.',
    });
  });
}
