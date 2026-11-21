import { expect, test } from 'vitest';
import { CARDIO_DISCIPLINES, DISCIPLINES, MIX_DISCIPLINE_LIST } from './disciplines';

test('walking is cardio but not raceable -- Mix includes it, the event picker does not', () => {
  expect(DISCIPLINES.walking.cardio).toBe(true);
  expect(DISCIPLINES.walking.raceable).toBe(false);
});

test('Mix / all of the above includes every cardio discipline, walking included', () => {
  const ids = MIX_DISCIPLINE_LIST.map((d) => d.id);
  expect(ids).toEqual(expect.arrayContaining(['running', 'cycling', 'swimming', 'rowing', 'walking']));
  expect(ids).not.toContain('lifting');
  expect(ids).not.toContain('sports');
});

test('CARDIO_DISCIPLINES is exactly the five generator-eligible disciplines', () => {
  expect(new Set(CARDIO_DISCIPLINES)).toEqual(new Set(['running', 'cycling', 'swimming', 'rowing', 'walking']));
});
