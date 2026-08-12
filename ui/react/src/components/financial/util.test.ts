import { formatEur, currentMonth, today } from './util';

test('formatEur renders euro currency', () => {
  expect(formatEur(1234.5)).toContain('1.234,5'); // de-DE grouping
  expect(formatEur(0)).toContain('€');
});

test('currentMonth is YYYY-MM', () => {
  expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
});

test('today is YYYY-MM-DD', () => {
  expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
