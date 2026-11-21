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
    source: 'generated', edited: false,
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
  // A real generated (non-today) session exists -- otherwise this reads as
  // "no plan generated yet" (see the "Build my plan" tests below), not
  // "rest day."
  await createPrescribedSession({
    blockId: block.id, date: isoDateLocal(new Date(Date.now() + 86400000)), type: 'easy', reps: null,
    targetPaceSecondsPerKm: null, targetRestSeconds: null, targetDurationSeconds: 1800, note: null,
    source: 'generated', edited: false,
  });

  render(<HomeScreen blockId={block.id} onStartNewBlock={noop} onLogSession={noop} onOpenSettings={noop} />);

  expect(await screen.findByText(/nothing scheduled today/i)).toBeInTheDocument();
  expect(screen.getByText(/nothing logged yet/i)).toBeInTheDocument();
});

test('shows a "Build my plan" card instead of today\'s session when the block has no generated sessions', async () => {
  const targetDate = isoDateLocal(new Date(Date.now() + 42 * 86400000));
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'finish', goalTimeSeconds: null,
    targetDate, baselineSource: 'unknown', raceMantra: null, targetSplitSecondsPerKm: null,
  });

  render(<HomeScreen blockId={block.id} onStartNewBlock={noop} onLogSession={noop} onOpenSettings={noop} />);

  expect(await screen.findByText(/no plan yet/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /build my plan/i })).toBeInTheDocument();
  expect(screen.queryByText(/nothing scheduled today/i)).not.toBeInTheDocument();
});

test('shows "Build my plan" for a pre-generator block too, even though it has one legacy session', async () => {
  // Reproduces a real account's state: a block synced in from before the
  // plan generator existed, carrying phase 1's old hand-seeded time_trial
  // (no `source` field -- it predates that column). `sessions.length` is 1
  // here, not 0 -- the bug was keying the Build-my-plan check off a plain
  // count instead of "does a real generated plan exist."
  const targetDate = isoDateLocal(new Date(Date.now() + 42 * 86400000));
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'finish', goalTimeSeconds: null,
    targetDate, baselineSource: 'unknown', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  await createPrescribedSession({
    blockId: block.id, date: isoDateLocal(new Date(Date.now() + 7 * 86400000)), type: 'time_trial', reps: null,
    targetPaceSecondsPerKm: null, targetRestSeconds: null, targetDurationSeconds: null,
    note: 'A baseline test tells us where you are really starting from.',
  });

  render(<HomeScreen blockId={block.id} onStartNewBlock={noop} onLogSession={noop} onOpenSettings={noop} />);

  expect(await screen.findByText(/no plan yet/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /build my plan/i })).toBeInTheDocument();
});
