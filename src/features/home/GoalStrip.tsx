import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import type { TrainingBlock, TimedEffort } from '../../db/schema';
import type { FeasibilityResult } from '../../lib/feasibility';
import { DEFAULT_DISCIPLINE, disciplineConfig, disciplineLabel, levelLabel } from '../../lib/disciplines';
import { formatMmSs } from '../../lib/format';
import Card from '../../components/Card';
import ProgressRing from '../../components/ProgressRing';
import ProgressionChart from './ProgressionChart';
import FeasibilityBanner from './FeasibilityBanner';

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

  return (
    <Card>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="pressable flex w-full items-center gap-4 text-left"
      >
        <ProgressRing progress={progress} size={56} strokeWidth={5} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-title text-primary">{goalLine}</p>
          <p className="font-body text-caption text-secondary">
            {typeof daysRemaining === 'number' ? `${daysRemaining} days left` : 'No target date set'}
          </p>
          <p className="tabular-nums font-body text-caption font-semibold text-primary">
            {currentBestEquivalentSeconds !== null && block.goalTimeSeconds != null
              ? `${formatMmSs(currentBestEquivalentSeconds)} → ${formatMmSs(block.goalTimeSeconds)}`
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
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              {feasibility?.isFeasible && <FeasibilityBanner result={feasibility} />}
              <ProgressionChart efforts={efforts} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
