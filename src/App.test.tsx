import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db/schema';
import App from './App';

beforeEach(async () => {
  await Promise.all([db.athlete.clear(), db.blocks.clear(), db.efforts.clear(), db.sessions.clear(), db.logs.clear()]);
});

// Drives the wizard from wherever it currently is (welcome screen or step 1)
// through to a finished 5K "just finish" block -- the fastest valid path,
// since most tests here care about what happens after setup, not setup itself.
async function completeOnboarding(user: UserEvent) {
  // App resolves its initial "loading" view asynchronously -- wait for it to
  // settle into one of the two possible onboarding states before deciding
  // whether there's a welcome screen to dismiss.
  await waitFor(() => {
    expect(
      screen.queryByRole('button', { name: /get started/i }) ?? screen.queryByLabelText(/event/i)
    ).toBeTruthy();
  });

  const getStarted = screen.queryByRole('button', { name: /get started/i });
  if (getStarted) await user.click(getStarted);

  await user.selectOptions(await screen.findByLabelText(/event/i), '5K');
  await user.selectOptions(screen.getByLabelText(/goal type/i), 'finish');
  await user.click(screen.getByRole('button', { name: /next/i }));

  fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2027-01-01' } });
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.selectOptions(screen.getByLabelText(/baseline/i), 'unknown');
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.click(screen.getByRole('button', { name: /finish/i }));
}

test('a fresh install shows the welcome screen, then a populated home screen after setup', async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(await screen.findByRole('button', { name: /get started/i })).toBeInTheDocument();
  expect(screen.queryByText(/days left/i)).not.toBeInTheDocument();

  await completeOnboarding(user);

  expect(await screen.findByText(/5K/)).toBeInTheDocument();
  expect(screen.getByText(/days left/i)).toBeInTheDocument();
});

test('starting a new block from the home screen skips the welcome screen', async () => {
  const user = userEvent.setup();
  render(<App />);
  await completeOnboarding(user);
  await screen.findByText(/days left/i);

  await user.click(screen.getByRole('button', { name: /start a new block/i }));

  // No welcome screen the second time -- straight to the first question.
  expect(await screen.findByLabelText(/event/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /get started/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/days left/i)).not.toBeInTheDocument();
});

test('completing a new block archives the previous active block', async () => {
  const user = userEvent.setup();
  render(<App />);
  await completeOnboarding(user);
  await screen.findByText(/days left/i);

  const firstBlocks = await db.blocks.toArray();
  expect(firstBlocks).toHaveLength(1);
  const firstBlockId = firstBlocks[0].id;

  await user.click(screen.getByRole('button', { name: /start a new block/i }));

  await user.selectOptions(await screen.findByLabelText(/event/i), '10K');
  await user.selectOptions(screen.getByLabelText(/goal type/i), 'finish');
  await user.click(screen.getByRole('button', { name: /next/i }));

  fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2027-06-01' } });
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.selectOptions(screen.getByLabelText(/baseline/i), 'unknown');
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.click(screen.getByRole('button', { name: /finish/i }));

  expect(await screen.findByText(/10K/)).toBeInTheDocument();

  const firstBlockAfter = await db.blocks.get(firstBlockId);
  expect(firstBlockAfter?.status).toBe('archived');

  const activeBlocks = (await db.blocks.toArray()).filter((b) => b.status === 'active');
  expect(activeBlocks).toHaveLength(1);
  expect(activeBlocks[0].eventLabel).toBe('10K');
});

test('logging today\'s session from the home screen returns to a home screen reflecting the log', async () => {
  const user = userEvent.setup();
  render(<App />);
  await completeOnboarding(user);
  await screen.findByText(/days left/i);

  // Fresh block has no session scheduled today, so the "log something
  // anyway" ghost action on the Today card exercises the adhoc-logging path.
  await user.click(screen.getByRole('button', { name: /log something anyway/i }));

  fireEvent.change(await screen.findByLabelText(/duration/i), { target: { value: '1800' } });
  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByText(/days left/i)).toBeInTheDocument();
  const logs = await db.logs.toArray();
  expect(logs).toHaveLength(1);
  expect(logs[0].actualDurationSeconds).toBe(1800);
});
