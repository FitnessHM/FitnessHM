import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { todayIso } from '../../lib/dates';
import { weekDatesContaining } from '../../lib/plan/dateUtils';
import { sessionIntensity } from '../../lib/plan/intensity';
import SessionTypeIcon, { sessionTypeLabel } from '../../components/SessionTypeIcon';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import { Calendar } from 'lucide-react';

const INTENSITY_DOT: Record<string, string> = {
  easy: 'bg-success',
  moderate: 'bg-caution',
  hard: 'bg-alert',
};

// Read-only for now -- editing a plan (move/swap/delete/add a session,
// "Update plan") is phase 4, not built yet. This just gives the new
// bottom-tab/sidebar nav's "Plan" destination something real to show:
// the upcoming few weeks, grouped, reusing the same session data Home's
// week row already reads. No new data/generator logic.
export default function PlanScreen({ blockId }: { blockId: string }) {
  const sessions = useLiveQuery(() => db.sessions.where('blockId').equals(blockId).sortBy('date'), [blockId]);
  const logs = useLiveQuery(() => db.logs.where('blockId').equals(blockId).toArray(), [blockId]);

  if (!sessions || !logs) return null;

  const today = todayIso();
  const upcoming = sessions.filter((s) => s.date >= today).slice(0, 28);
  const loggedIds = new Set(logs.map((l) => l.sessionId).filter((id): id is string => id !== null));

  if (upcoming.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-4 pb-10 pt-6 md:pt-10">
        <h1 className="font-body text-heading-lg font-bold text-primary">Plan</h1>
        <div className="mt-6">
          <EmptyState icon={<Calendar className="h-8 w-8" />} title="Nothing upcoming" description="Build a plan from Home to see it here." />
        </div>
      </div>
    );
  }

  const weeks: { startDate: string; sessions: typeof upcoming }[] = [];
  for (const session of upcoming) {
    const weekStart = weekDatesContaining(session.date)[0];
    let week = weeks.find((w) => w.startDate === weekStart);
    if (!week) {
      week = { startDate: weekStart, sessions: [] };
      weeks.push(week);
    }
    week.sessions.push(session);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 pb-10 pt-6 md:pt-10">
      <h1 className="font-body text-heading-lg font-bold text-primary">Plan</h1>
      {weeks.map((week, i) => (
        <Card key={week.startDate} className="space-y-3">
          <p className="font-body text-label font-bold uppercase tracking-wide text-secondary">
            Week {i + 1} &middot; {new Date(week.startDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </p>
          <div className="space-y-2">
            {week.sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${INTENSITY_DOT[sessionIntensity(s)]}`} />
                <SessionTypeIcon type={s.type} className="h-4 w-4 shrink-0 text-secondary" />
                <p className="min-w-0 flex-1 truncate font-body text-body text-primary">{sessionTypeLabel(s.type)}</p>
                <span className="shrink-0 font-body text-caption text-secondary">
                  {new Date(s.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
                {loggedIds.has(s.id) && <span className="shrink-0 font-body text-caption font-semibold text-success">Done</span>}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
