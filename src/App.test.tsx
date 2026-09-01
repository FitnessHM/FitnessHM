import 'fake-indexeddb/auto';
import { render, screen, fireEvent } from '@testing-library/react';
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

test('completing a new block archives the previous active block', async () => {
  const user = userEvent.setup();
  render(<App />);

  await screen.findByText(/days remaining/i);
  const seededBlocks = await db.blocks.toArray();
  expect(seededBlocks).toHaveLength(1);
  const seededBlockId = seededBlocks[0].id;

  await user.click(await screen.findByRole('button', { name: /start a new block/i }));

  await user.selectOptions(await screen.findByLabelText(/event/i), '10K');
  await user.selectOptions(screen.getByLabelText(/goal type/i), 'finish');
  await user.click(screen.getByRole('button', { name: /next/i }));

  fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2027-01-01' } });
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.selectOptions(screen.getByLabelText(/baseline/i), 'unknown');
  await user.click(screen.getByRole('button', { name: /next/i }));

  await user.click(screen.getByRole('button', { name: /next/i }));
  await user.click(screen.getByRole('button', { name: /finish/i }));

  expect(await screen.findByText(/10K/)).toBeInTheDocument();

  const seededBlockAfter = await db.blocks.get(seededBlockId);
  expect(seededBlockAfter?.status).toBe('archived');

  const activeBlocks = (await db.blocks.toArray()).filter((b) => b.status === 'active');
  expect(activeBlocks).toHaveLength(1);
  expect(activeBlocks[0].eventLabel).toBe('10K');
});
