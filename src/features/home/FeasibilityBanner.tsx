import type { FeasibilityResult } from '../../lib/feasibility';
import { isoDateLocal } from '../../lib/dates';
import { formatMmSs } from '../../lib/format';

interface Props {
  result: FeasibilityResult;
}

export default function FeasibilityBanner({ result }: Props) {
  if (result.isFeasible) {
    return (
      <p className="font-body text-caption font-semibold text-success">
        This goal fits your timeline at a sustainable improvement rate.
      </p>
    );
  }
  return (
    <div className="space-y-1 rounded-control border border-caution/30 bg-caution/10 p-3">
      <p className="font-body text-caption font-bold uppercase tracking-wide text-caution">Tight timeline</p>
      <p className="font-body text-caption text-secondary">
        A sustainable pace suggests {result.suggestedGoalTimeSeconds ? formatMmSs(result.suggestedGoalTimeSeconds) : '—'} by
        your target date, or your current goal time by{' '}
        {Number.isFinite(result.suggestedTargetDate?.getTime()) ? isoDateLocal(result.suggestedTargetDate!) : '—'}.
        Consider adjusting one of them.
      </p>
    </div>
  );
}
