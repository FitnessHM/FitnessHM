import { expect, test } from 'vitest';
import { buildRacePhases, buildBudgetPhases, estimateFinishMinutes } from './phases';

test('estimateFinishMinutes lands a 5K run under 40 minutes and a marathon over 3 hours', () => {
  expect(estimateFinishMinutes('running', 5000)).toBeLessThan(40);
  expect(estimateFinishMinutes('running', 42195)).toBeGreaterThan(180);
});

test('buildRacePhases covers exactly the weeks between today and the target date', () => {
  const weeks = buildRacePhases('2026-01-01', '2026-03-26', estimateFinishMinutes('running', 5000)); // ~12 weeks
  expect(weeks).toHaveLength(12);
  expect(weeks[0].weekIndex).toBe(0);
  expect(weeks.at(-1)!.weekIndex).toBe(11);
});

test('buildRacePhases ends in taper, with base -> build -> specific -> taper in order', () => {
  const weeks = buildRacePhases('2026-01-01', '2026-03-26', estimateFinishMinutes('running', 5000));
  expect(weeks.at(-1)!.phase === 'taper' || weeks.at(-1)!.isDeload).toBe(true);
  const phaseOrder = weeks.map((w) => w.phase).filter((p) => p !== 'deload');
  // every phase that appears, appears in the right relative order
  const seenOrder = [...new Set(phaseOrder)];
  const canonical: (typeof phaseOrder)[number][] = ['base', 'build', 'specific', 'taper'];
  expect(seenOrder).toEqual(canonical.filter((p) => seenOrder.includes(p)));
});

test('buildRacePhases scales taper length with event length', () => {
  const shortTaper = buildRacePhases('2026-01-01', '2026-04-23', estimateFinishMinutes('running', 5000)); // 16 weeks, 5K
  const longTaper = buildRacePhases('2026-01-01', '2026-04-23', estimateFinishMinutes('running', 42195)); // same window, marathon
  const taperLen = (weeks: ReturnType<typeof buildRacePhases>) => weeks.filter((w) => w.phase === 'taper').length;
  expect(taperLen(longTaper)).toBeGreaterThan(taperLen(shortTaper));
});

test('buildRacePhases falls back to all-specific (plus taper) when less than 3 weeks remain after taper', () => {
  const weeks = buildRacePhases('2026-01-01', '2026-01-15', estimateFinishMinutes('running', 5000)); // 2 weeks total
  expect(weeks.every((w) => w.phase === 'specific' || w.phase === 'taper' || w.isDeload)).toBe(true);
  expect(weeks.some((w) => w.phase === 'base' || w.phase === 'build')).toBe(false);
});

test('buildRacePhases returns nothing for a target date that has already passed', () => {
  expect(buildRacePhases('2026-06-01', '2026-01-01', 30)).toEqual([]);
});

test('a deload week lands every 3-4 weeks, never the first week', () => {
  const weeks = buildBudgetPhases('2026-01-01', '2026-06-01'); // ~22 weeks
  expect(weeks[0].isDeload).toBe(false);
  const deloadIndexes = weeks.filter((w) => w.isDeload).map((w) => w.weekIndex);
  for (let i = 1; i < deloadIndexes.length; i++) {
    expect(deloadIndexes[i] - deloadIndexes[i - 1]).toBe(4);
  }
});

test('buildBudgetPhases ramps week 1 below full volume', () => {
  const weeks = buildBudgetPhases('2026-01-01', '2026-06-01');
  expect(weeks[0].volumeFactor).toBeLessThan(weeks[1].volumeFactor);
});

test('deload weeks always run lighter than a build week', () => {
  const weeks = buildBudgetPhases('2026-01-01', '2026-06-01');
  const build = weeks.find((w) => !w.isDeload && w.weekIndex > 0)!;
  const deload = weeks.find((w) => w.isDeload)!;
  expect(deload.volumeFactor).toBeLessThan(build.volumeFactor);
});
