import { beforeEach, describe, expect, it } from 'vitest';
import { addDoneId, loadDoneIds, removeDoneId } from './done';

describe('done list', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', () => {
    expect(loadDoneIds()).toEqual([]);
  });

  it('adds newest first and persists', () => {
    addDoneId('a');
    addDoneId('b');
    expect(loadDoneIds()).toEqual(['b', 'a']);
  });

  it('deduplicates re-added ids', () => {
    addDoneId('a');
    addDoneId('b');
    addDoneId('a');
    expect(loadDoneIds()).toEqual(['a', 'b']);
  });

  it('removes ids', () => {
    addDoneId('a');
    addDoneId('b');
    removeDoneId('a');
    expect(loadDoneIds()).toEqual(['b']);
  });

  it('caps at 50 entries', () => {
    for (let i = 0; i < 60; i++) addDoneId(`m${i}`);
    const ids = loadDoneIds();
    expect(ids).toHaveLength(50);
    expect(ids[0]).toBe('m59');
  });

  it('survives corrupted storage', () => {
    localStorage.setItem('tiny-mail-done', '{nope');
    expect(loadDoneIds()).toEqual([]);
  });
});
