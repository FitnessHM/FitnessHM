import { lazy, Suspense, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import type { TrainingBlock, TimedEffort } from '../../db/schema';
import type { FeasibilityResult } from '../../lib/feasibility';
import { DEFAULT_DISCIPLINE, disciplineConfig, disciplineLabel, levelLabel } from '../../lib/disciplines';
import { formatMmSs } from '../../lib/format';
import Card from '../../components/Card';
import ProgressRing from '../../components/ProgressRing';
import Skeleton from '../../components/Skeleton';
import FeasibilityBanner from './FeasibilityBanner';

// recharts is one of the heaviest dependencies in the bundle and this chart
// only ever renders once the goal strip is expanded -- a separate chunk,
// fetched on first expand, not part of the initial Home load.
const ProgressionChart = lazy(() => import('./ProgressionChart'));

interface Props {
  block: TrainingBlock;
  efforts: TimedEffort[];
  daysRemaining: number | string;
  progress: number;
  feasibility: FeasibilityResult | null;
  currentBestEquivalentSeconds: number | null;
}

export default function GoalStrip({
  block,
  efforts,
  daysRemaining,
  progress,
  feasibility,
  currentBestEquivalentSeconds,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const reducedMotion = useReducedMotion();

  // Saved blocks from before disciplines existed have no `discipline` -- show
  // them as Running (matches the onboarding default).
  const primaryDiscipline = block.discipline ?? DEFAULT_DISCIPLINE;
  const primaryLevel = block.level ?? block.disciplineLevels?.[primaryDiscipline] ?? null;
  // Race sports read "Event · Discipline · Level"; budget-only ones (Lifting,
  // Sports) drop the discipline since eventLabel already carries it.
  const goalParts = disciplineConfig(primaryDiscipline).raceable
    ? [block.eventLabel, disciplineLabel(primaryDiscipline), levelLabel(primaryLevel)]
    : [block.eventLabel || disciplineLabel(primaryDiscipline), levelLabel(primaryLevel)];
  const goalLine = goalParts.filter(Boolean).join(' · ');
  const DisciplineIcon = disciplineConfig(primaryDiscipline).icon;

  // A ring reads as "percent done" -- showing it pinned at 0% before any
  // real baseline/goal exists reads as "stalled," not "not applicable yet."
  const hasProgress = currentBestEquivalentSeconds !== null && block.goalTimeSeconds != null;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="pressable flex w-full items-center gap-4 text-left"
      >
        {hasProgress ? (
          <ProgressRing progress={progress} size={52} strokeWidth={5} />
        ) : (
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-surface-raised">
            <DisciplineIcon className="h-5 w-5 text-faint" strokeWidth={2} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-body text-heading-sm font-bold leading-snug text-primary">{goalLine}</p>
          <p className="font-body text-caption text-secondary">
            {typeof daysRemaining === 'number' ? `${daysRemaining} days left` : 'No target date set'}
          </p>
          <p className="tabular-nums font-body text-caption font-semibold text-primary">
            {hasProgress
              ? `${formatMmSs(currentBestEquivalentSeconds!)} → ${formatMmSs(block.goalTimeSeconds!)}`
              : 'Current best: TBD — take your baseline test'}
          </p>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-faint transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* A tight timeline is said "early," per spec -- never buried behind
          the chart's expand toggle. Only the chart itself is collapsible. */}
      {feasibility && !feasibility.isFeasible && (
        <div className="mt-3">
          <FeasibilityBanner result={feasibility} />
        </div>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              {feasibility?.isFeasible && <FeasibilityBanner result={feasibility} />}
              <Suspense fallback={<Skeleton className="h-40 w-full" />}>
                <ProgressionChart efforts={efforts} />
              </Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
