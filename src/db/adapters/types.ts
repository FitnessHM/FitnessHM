export interface Activity {
  date: string;
  distanceMeters: number;
  durationSeconds: number;
  avgHeartRate: number | null;
  source: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface WearableAdapter {
  name: string;
  fetchActivities(range: DateRange): Promise<Activity[]>;
}
