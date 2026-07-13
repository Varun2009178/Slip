import { beforeEach, describe, expect, it } from 'vitest';
import { addSnooze, dueSnoozeIds, loadSnoozes, pendingSnoozeIds, removeSnooze } from './snooze';

beforeEach(() => localStorage.clear());

describe('snooze store', () => {
  it('round-trips ids with wake times', () => {
    addSnooze('m1', 1000);
    addSnooze('m2', 2000);
    expect(loadSnoozes()).toEqual({ m1: 1000, m2: 2000 });
    removeSnooze('m1');
    expect(loadSnoozes()).toEqual({ m2: 2000 });
  });

  it('splits due from pending around now', () => {
    addSnooze('past', 500);
    addSnooze('future', 5000);
    expect(dueSnoozeIds(1000)).toEqual(['past']);
    expect(pendingSnoozeIds(1000)).toEqual(['future']);
  });

  it('survives corrupt storage', () => {
    localStorage.setItem('tiny-mail-snoozes', '{not json');
    expect(loadSnoozes()).toEqual({});
  });
});
