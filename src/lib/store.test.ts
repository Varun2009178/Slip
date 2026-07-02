import { beforeEach, describe, expect, it } from 'vitest';
import { loadState, saveState } from './store';

describe('store', () => {
  beforeEach(() => localStorage.clear());

  it('returns empty state when nothing is saved', () => {
    expect(loadState()).toEqual({ readIds: [], doneIds: [] });
  });

  it('round-trips saved state', () => {
    saveState({ readIds: ['e1'], doneIds: ['e2', 'e3'] });
    expect(loadState()).toEqual({ readIds: ['e1'], doneIds: ['e2', 'e3'] });
  });

  it('returns empty state on corrupted data', () => {
    localStorage.setItem('tiny-mail-state', '{not json');
    expect(loadState()).toEqual({ readIds: [], doneIds: [] });
  });

  it('returns empty state on wrong shape', () => {
    localStorage.setItem('tiny-mail-state', JSON.stringify({ readIds: 'nope' }));
    expect(loadState()).toEqual({ readIds: [], doneIds: [] });
  });
});
