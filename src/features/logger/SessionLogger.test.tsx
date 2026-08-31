// src/features/logger/SessionLogger.test.tsx
import 'fake-indexeddb/auto';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { db } from '../../db/schema';
import { createBlock, createPrescribedSession } from '../../db/repository';
import SessionLogger from './SessionLogger';

beforeEach(async () => {
  await Promise.all([db.blocks.clear(), db.sessions.clear(), db.logs.clear()]);
});

test('logging a partial completion saves actuals with no error styling', async () => {
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1200,
    targetDate: '2026-11-01', baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  const session = await createPrescribedSession({
    blockId: block.id, date: '2026-09-01', type: 'reps_800', reps: 5,
    targetPaceSecondsPerKm: null, targetRestSeconds: 90, targetDurationSeconds: null, note: null,
  });

  const onSaved = vi.fn();
  const user = userEvent.setup();
  render(<SessionLogger blockId={block.id} session={session} onSaved={onSaved} />);

  expect(screen.getByText(/5 x/i)).toBeInTheDocument(); // prescribed shown

  fireEvent.change(screen.getByLabelText(/reps completed/i), { target: { value: '3.5' } });
  await user.selectOptions(screen.getByLabelText(/cut short reason/i), 'fatigue');
  await user.click(screen.getByRole('button', { name: /save/i }));

  const logs = await db.logs.where('blockId').equals(block.id).toArray();
  expect(logs).toHaveLength(1);
  expect(logs[0].actualReps).toBe(3.5);
  expect(logs[0].cutShortReason).toBe('fatigue');
  expect(onSaved).toHaveBeenCalled();

  // No fail/error styling class present anywhere in the rendered form
  const { container } = render(<SessionLogger blockId={block.id} session={session} onSaved={onSaved} />);
  expect(container.querySelector('.text-red-500, .bg-red-500, .border-red-500')).toBeNull();
});

test('adhoc logging works with no prescribed session', async () => {
  const block = await createBlock({
    eventDistanceMeters: 5000, eventLabel: '5K', goalType: 'time', goalTimeSeconds: 1200,
    targetDate: '2026-11-01', baselineSource: 'known', raceMantra: null, targetSplitSecondsPerKm: null,
  });
  const onSaved = vi.fn();
  const user = userEvent.setup();
  render(<SessionLogger blockId={block.id} session={null} onSaved={onSaved} />);

  fireEvent.change(screen.getByLabelText(/duration/i), { target: { value: '1800' } });
  await user.click(screen.getByRole('button', { name: /save/i }));

  const logs = await db.logs.where('blockId').equals(block.id).toArray();
  expect(logs).toHaveLength(1);
  expect(logs[0].sessionId).toBeNull();
  expect(logs[0].actualDurationSeconds).toBe(1800);
});
