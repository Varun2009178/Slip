import { describe, expect, it } from 'vitest';
import { filterCommands } from './commands';

const cmds = [
  { label: 'Compose' },
  { label: 'Reply' },
  { label: 'Mark done' },
  { label: 'Go to Inbox' },
  { label: 'Go to Read' },
  { label: 'Go to Drafts' },
  { label: 'Refresh inbox' },
  { label: 'Toggle theme' },
];

describe('filterCommands', () => {
  it('returns everything, in order, for an empty query', () => {
    expect(filterCommands(cmds, '')).toEqual(cmds);
    expect(filterCommands(cmds, '  ')).toEqual(cmds);
  });

  it('is case-insensitive', () => {
    expect(filterCommands(cmds, 'COMP')[0].label).toBe('Compose');
  });

  it('ranks label-prefix matches above word-start matches', () => {
    // "re" prefixes Reply and Refresh, and word-starts nothing else
    const labels = filterCommands(cmds, 're').map((c) => c.label);
    expect(labels.slice(0, 2)).toEqual(['Reply', 'Refresh inbox']);
  });

  it('ranks word-start matches above plain substrings', () => {
    // "in" word-starts "Inbox" in "Go to Inbox" and "Refresh inbox",
    // but is only an inner substring of nothing else here
    const labels = filterCommands(cmds, 'in').map((c) => c.label);
    expect(labels).toEqual(['Go to Inbox', 'Refresh inbox']);
  });

  it('ranks acronym matches above generic subsequences', () => {
    // "gtd" is the acronym of Go-To-Drafts, but also a plain subsequence of
    // "Go To reaD" — the acronym must win
    expect(filterCommands(cmds, 'gtd')[0].label).toBe('Go to Drafts');
    expect(filterCommands(cmds, 'gtr')[0].label).toBe('Go to Read');
  });

  it('matches subsequences for quick abbreviations', () => {
    expect(filterCommands(cmds, 'mdn').map((c) => c.label)).toEqual(['Mark done']);
  });

  it('drops non-matches entirely', () => {
    expect(filterCommands(cmds, 'zzz')).toEqual([]);
  });
});
