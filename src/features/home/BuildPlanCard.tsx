import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import type { Athlete, TrainingBlock } from '../../db/schema';
import type { Discipline } from '../../lib/disciplines';
import { generatePlan } from '../../lib/plan/generate';
import { createPrescribedSessions } from '../../db/repository';
import { todayIso } from '../../lib/dates';
import Card from '../../components/Card';
import Button from '../../components/Button';

interface Props {
  block: TrainingBlock;
  athlete: Athlete | undefined;
  baselineEffort: { distanceMeters: number; timeSeconds: number } | null;
}

// For any active block with zero sessions -- either it predates the plan
// generator (phase 1 blocks, including accounts that onboarded before this
// phase shipped) or a previous generation attempt produced nothing (e.g. a
// target date that's since passed).
export default function BuildPlanCard({ block, athlete, baselineEffort }: Props) {
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const build = async () => {
    setIsBuilding(true);
    setError(null);
    const primaryDiscipline: Discipline = block.discipline ?? 'running';
    const baselines = baselineEffort
      ? { [primaryDiscipline]: { id: 'build-plan', blockId: block.id, date: todayIso(), kind: 'baseline' as const, ...baselineEffort } }
      : {};
    const drafts = generatePlan({
      today: todayIso(),
      block,
      athlete: athlete ?? {
        id: 1, daysPerWeek: 3, otherTraining: [], trainingWeekdays: null, otherTrainingWeekdays: null, unitSystem: 'metric',
      },
      baselines,
      fixedSessions: [],
    });
    if (drafts.length === 0) {
      setError("Couldn't build a plan for this block -- its target date may already be in the past.");
      setIsBuilding(false);
      return;
    }
    await createPrescribedSessions(drafts);
    setIsBuilding(false);
  };

  const onBuildClick = () => {
    build().catch((err) => {
      console.error('build plan failed', err);
      setError('Something went wrong building your plan -- try again.');
      setIsBuilding(false);
    });
  };

  return (
    <Card raised className="space-y-4 p-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
        <CalendarPlus className="h-6 w-6 text-accent" strokeWidth={2} />
      </span>
      <div className="space-y-1.5">
        <p className="font-body text-heading font-bold text-primary">No plan yet</p>
        <p className="font-body text-body text-secondary">
          This block doesn't have a generated training plan. Build one now from your goal and schedule.
        </p>
      </div>
      {error && <p className="font-body text-caption text-caution">{error}</p>}
      <Button onClick={onBuildClick} disabled={isBuilding} className="w-full text-[1.0625rem]">
        {isBuilding ? 'Building…' : 'Build my plan'}
      </Button>
    </Card>
  );
}
