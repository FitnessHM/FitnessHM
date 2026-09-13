import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { PrescribedSession } from '../../db/schema';
import { assessFeasibility } from '../../lib/feasibility';
import { bestEquivalentEffort, riegelEquivalent } from '../../lib/paceMath';
import { todayIso } from '../../lib/dates';
import { buildWeekView, computeInsight } from '../../lib/home';
import Button from '../../components/Button';
import Skeleton from '../../components/Skeleton';
import GreetingBar from './GreetingBar';
import TodayCard from './TodayCard';
import GoalStrip from './GoalStrip';
import WeekRow from './WeekRow';
import RecentList from './RecentList';
import InsightCard from './InsightCard';

interface Props {
  blockId: string;
  onStartNewBlock: () => void;
  onLogSession: (session: PrescribedSession | null) => void;
  onOpenSettings: () => void;
}

export default function HomeScreen({ blockId, onStartNewBlock, onLogSession, onOpenSettings }: Props) {
  const block = useLiveQuery(() => db.blocks.get(blockId), [blockId]);
  const efforts = useLiveQuery(() => db.efforts.where('blockId').equals(blockId).sortBy('date'), [blockId]);
  const sessions = useLiveQuery(() => db.sessions.where('blockId').equals(blockId).sortBy('date'), [blockId]);
  const logs = useLiveQuery(() => db.logs.where('blockId').equals(blockId).toArray(), [blockId]);

  if (!block || !efforts || !sessions || !logs) {
    return <HomeScreenSkeleton />;
  }

  const now = new Date();
  const today = todayIso();

  const targetDate = new Date(block.targetDate + 'T00:00:00');
  const hasValidTargetDate = Number.isFinite(targetDate.getTime());
  const daysRemaining: number | string = hasValidTargetDate
    ? Math.max(Math.ceil((targetDate.getTime() - now.getTime()) / 86400000), 0)
    : '—';

  const currentBest = bestEquivalentEffort(efforts, block.eventDistanceMeters);
  const currentBestEquivalentSeconds = currentBest
    ? riegelEquivalent(currentBest.distanceMeters, currentBest.timeSeconds, block.eventDistanceMeters)
    : null;
  const feasibility =
    currentBestEquivalentSeconds !== null && block.goalTimeSeconds != null
      ? assessFeasibility(currentBestEquivalentSeconds, block.goalTimeSeconds, now, targetDate)
      : null;

  const baselineEffort = efforts.find((e) => e.kind === 'baseline');
  const baselineEquivalentSeconds = baselineEffort
    ? riegelEquivalent(baselineEffort.distanceMeters, baselineEffort.timeSeconds, block.eventDistanceMeters)
    : null;
  const progress =
    baselineEquivalentSeconds !== null &&
    currentBestEquivalentSeconds !== null &&
    block.goalTimeSeconds != null &&
    baselineEquivalentSeconds !== block.goalTimeSeconds
      ? (baselineEquivalentSeconds - currentBestEquivalentSeconds) / (baselineEquivalentSeconds - block.goalTimeSeconds)
      : 0;

  const todaysSession = sessions.find((s) => s.date === today) ?? null;
  const loggedSessionIds = new Set(logs.map((l) => l.sessionId).filter((id): id is string => id !== null));
  const isTodayLogged = todaysSession
    ? loggedSessionIds.has(todaysSession.id)
    : logs.some((l) => l.sessionId === null && l.date === today);

  const weekDays = buildWeekView(sessions, logs, now);

  const insight = computeInsight({
    block,
    efforts,
    logs,
    sessions,
    currentBestEquivalentSeconds,
    today: now,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 pb-10">
      <GreetingBar now={now} onOpenSettings={onOpenSettings} />

      <TodayCard session={todaysSession} isLogged={isTodayLogged} onLog={() => onLogSession(todaysSession)} />

      <GoalStrip
        block={block}
        efforts={efforts}
        daysRemaining={daysRemaining}
        progress={progress}
        feasibility={feasibility}
        currentBestEquivalentSeconds={currentBestEquivalentSeconds}
      />

      <section className="space-y-2">
        <h2 className="font-body text-label font-bold uppercase tracking-wide text-secondary">This week</h2>
        <WeekRow days={weekDays} onTapToday={() => onLogSession(todaysSession)} />
      </section>

      <section className="space-y-2">
        <h2 className="font-body text-label font-bold uppercase tracking-wide text-secondary">Recent</h2>
        <RecentList logs={logs} sessions={sessions} />
      </section>

      <InsightCard insight={insight} />

      <div className="pt-2 text-center">
        <Button variant="ghost" onClick={onStartNewBlock}>
          Start a new block
        </Button>
      </div>
    </div>
  );
}

function HomeScreenSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 pb-10">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-48 w-full rounded-card" />
      <Skeleton className="h-20 w-full rounded-card" />
      <div className="flex justify-between gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-16 flex-1" />
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-card" />
    </div>
  );
}
