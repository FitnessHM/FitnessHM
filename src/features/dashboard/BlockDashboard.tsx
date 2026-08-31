import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { assessFeasibility } from '../../lib/feasibility';
import ProgressionChart from './ProgressionChart';
import FeasibilityBanner from './FeasibilityBanner';

interface Props {
  blockId: string;
}

export default function BlockDashboard({ blockId }: Props) {
  const block = useLiveQuery(() => db.blocks.get(blockId), [blockId]);
  const efforts = useLiveQuery(() => db.efforts.where('blockId').equals(blockId).sortBy('date'), [blockId]);
  const sessions = useLiveQuery(() => db.sessions.where('blockId').equals(blockId).sortBy('date'), [blockId]);
  const logs = useLiveQuery(() => db.logs.where('blockId').equals(blockId).toArray(), [blockId]);

  if (!block || !efforts || !sessions || !logs) {
    return <p className="p-6">Loading...</p>;
  }

  const today = new Date();
  const targetDate = new Date(block.targetDate);
  const daysRemaining = Math.max(Math.ceil((targetDate.getTime() - today.getTime()) / 86400000), 0);

  const loggedSessionIds = new Set(logs.map((l) => l.sessionId).filter((id): id is string => id !== null));
  const nextSession = sessions.find((s) => !loggedSessionIds.has(s.id) && s.date >= today.toISOString().slice(0, 10));

  const currentBest = efforts.length > 0 ? efforts[efforts.length - 1] : undefined;
  const feasibility = currentBest && block.goalTimeSeconds != null
    ? assessFeasibility(currentBest.timeSeconds, block.goalTimeSeconds, today, targetDate)
    : null;

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold">{block.eventLabel} — {block.goalType === 'time' ? 'Time goal' : block.goalType}</h1>
        <p className="text-slate-400">{daysRemaining} days remaining (target {block.targetDate})</p>
      </header>

      {feasibility && <FeasibilityBanner result={feasibility} />}

      {currentBest && (
        <p>Current best: {Math.round(currentBest.timeSeconds)}s on {currentBest.date}</p>
      )}

      <section>
        <h2 className="text-lg font-medium mb-2">Progression</h2>
        <ProgressionChart efforts={efforts} />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Next session</h2>
        {nextSession ? (
          <div className="bg-slate-900 rounded p-4">
            <p className="font-semibold">{nextSession.type} — {nextSession.date}</p>
            {nextSession.note && <p className="text-slate-400 text-sm mt-1">{nextSession.note}</p>}
          </div>
        ) : (
          <p className="text-slate-400">No upcoming session scheduled.</p>
        )}
      </section>
    </div>
  );
}
