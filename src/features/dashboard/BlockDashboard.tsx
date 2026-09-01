import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { assessFeasibility } from '../../lib/feasibility';
import { bestEquivalentEffort, riegelEquivalent } from '../../lib/paceMath';
import { todayIso } from '../../lib/dates';
import ProgressionChart from './ProgressionChart';
import FeasibilityBanner from './FeasibilityBanner';

interface Props {
  blockId: string;
  onStartNewBlock: () => void;
}

export default function BlockDashboard({ blockId, onStartNewBlock }: Props) {
  const block = useLiveQuery(() => db.blocks.get(blockId), [blockId]);
  const efforts = useLiveQuery(() => db.efforts.where('blockId').equals(blockId).sortBy('date'), [blockId]);
  const sessions = useLiveQuery(() => db.sessions.where('blockId').equals(blockId).sortBy('date'), [blockId]);
  const logs = useLiveQuery(() => db.logs.where('blockId').equals(blockId).toArray(), [blockId]);

  if (!block || !efforts || !sessions || !logs) {
    return <p className="p-6">Loading...</p>;
  }

  const today = new Date();
  // Parse as local midnight; `new Date('2026-11-01')` would be UTC midnight,
  // which skews days-remaining by a day for most timezones.
  const targetDate = new Date(block.targetDate + 'T00:00:00');
  const hasValidTargetDate = Number.isFinite(targetDate.getTime());
  const daysRemaining = hasValidTargetDate
    ? Math.max(Math.ceil((targetDate.getTime() - today.getTime()) / 86400000), 0)
    : '—';

  const loggedSessionIds = new Set(logs.map((l) => l.sessionId).filter((id): id is string => id !== null));
  const nextSession = sessions.find((s) => !loggedSessionIds.has(s.id) && s.date >= todayIso());

  // The strongest effort, not the most recent one -- a slower checkpoint
  // shouldn't displace a faster baseline just because it happened later, and
  // an effort at a different distance is normalized via Riegel before
  // comparing (a 10K time can be the "better" 5K-equivalent result).
  const currentBest = bestEquivalentEffort(efforts, block.eventDistanceMeters) ?? undefined;
  const currentBestEquivalentSeconds = currentBest
    ? riegelEquivalent(currentBest.distanceMeters, currentBest.timeSeconds, block.eventDistanceMeters)
    : null;
  const feasibility = currentBestEquivalentSeconds !== null && block.goalTimeSeconds != null
    ? assessFeasibility(currentBestEquivalentSeconds, block.goalTimeSeconds, today, targetDate)
    : null;

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold">{block.eventLabel} — {block.goalType === 'time' ? 'Time goal' : block.goalType}</h1>
        <p className="text-slate-400">{daysRemaining} days remaining (target {block.targetDate})</p>
      </header>

      {feasibility && <FeasibilityBanner result={feasibility} />}

      {currentBest ? (
        <p>Current best: {Math.round(currentBest.timeSeconds)}s on {currentBest.date}</p>
      ) : (
        <p>Current best: TBD — take your baseline test</p>
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

      <button
        type="button"
        onClick={onStartNewBlock}
        className="w-full py-3 bg-slate-800 rounded font-semibold text-slate-300"
      >
        Start a new block
      </button>
    </div>
  );
}
