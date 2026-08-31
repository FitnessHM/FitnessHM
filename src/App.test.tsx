import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
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
