import { expect, test } from 'vitest';
import { formatMmSs } from './format';

test('formatMmSs pads seconds and floors partial seconds', () => {
  expect(formatMmSs(1380)).toBe('23:00');
  expect(formatMmSs(65)).toBe('1:05');
  expect(formatMmSs(5)).toBe('0:05');
});

test('formatMmSs handles a negative delta with a leading sign', () => {
  expect(formatMmSs(-30)).toBe('-0:30');
});
