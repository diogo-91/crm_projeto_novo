import { expect, it, vi } from 'vitest';
import { localDateInput, utcFromLocal, localDayInterval, targetHref } from './dates';
it('datetime-local round trips an instant and never appends an implicit UTC suffix', () => {
  const date = new Date(2026, 9, 7, 12, 30);
  expect(utcFromLocal(localDateInput(date.toISOString()))).toBe(date.toISOString());
  expect(utcFromLocal('')).toBeNull();
  expect(() => utcFromLocal('invalid')).toThrow('inválido');
  expect(() => utcFromLocal('2026-02-30T12:00')).toThrow('inválido');
});
it('today interval includes the complete local day and excludes the next day', () => {
  const now = new Date(2026, 9, 7, 18, 45),
    range = localDayInterval(now);
  expect(new Date(range.from)).toEqual(new Date(2026, 9, 7));
  expect(new Date(range.until).getTime() + 1).toBe(new Date(2026, 9, 8).getTime());
  expect(Date.parse(range.from)).toBeLessThan(now.getTime());
});
it('target routes use the existing resource detail pages', () => {
  expect(targetHref('contact', 'id')).toBe('/contacts/id');
  expect(targetHref('lead', 'id')).toBe('/leads/id');
  expect(targetHref('opportunity', 'id')).toBe('/crm/id');
});

it('DST gaps are rejected and local days can contain 23 or 25 hours', () => {
  vi.stubEnv('TZ', 'America/New_York');
  try {
    expect(() => utcFromLocal('2026-03-08T02:30')).toThrow('inválido');
    const spring = localDayInterval(new Date(2026, 2, 8, 12)),
      fall = localDayInterval(new Date(2026, 10, 1, 12));
    expect(Date.parse(spring.until) + 1 - Date.parse(spring.from)).toBe(23 * 3600000);
    expect(Date.parse(fall.until) + 1 - Date.parse(fall.from)).toBe(25 * 3600000);
  } finally {
    vi.unstubAllEnvs();
  }
});
