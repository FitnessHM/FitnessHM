const MS_PER_WEEK = 1000 * 60 * 60 * 24 * 7;

// Conservative ceiling on sustainable weekly improvement, as a fraction of
// current best time. Deliberately cautious literature-based default;
// user-overridable in a later phase.
const MAX_WEEKLY_IMPROVEMENT_PERCENT = 0.008;

export interface ImprovementRateResult {
  gapSeconds: number;
  weeksRemaining: number;
  requiredSecondsPerWeek: number;
}

export function requiredImprovementRate(
  currentBestSeconds: number,
  goalTimeSeconds: number,
  today: Date,
  targetDate: Date
): ImprovementRateResult {
  const weeksRemaining = Math.max((targetDate.getTime() - today.getTime()) / MS_PER_WEEK, 0.1);
  const gapSeconds = currentBestSeconds - goalTimeSeconds;
  return {
    gapSeconds,
    weeksRemaining,
    requiredSecondsPerWeek: gapSeconds / weeksRemaining,
  };
}

export interface FeasibilityResult {
  isFeasible: boolean;
  maxSustainableSecondsPerWeek: number;
  suggestedGoalTimeSeconds: number | null;
  suggestedTargetDate: Date | null;
}

export function assessFeasibility(
  currentBestSeconds: number,
  goalTimeSeconds: number,
  today: Date,
  targetDate: Date
): FeasibilityResult {
  // Without a valid target date there is nothing meaningful to assess, so report
  // "nothing to warn about" rather than propagating an Invalid Date to callers.
  if (!Number.isFinite(targetDate.getTime())) {
    return { isFeasible: true, maxSustainableSecondsPerWeek: 0, suggestedGoalTimeSeconds: null, suggestedTargetDate: null };
  }

  const { weeksRemaining, requiredSecondsPerWeek } = requiredImprovementRate(
    currentBestSeconds,
    goalTimeSeconds,
    today,
    targetDate
  );
  const maxSustainableSecondsPerWeek = currentBestSeconds * MAX_WEEKLY_IMPROVEMENT_PERCENT;

  if (requiredSecondsPerWeek <= maxSustainableSecondsPerWeek) {
    return { isFeasible: true, maxSustainableSecondsPerWeek, suggestedGoalTimeSeconds: null, suggestedTargetDate: null };
  }

  const suggestedGoalTimeSeconds = currentBestSeconds - maxSustainableSecondsPerWeek * weeksRemaining;
  const weeksNeededForGoal = (currentBestSeconds - goalTimeSeconds) / maxSustainableSecondsPerWeek;
  const suggestedTargetDate = new Date(today.getTime() + weeksNeededForGoal * MS_PER_WEEK);

  return { isFeasible: false, maxSustainableSecondsPerWeek, suggestedGoalTimeSeconds, suggestedTargetDate };
}
