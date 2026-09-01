import type { PrescribedSession, SessionLog, TimedEffort, TrainingBlock } from '../db/schema';
import { isoDateLocal } from './dates';
import { bestEquivalentEffort, paceSecondsPerKm, trainingZonesFromBaseline } from './paceMath';

export function timeAwareGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

export function startOfWeekIso(date: Date): string {
  const dayOfWeek = date.getDay(); // 0 = Sunday .. 6 = Saturday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - daysSinceMonday);
  return isoDateLocal(monday);
}

export type DayCompletionState = 'completed' | 'missed' | 'pending' | 'rest' | 'future';

export interface WeekDay {
  date: string;
  isToday: boolean;
  session: PrescribedSession | null;
  state: DayCompletionState;
}

// Monday-to-Sunday view of the week containing `today` -- past days in the
// week show whether they were done, not just what's ahead.
export function buildWeekView(sessions: PrescribedSession[], logs: SessionLog[], today: Date): WeekDay[] {
  const todayIso = isoDateLocal(today);
  const mondayIso = startOfWeekIso(today);
  const monday = new Date(mondayIso + 'T00:00:00');
  const loggedSessionIds = new Set(logs.map((l) => l.sessionId).filter((id): id is string => id !== null));

  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateIso = isoDateLocal(d);
    const session = sessions.find((s) => s.date === dateIso) ?? null;
    const isToday = dateIso === todayIso;

    let state: DayCompletionState;
    if (!session || session.type === 'rest') {
      state = 'rest';
    } else if (loggedSessionIds.has(session.id)) {
      state = 'completed';
    } else if (dateIso < todayIso) {
      state = 'missed';
    } else if (isToday) {
      state = 'pending';
    } else {
      state = 'future';
    }

    days.push({ date: dateIso, isToday, session, state });
  }
  return days;
}

export interface Insight {
  text: string;
}

// Every branch here reads real logged/prescribed data -- there is no
// generic "keep it up!" fallback. Returns null when there's nothing to say,
// which the UI treats as "hide the section entirely."
export function computeInsight(params: {
  block: TrainingBlock;
  efforts: TimedEffort[];
  logs: SessionLog[];
  sessions: PrescribedSession[];
  currentBestEquivalentSeconds: number | null;
  today: Date;
}): Insight | null {
  const { block, efforts, logs, sessions, currentBestEquivalentSeconds, today } = params;

  const bestEffort = bestEquivalentEffort(efforts, block.eventDistanceMeters);
  if (bestEffort) {
    const zones = trainingZonesFromBaseline(bestEffort.distanceMeters, bestEffort.timeSeconds);
    const mondayIso = startOfWeekIso(today);
    const easyPaces: number[] = [];
    for (const log of logs) {
      if (log.date < mondayIso) continue;
      if (log.actualDistanceMeters == null || log.actualDurationSeconds == null) continue;
      const session = sessions.find((s) => s.id === log.sessionId);
      if (session?.type !== 'easy') continue;
      easyPaces.push(paceSecondsPerKm(log.actualDistanceMeters, log.actualDurationSeconds));
    }
    if (easyPaces.length >= 2) {
      const avgPace = easyPaces.reduce((a, b) => a + b, 0) / easyPaces.length;
      const ceiling = zones.easy.minSecondsPerKm;
      if (avgPace < ceiling - 5) {
        const diff = Math.round(ceiling - avgPace);
        return { text: `Your easy runs have averaged ${diff}s/km faster than your easy-pace ceiling this week.` };
      }
    }
  }

  if (currentBestEquivalentSeconds !== null && block.goalTimeSeconds != null) {
    const targetDate = new Date(block.targetDate + 'T00:00:00');
    if (Number.isFinite(targetDate.getTime())) {
      const daysRemaining = Math.max(Math.ceil((targetDate.getTime() - today.getTime()) / 86400000), 0);
      const gap = Math.round(currentBestEquivalentSeconds - block.goalTimeSeconds);
      if (gap > 0) {
        return { text: `You're ${gap} seconds off goal pace with ${daysRemaining} days left.` };
      }
      return { text: `You're already at or ahead of goal pace -- ${Math.abs(gap)}s to spare.` };
    }
  }

  return null;
}
