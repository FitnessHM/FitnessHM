// src/features/onboarding/OnboardingWizard.test.tsx
import 'fake-indexeddb/auto';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { db } from '../../db/schema';
import OnboardingWizard from './OnboardingWizard';

beforeEach(async () => {
  await Promise.all([db.athlete.clear(), db.blocks.clear(), db.efforts.clear(), db.sessions.clear()]);
});

test('completing the wizard with a known baseline creates athlete, block, and effort', async () => {
  const onComplete = vi.fn();
  const user = userEvent.setup();
  render(<OnboardingWizard onComplete={onComplete} />);

  // Step 1: event + goal
  await user.selectOptions(screen.getByLabelText(/event/i), '5K');
  await user.selectOptions(screen.getByLabelText(/goal type/i), 'time');
  await user.type(screen.getByLabelText(/goal time/i), '23:00');
  await user.click(screen.getByRole('button', { name: /next/i }));

  // Step 2: target date
  fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-11-01' } });
  await user.click(screen.getByRole('button', { name: /next/i }));

  // Step 3: baseline
  await user.selectOptions(screen.getByLabelText(/baseline/i), 'known');
  await user.type(screen.getByLabelText(/baseline time/i), '25:30');
  await user.click(screen.getByRole('button', { name: /next/i }));

  // Step 4: days per week
  fireEvent.change(screen.getByLabelText(/days per week/i), { target: { value: '4' } });
  await user.click(screen.getByRole('button', { name: /next/i }));

  // Step 5: other training
  await user.click(screen.getByLabelText(/lifting/i));
  await user.click(screen.getByRole('button', { name: /finish/i }));

  const blocks = await db.blocks.toArray();
  expect(blocks).toHaveLength(1);
  expect(blocks[0].goalTimeSeconds).toBe(23 * 60);

  const athlete = await db.athlete.get(1);
  expect(athlete?.daysPerWeek).toBe(4);
  expect(athlete?.otherTraining).toEqual(['lifting']);

  const efforts = await db.efforts.where('blockId').equals(blocks[0].id).toArray();
  expect(efforts).toHaveLength(1);
  expect(efforts[0].timeSeconds).toBe(25 * 60 + 30);

  expect(onComplete).toHaveBeenCalledWith(blocks[0].id);
});

test('choosing "no idea" baseline creates a week-1 time trial instead of an effort', async () => {
  const onComplete = vi.fn();
  const user = userEvent.setup();
  render(<OnboardingWizard onComplete={onComplete} />);

  await user.selectOptions(screen.getByLabelText(/event/i), '5K');
  await user.selectOptions(screen.getByLabelText(/goal type/i), 'finish');
  await user.click(screen.getByRole('button', { name: /next/i }));

  fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-11-01' } });
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.selectOptions(screen.getByLabelText(/baseline/i), 'unknown');
  await user.click(screen.getByRole('button', { name: /next/i }));

  fireEvent.change(screen.getByLabelText(/days per week/i), { target: { value: '3' } });
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.click(screen.getByRole('button', { name: /finish/i }));

  const blocks = await db.blocks.toArray();
  const sessions = await db.sessions.where('blockId').equals(blocks[0].id).toArray();
  expect(sessions).toHaveLength(1);
  expect(sessions[0].type).toBe('time_trial');
});
