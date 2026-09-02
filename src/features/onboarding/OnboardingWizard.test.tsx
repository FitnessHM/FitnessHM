// src/features/onboarding/OnboardingWizard.test.tsx
import 'fake-indexeddb/auto';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { db } from '../../db/schema';
import OnboardingWizard from './OnboardingWizard';

beforeEach(async () => {
  await Promise.all([db.athlete.clear(), db.blocks.clear(), db.efforts.clear(), db.sessions.clear()]);
});

// Steps 1-2 of the new flow: pick a single discipline, then a level. Leaves
// the wizard on the Event step.
async function pickDisciplineAndLevel(user: UserEvent, discipline = 'Running', level = 'Intermediate') {
  await user.click(screen.getByRole('radio', { name: discipline }));
  await user.click(screen.getByRole('button', { name: /next/i }));
  await user.click(await screen.findByRole('radio', { name: `${discipline} ${level}` }));
  await user.click(screen.getByRole('button', { name: /next/i }));
}

test('completing the wizard with a known baseline creates athlete, block, and effort', async () => {
  const onComplete = vi.fn();
  const user = userEvent.setup();
  render(<OnboardingWizard onComplete={onComplete} />);

  await pickDisciplineAndLevel(user, 'Running', 'Intermediate');

  // Step 3: event + goal
  await user.selectOptions(await screen.findByLabelText('event'), '5K');
  await user.selectOptions(screen.getByLabelText(/goal type/i), 'time');
  await user.type(screen.getByLabelText(/goal time/i), '23:00');
  await user.click(screen.getByRole('button', { name: /next/i }));

  // Step 4: target date
  fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-11-01' } });
  await user.click(screen.getByRole('button', { name: /next/i }));

  // Step 5: baseline
  await user.selectOptions(screen.getByLabelText('baseline'), 'known');
  await user.type(screen.getByLabelText(/baseline time/i), '25:30');
  await user.click(screen.getByRole('button', { name: /next/i }));

  // Step 6: days per week + other training
  fireEvent.change(screen.getByLabelText(/days per week/i), { target: { value: '4' } });
  await user.click(screen.getByLabelText('lifting'));
  await user.click(screen.getByRole('button', { name: /finish/i }));

  const blocks = await db.blocks.toArray();
  expect(blocks).toHaveLength(1);
  expect(blocks[0].goalTimeSeconds).toBe(23 * 60);
  expect(blocks[0].status).toBe('active');
  expect(blocks[0].discipline).toBe('running');
  expect(blocks[0].level).toBe('intermediate');

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

  await pickDisciplineAndLevel(user, 'Running', 'Beginner');

  await user.selectOptions(await screen.findByLabelText('event'), '5K');
  await user.selectOptions(screen.getByLabelText(/goal type/i), 'finish');
  await user.click(screen.getByRole('button', { name: /next/i }));

  fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-11-01' } });
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.selectOptions(screen.getByLabelText('baseline'), 'unknown');
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.click(screen.getByRole('button', { name: /finish/i }));

  const blocks = await db.blocks.toArray();
  const sessions = await db.sessions.where('blockId').equals(blocks[0].id).toArray();
  expect(sessions).toHaveLength(1);
  expect(sessions[0].type).toBe('time_trial');
});

