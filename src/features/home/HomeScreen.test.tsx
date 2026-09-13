import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { db } from '../../db/schema';
import { createBlock, addTimedEffort, createPrescribedSession } from '../../db/repository';
import { isoDateLocal } from '../../lib/dates';
import HomeScreen from './HomeScreen';

beforeEach(async () => {
  await Promise.all([db.blocks.clear(), db.efforts.clear(), db.sessions.clear(), db.logs.clear()]);
});

const noop = vi.fn();

test('shows the block name, days remaining, and today\'s prescribed session', async () => {
  const targetDate = isoDateLocal(new Date(Date.now() + 42 * 86400000));
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1380,
    targetDate, baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  await addTimedEffort({ blockId: block.id, date: '2026-08-01', distanceMeters: 5000, timeSeconds: 1530, kind: 'baseline' });
  await createPrescribedSession({
    blockId: block.id, date: isoDateLocal(new Date()), type: 'tempo', reps: null,
    targetPaceSecondsPerKm: null, targetRestSeconds: null, targetDurationSeconds: 1200, note: 'Builds threshold.',
  });

  render(<HomeScreen blockId={block.id} onStartNewBlock={noop} onLogSession={noop} onOpenSettings={noop} />);

  expect(await screen.findByText(/5K/)).toBeInTheDocument();
  expect(screen.getAllByText(/days left/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/tempo/i).length).toBeGreaterThan(0);
});

test('shows a TBD current best when the block has no efforts yet', async () => {
  const targetDate = isoDateLocal(new Date(Date.now() + 42 * 86400000));
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1380,
    targetDate, baselineSource: 'unknown', raceMantra: null, targetSplitSecondsPerKm: null,
  });

  render(<HomeScreen blockId={block.id} onStartNewBlock={noop} onLogSession={noop} onOpenSettings={noop} />);

  expect(await screen.findByText(/current best: TBD — take your baseline test/i)).toBeInTheDocument();
});

test('renders safely when the block has an empty target date', async () => {
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1350,
    targetDate: '', baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  await addTimedEffort({ blockId: block.id, date: '2026-08-01', distanceMeters: 5000, timeSeconds: 1530, kind: 'baseline' });

  render(<HomeScreen blockId={block.id} onStartNewBlock={noop} onLogSession={noop} onOpenSettings={noop} />);

  expect(await screen.findByText(/no target date set/i)).toBeInTheDocument();
});

test('shows a feasibility warning for an unrealistic goal', async () => {
  const targetDate = isoDateLocal(new Date(Date.now() + 14 * 86400000));
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1350,
    targetDate, baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  await addTimedEffort({ blockId: block.id, date: '2026-08-01', distanceMeters: 5000, timeSeconds: 1530, kind: 'baseline' });

  render(<HomeScreen blockId={block.id} onStartNewBlock={noop} onLogSession={noop} onOpenSettings={noop} />);

  await screen.findByText(/5K/);
  expect(screen.getByText(/tight timeline/i)).toBeInTheDocument();
});

test('picks the fastest effort as current best, not the most recently logged one', async () => {
  const targetDate = isoDateLocal(new Date(Date.now() + 42 * 86400000));
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1380,
    targetDate, baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  await addTimedEffort({ blockId: block.id, date: '2026-08-01', distanceMeters: 5000, timeSeconds: 1530, kind: 'baseline' });
  await addTimedEffort({ blockId: block.id, date: '2026-09-01', distanceMeters: 5000, timeSeconds: 1600, kind: 'checkpoint' });

  render(<HomeScreen blockId={block.id} onStartNewBlock={noop} onLogSession={noop} onOpenSettings={noop} />);

  // 1530s = 25:30, the faster of the two -- should win over the later 1600s.
  expect(await screen.findByText(/25:30/)).toBeInTheDocument();
});

test('shows a rest-day state and an empty recent list when there is nothing logged', async () => {
  const targetDate = isoDateLocal(new Date(Date.now() + 42 * 86400000));
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'finish', goalTimeSeconds: null,
    targetDate, baselineSource: 'unknown', raceMantra: null, targetSplitSecondsPerKm: null,
  });

  render(<HomeScreen blockId={block.id} onStartNewBlock={noop} onLogSession={noop} onOpenSettings={noop} />);

  expect(await screen.findByText(/nothing scheduled today/i)).toBeInTheDocument();
  expect(screen.getByText(/nothing logged yet/i)).toBeInTheDocument();
});
