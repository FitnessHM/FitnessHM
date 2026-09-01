import { ClipboardList } from 'lucide-react';
import type { SessionLog, PrescribedSession } from '../../db/schema';
import ListRow from '../../components/ListRow';
import EmptyState from '../../components/EmptyState';
import SessionTypeIcon, { sessionTypeLabel } from '../../components/SessionTypeIcon';
import { formatMmSs } from '../../lib/format';

function headline(log: SessionLog): string {
  if (log.actualDurationSeconds != null) {
    return formatMmSs(log.actualDurationSeconds);
  }
  if (log.actualDistanceMeters != null) {
    return `${(log.actualDistanceMeters / 1000).toFixed(1)} km`;
  }
  if (log.actualReps != null) {
    return `${log.actualReps} reps`;
  }
  return 'Logged';
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Props {
  logs: SessionLog[];
  sessions: PrescribedSession[];
}

export default function RecentList({ logs, sessions }: Props) {
  const recent = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);

  if (recent.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-8 w-8" />}
        title="Nothing logged yet"
        description="Your last few sessions will show up here once you start logging."
      />
    );
  }

  return (
    <div className="space-y-2">
      {recent.map((log) => {
        const session = sessions.find((s) => s.id === log.sessionId);
        return (
          <ListRow
            key={log.id}
            leading={<SessionTypeIcon type={session?.type ?? 'easy'} className="h-4 w-4 text-secondary" />}
            title={session ? sessionTypeLabel(session.type) : 'Unscheduled session'}
            subtitle={formatDate(log.date)}
            trailing={<span className="tabular-nums font-display text-label text-primary">{headline(log)}</span>}
          />
        );
      })}
    </div>
  );
}
