import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db/schema';
import App from './App';

beforeEach(async () => {
  await Promise.all([db.athlete.clear(), db.blocks.clear(), db.efforts.clear(), db.sessions.clear(), db.logs.clear()]);
});

test('seeds an example block and shows the dashboard on first load', async () => {
  render(<App />);
  expect(await screen.findByText(/5K/)).toBeInTheDocument();
  expect(screen.getByText(/days remaining/i)).toBeInTheDocument();
});

test('the onboarding wizard is reachable from the dashboard', async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(await screen.findByText(/days remaining/i)).toBeInTheDocument();

  await user.click(await screen.findByRole('button', { name: /start a new block/i }));

  // Step 1 of the wizard: the event picker is unique to onboarding.
  expect(await screen.findByLabelText(/goal type/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/event/i)).toBeInTheDocument();
  expect(screen.queryByText(/days remaining/i)).not.toBeInTheDocument();
});
