import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { db } from '../../db/schema';
import { createBlock, addTimedEffort, createPrescribedSession } from '../../db/repository';
import BlockDashboard from './BlockDashboard';

beforeEach(async () => {
  await Promise.all([db.blocks.clear(), db.efforts.clear(), db.sessions.clear(), db.logs.clear()]);
});

test('shows goal, days remaining, gap to goal, and next session', async () => {
  const targetDate = new Date(Date.now() + 42 * 86400000).toISOString().slice(0, 10);
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1380,
    targetDate, baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  await addTimedEffort({ blockId: block.id, date: '2026-08-01', distanceMeters: 5000, timeSeconds: 1530, kind: 'baseline' });
  const sessionDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await createPrescribedSession({
    blockId: block.id, date: sessionDate, type: 'tempo', reps: null,
    targetPaceSecondsPerKm: null, targetRestSeconds: null, targetDurationSeconds: 1200, note: 'Builds threshold.',
  });

  render(<BlockDashboard blockId={block.id} onStartNewBlock={() => {}} />);

  expect(await screen.findByText(/5K/)).toBeInTheDocument();
  expect(await screen.findByText(/tempo/i)).toBeInTheDocument();
  expect(screen.getByText(/days remaining/i)).toBeInTheDocument();
});

test('renders safely when the block has an empty target date', async () => {
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1350,
    targetDate: '', baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  await addTimedEffort({ blockId: block.id, date: '2026-08-01', distanceMeters: 5000, timeSeconds: 1530, kind: 'baseline' });

  render(<BlockDashboard blockId={block.id} onStartNewBlock={() => {}} />);

  expect(await screen.findByText(/—\s*days remaining/)).toBeInTheDocument();
});

test('shows a feasibility warning for an unrealistic goal', async () => {
  const targetDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1350,
    targetDate, baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  await addTimedEffort({ blockId: block.id, date: '2026-08-01', distanceMeters: 5000, timeSeconds: 1530, kind: 'baseline' });

  render(<BlockDashboard blockId={block.id} onStartNewBlock={() => {}} />);

  expect(await screen.findByText(/adjust/i)).toBeInTheDocument();
});
