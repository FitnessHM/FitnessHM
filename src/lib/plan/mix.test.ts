import { expect, test } from 'vitest';
import { DisciplineCycle, buildDisciplineShares } from './mix';

test('a single discipline always gets every turn', () => {
  const cycle = new DisciplineCycle(['running'], [1]);
  for (let i = 0; i < 5; i++) expect(cycle.next()).toBe('running');
});

test('the primary discipline gets roughly double the turns of a secondary one', () => {
  const shares = buildDisciplineShares(['running', 'cycling'], 'running');
  const cycle = new DisciplineCycle(['running', 'cycling'], shares);
  const counts: Record<string, number> = { running: 0, cycling: 0 };
  for (let i = 0; i < 30; i++) counts[cycle.next()]++;
  expect(counts.running).toBeGreaterThan(counts.cycling);
  expect(counts.running / counts.cycling).toBeCloseTo(2, 0);
});

test('every discipline still appears regularly even with fewer weekly slots than disciplines', () => {
  const shares = buildDisciplineShares(['running', 'cycling', 'swimming'], 'running');
  const cycle = new DisciplineCycle(['running', 'cycling', 'swimming'], shares);
  const seen = new Set<string>();
  for (let i = 0; i < 10; i++) seen.add(cycle.next());
  expect(seen).toEqual(new Set(['running', 'cycling', 'swimming']));
});

test('interleaves fairly rather than clumping one discipline at the start', () => {
  const shares = buildDisciplineShares(['running', 'cycling'], 'running');
  const cycle = new DisciplineCycle(['running', 'cycling'], shares);
  const sequence = Array.from({ length: 6 }, () => cycle.next());
  // Not all of one discipline followed by all of the other.
  expect(sequence).not.toEqual(['running', 'running', 'running', 'running', 'cycling', 'cycling']);
});
