import type { WearableAdapter, Activity, DateRange } from './types';

export const manualEntryAdapter: WearableAdapter = {
  name: 'manual-entry',
  async fetchActivities(_range: DateRange): Promise<Activity[]> {
    return [];
  },
};