test('a cycling "General fitness" goal stores a weekly hour budget and skips the baseline', async () => {
  const onComplete = vi.fn();
  const user = userEvent.setup();
  render(<OnboardingWizard onComplete={onComplete} />);

  await pickDisciplineAndLevel(user, 'Cycling', 'Intermediate');

  await user.selectOptions(await screen.findByLabelText('event'), 'General fitness');
  expect(screen.queryByLabelText(/goal time/i)).not.toBeInTheDocument();
  await user.type(screen.getByLabelText(/weekly hours/i), '5');
  await user.click(screen.getByRole('button', { name: /next/i }));

  fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-11-01' } });
  await user.click(screen.getByRole('button', { name: /next/i }));

  // Baseline step shows an explanatory note, no select.
  expect(screen.queryByLabelText('baseline')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.click(screen.getByRole('button', { name: /finish/i }));

  const blocks = await db.blocks.toArray();
  expect(blocks[0].discipline).toBe('cycling');
  expect(blocks[0].eventLabel).toBe('General fitness');
  expect(blocks[0].goalTimeSeconds).toBeNull();
  expect(blocks[0].weeklyHours).toBe(5);

  const efforts = await db.efforts.where('blockId').equals(blocks[0].id).toArray();
  const sessions = await db.sessions.where('blockId').equals(blocks[0].id).toArray();
  expect(efforts).toHaveLength(0);
  expect(sessions).toHaveLength(0);
});

test('a "Mix" choice asks for a level per selected discipline and stores them all', async () => {
  const onComplete = vi.fn();
  const user = userEvent.setup();
  render(<OnboardingWizard onComplete={onComplete} />);

  await user.click(screen.getByRole('radio', { name: 'Mix / all of the above' }));
  await user.click(screen.getByLabelText('include Running'));
  await user.click(screen.getByLabelText('include Swimming'));
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.click(await screen.findByRole('radio', { name: 'Running Advanced' }));
  await user.click(screen.getByRole('radio', { name: 'Swimming Beginner' }));
  await user.click(screen.getByRole('button', { name: /next/i }));

  // Event step lets the athlete choose which selected discipline the goal is for.
  await user.selectOptions(await screen.findByLabelText(/event discipline/i), 'swimming');
  await user.selectOptions(screen.getByLabelText('event'), '1500m');
  await user.selectOptions(screen.getByLabelText(/goal type/i), 'finish');
  await user.click(screen.getByRole('button', { name: /next/i }));

  fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-12-01' } });
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.selectOptions(screen.getByLabelText('baseline'), 'unknown');
  await user.click(screen.getByRole('button', { name: /next/i }));
  await user.click(screen.getByRole('button', { name: /finish/i }));

  const blocks = await db.blocks.toArray();
  expect(blocks[0].discipline).toBe('swimming');
  expect(blocks[0].level).toBe('beginner');
  expect(blocks[0].disciplines).toEqual(['running', 'swimming']);
  expect(blocks[0].disciplineLevels).toEqual({ running: 'advanced', swimming: 'beginner' });
});

test('a Lifting interest skips the event list and baseline, storing a weekly budget', async () => {
  const user = userEvent.setup();
  render(<OnboardingWizard onComplete={vi.fn()} />);

  await pickDisciplineAndLevel(user, 'Lifting', 'Intermediate');

  // Step 3: no event select, straight to the weekly budget.
  expect(screen.queryByLabelText('event')).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/goal time/i)).not.toBeInTheDocument();
  await user.type(await screen.findByLabelText(/weekly hours/i), '3');
  await user.click(screen.getByRole('button', { name: /next/i }));

  fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-12-01' } });
  await user.click(screen.getByRole('button', { name: /next/i }));

  expect(screen.queryByLabelText('baseline')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /next/i }));
  await user.click(screen.getByRole('button', { name: /finish/i }));

  const blocks = await db.blocks.toArray();
  expect(blocks[0].discipline).toBe('lifting');
  expect(blocks[0].eventLabel).toBe('Lifting');
  expect(blocks[0].goalTimeSeconds).toBeNull();
  expect(blocks[0].weeklyHours).toBe(3);

  const efforts = await db.efforts.where('blockId').equals(blocks[0].id).toArray();
  const sessions = await db.sessions.where('blockId').equals(blocks[0].id).toArray();
  expect(efforts).toHaveLength(0);
  expect(sessions).toHaveLength(0);
});

test('a Sports interest asks which sports and stores the selected ones', async () => {
  const user = userEvent.setup();
  render(<OnboardingWizard onComplete={vi.fn()} />);

  await user.click(screen.getByRole('radio', { name: 'Sports' }));
  // Next stays disabled until at least one sport is chosen.
  expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  await user.click(screen.getByLabelText('Soccer'));
  await user.click(screen.getByLabelText('Bouldering'));
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.click(await screen.findByRole('radio', { name: 'Sports Advanced' }));
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.type(await screen.findByLabelText(/weekly hours/i), '6');
  await user.click(screen.getByRole('button', { name: /next/i }));

  fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-12-01' } });
  await user.click(screen.getByRole('button', { name: /next/i }));
  await user.click(screen.getByRole('button', { name: /next/i }));
  await user.click(screen.getByRole('button', { name: /finish/i }));

  const blocks = await db.blocks.toArray();
  expect(blocks[0].discipline).toBe('sports');
  expect(blocks[0].level).toBe('advanced');
  expect(blocks[0].sports).toEqual(['Soccer', 'Bouldering']);
  expect(blocks[0].eventLabel).toBe('Soccer, Bouldering');
  expect(blocks[0].weeklyHours).toBe(6);
});

test('the back button returns to the previous question without losing later steps', async () => {
  const user = userEvent.setup();
  render(<OnboardingWizard onComplete={vi.fn()} />);

  await pickDisciplineAndLevel(user, 'Running', 'Intermediate');
  expect(await screen.findByLabelText('event')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /back/i }));
  expect(await screen.findByRole('radio', { name: 'Running Intermediate' })).toHaveAttribute('aria-checked', 'true');

  await user.click(screen.getByRole('button', { name: /back/i }));
  expect(await screen.findByRole('radio', { name: 'Running' })).toHaveAttribute('aria-checked', 'true');
});

test('the step indicator reflects the six-step flow', async () => {
  const user = userEvent.setup();
  render(<OnboardingWizard onComplete={vi.fn()} />);

  expect(screen.getByText('1/6')).toBeInTheDocument();
  await user.click(screen.getByRole('radio', { name: 'Running' }));
  await user.click(screen.getByRole('button', { name: /next/i }));
  expect(await screen.findByText('2/6')).toBeInTheDocument();
});

test('showWelcome renders an intro screen that must be dismissed before the first question', async () => {
  const user = userEvent.setup();
  render(<OnboardingWizard onComplete={vi.fn()} showWelcome />);

  expect(screen.queryByRole('radio', { name: 'Running' })).not.toBeInTheDocument();
  expect(screen.getByText(/FitnessHM/)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /get started/i }));
  expect(await screen.findByRole('radio', { name: 'Running' })).toBeInTheDocument();
});
