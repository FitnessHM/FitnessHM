import { expect, test } from 'vitest';
import { manualEntryAdapter } from './manualEntry';

test('manualEntryAdapter implements WearableAdapter and returns no activities', async () => {
  expect(manualEntryAdapter.name).toBe('manual-entry');
  const activities = await manualEntryAdapter.fetchActivities({ start: '2026-08-01', end: '2026-08-30' });
  expect(activities).toEqual([]);
});
