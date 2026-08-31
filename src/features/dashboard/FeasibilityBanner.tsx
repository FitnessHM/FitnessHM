import type { FeasibilityResult } from '../../lib/feasibility';

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  result: FeasibilityResult;
}

export default function FeasibilityBanner({ result }: Props) {
  if (result.isFeasible) {
    return <p className="text-emerald-400 text-sm">This goal fits your timeline at a sustainable improvement rate.</p>;
  }
  return (
    <div className="bg-amber-950 border border-amber-700 rounded p-3 text-sm space-y-1">
      <p className="text-amber-300 font-semibold">This goal looks tight for the time you have.</p>
      <p>
        A sustainable pace suggests {result.suggestedGoalTimeSeconds ? formatMmSs(result.suggestedGoalTimeSeconds) : '—'} by
        your target date, or your current goal time by{' '}
        {Number.isFinite(result.suggestedTargetDate?.getTime()) ? result.suggestedTargetDate!.toISOString().slice(0, 10) : '—'}.
        Consider adjusting one of them.
      </p>
    </div>
  );
}
