import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { db } from './db/schema';
import { isoDateLocal } from './lib/dates';
import App from './App';

// App.tsx's shell (AppShell) renders Clerk's <UserButton/> in the header --
// this test suite exercises onboarding/home/logger flows, not Clerk itself,
// and doesn't wrap App in a <ClerkProvider> (App never needed one before).
// Stubbed rather than adding a real provider: there's nothing Clerk-specific
// under test here.
vi.mock('@clerk/clerk-react', () => ({
  UserButton: () => <div aria-label="user menu" />,
}));

function futureTargetDate(daysOut = 84): string {
  return isoDateLocal(new Date(Date.now() + daysOut * 86400000));
}

// Step 6's weekday picker defaults to Mon/Wed/Sat. Several tests here rely
// on "nothing scheduled today" for the adhoc-logging path -- deselect
// today's day (if it's one of the defaults) so that stays true regardless
// of which real calendar day the suite happens to run on.
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
async function deselectToday(user: UserEvent) {
  const label = WEEKDAY_LABELS[new Date().getDay()];
  const button = screen.queryByRole('button', { name: `train on ${label}` });
  if (button?.getAttribute('aria-pressed') === 'true') await user.click(button);
}

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

  await completeOnboardingWithEvent(user, '5K');
}

// From the discipline step through Finish, targeting a Running event. Shared
// by the tests that only care about post-setup behavior.
async function completeOnboardingWithEvent(user: UserEvent, event: string) {
  await user.click(await screen.findByRole('radio', { name: 'Running' }));
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.click(await screen.findByRole('radio', { name: 'Running Intermediate' }));
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.selectOptions(await screen.findByLabelText('event'), event);
  await user.selectOptions(screen.getByLabelText(/goal type/i), 'finish');
  await user.click(screen.getByRole('button', { name: /next/i }));

  fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: futureTargetDate() } });
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.selectOptions(screen.getByLabelText('baseline'), 'unknown');
  await user.click(screen.getByRole('button', { name: /next/i }));

  await deselectToday(user);
  await user.click(screen.getByRole('button', { name: /preview my plan/i }));
  await user.click(await screen.findByRole('button', { name: /confirm and start/i }));
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
  expect(await screen.findByRole('radio', { name: 'Running' })).toBeInTheDocument();
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

  await completeOnboardingWithEvent(user, '10K');

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
