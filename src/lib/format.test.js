import { daysFrom, toInstant } from './format';

test('KST datetime input is converted without using browser local timezone', () => {
  expect(toInstant('2026-11-09T20:00')).toBe('2026-11-09T11:00:00.000Z');
});
test('12 inclusive dates cross month and year boundaries', () => {
  const days = daysFrom('2026-12-25');
  expect(days).toHaveLength(12);
  expect(days[0]).toBe('2026-12-25');
  expect(days[11]).toBe('2027-01-05');
});
