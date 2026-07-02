import { describe, expect, it } from 'vitest';
import { formatDate, sortInbox } from './mail';
import type { Email } from '../data/emails';

function email(overrides: Partial<Email>): Email {
  return {
    id: 'x',
    from: 'A',
    fromEmail: 'a@a.com',
    subject: 's',
    body: 'b',
    date: '2026-07-01T10:00:00',
    important: false,
    thread: [],
    ...overrides,
  };
}

describe('sortInbox', () => {
  it('pins important emails to the top', () => {
    const list = [
      email({ id: 'a', date: '2026-07-01T10:00:00', important: false }),
      email({ id: 'b', date: '2026-06-01T10:00:00', important: true }),
    ];
    expect(sortInbox(list).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('sorts newest-first within each group', () => {
    const list = [
      email({ id: 'old', date: '2026-06-01T10:00:00' }),
      email({ id: 'new', date: '2026-07-01T10:00:00' }),
      email({ id: 'pin-old', date: '2026-05-01T10:00:00', important: true }),
      email({ id: 'pin-new', date: '2026-06-15T10:00:00', important: true }),
    ];
    expect(sortInbox(list).map((e) => e.id)).toEqual(['pin-new', 'pin-old', 'new', 'old']);
  });

  it('does not mutate the input array', () => {
    const list = [
      email({ id: 'a', date: '2026-06-01T10:00:00' }),
      email({ id: 'b', date: '2026-07-01T10:00:00' }),
    ];
    sortInbox(list);
    expect(list.map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('formatDate', () => {
  const now = new Date('2026-07-01T12:00:00');

  it('shows time of day for same-day dates', () => {
    expect(formatDate('2026-07-01T09:12:00', now)).toMatch(/9:12/);
  });

  it('shows month and day for older dates', () => {
    expect(formatDate('2026-06-28T09:12:00', now)).toMatch(/Jun 28/);
  });
});
