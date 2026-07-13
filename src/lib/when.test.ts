import { describe, expect, it } from 'vitest';
import { snoozePresets } from './when';

// Wed 2026-07-08 21:00 local
const now = new Date(2026, 6, 8, 21, 0);

describe('snoozePresets', () => {
  it('later today is +3h', () => {
    const p = snoozePresets(now).find((x) => x.label === 'Later today')!;
    expect(p.when.getTime() - now.getTime()).toBe(3 * 3600_000);
  });

  it('tomorrow is next day 8am', () => {
    const p = snoozePresets(now).find((x) => x.label === 'Tomorrow')!;
    expect([p.when.getDate(), p.when.getHours()]).toEqual([9, 8]);
  });

  it('weekend is Saturday 8am, next week is Monday 8am, both in the future', () => {
    const wk = snoozePresets(now).find((x) => x.label === 'This weekend')!;
    const mo = snoozePresets(now).find((x) => x.label === 'Next week')!;
    expect([wk.when.getDay(), wk.when.getHours()]).toEqual([6, 8]);
    expect([mo.when.getDay(), mo.when.getHours()]).toEqual([1, 8]);
    expect(wk.when.getTime()).toBeGreaterThan(now.getTime());
    expect(mo.when.getTime()).toBeGreaterThan(now.getTime());
  });

  it('weekend from a Saturday jumps to the next Saturday', () => {
    const sat = new Date(2026, 6, 11, 12, 0); // Sat noon
    const wk = snoozePresets(sat).find((x) => x.label === 'This weekend')!;
    expect(wk.when.getDay()).toBe(6);
    expect(wk.when.getTime()).toBeGreaterThan(sat.getTime());
  });
});
