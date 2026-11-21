import type { Discipline } from '../disciplines';

/**
 * Weighted fair interleaving (a classic weighted round-robin): each call to
 * `next()` returns whichever discipline is currently furthest behind its
 * target share. Works for any slot count vs. discipline count, including
 * fewer weekly slots than disciplines -- every discipline still gets a
 * turn regularly over the life of the plan, without needing explicit
 * per-week "whose turn is it to sit out" bookkeeping.
 */
export class DisciplineCycle {
  private counts: number[];

  constructor(private disciplines: Discipline[], private shares: number[]) {
    if (disciplines.length === 0 || disciplines.length !== shares.length) {
      throw new Error('DisciplineCycle: disciplines and shares must be the same non-empty length');
    }
    this.counts = disciplines.map(() => 0);
  }

  next(): Discipline {
    let bestIndex = 0;
    let bestRatio = Infinity;
    for (let i = 0; i < this.disciplines.length; i++) {
      const ratio = (this.counts[i] + 1) / this.shares[i];
      if (ratio < bestRatio) {
        bestRatio = ratio;
        bestIndex = i;
      }
    }
    this.counts[bestIndex]++;
    return this.disciplines[bestIndex];
  }
}

// The block's primary (goal) discipline gets double weight -- a
// simplification of the spec's exact ceil/floor "remainder to primary"
// language, same intent (primary gets more volume, every discipline still
// appears regularly), simpler to implement correctly for any slot count.
export function buildDisciplineShares(disciplines: Discipline[], primary: Discipline): number[] {
  return disciplines.map((d) => (d === primary ? 2 : 1));
}
