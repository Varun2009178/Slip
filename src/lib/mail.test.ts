import { describe, expect, it } from 'vitest';
import { faviconUrl, formatDate, senderInitial, sortInbox } from './mail';
import type { Email } from './types';

function email(overrides: Partial<Email>): Email {
  return {
    id: 'x',
    threadId: 'tx',
    rfcMessageId: '<x@mail>',
    from: 'A',
    fromEmail: 'a@a.com',
    subject: 's',
    snippet: 'sn',
    body: 'b',
    bodyHtml: null,
    date: '2026-07-01T10:00:00',
    unread: true,
    starred: false,
    ...overrides,
  };
}

describe('sortInbox', () => {
  it('pins starred emails to the top', () => {
    const list = [
      email({ id: 'a', date: '2026-07-01T10:00:00', starred: false }),
      email({ id: 'b', date: '2026-06-01T10:00:00', starred: true }),
    ];
    expect(sortInbox(list).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('sorts newest-first within each group', () => {
    const list = [
      email({ id: 'old', date: '2026-06-01T10:00:00' }),
      email({ id: 'new', date: '2026-07-01T10:00:00' }),
      email({ id: 'pin-old', date: '2026-05-01T10:00:00', starred: true }),
      email({ id: 'pin-new', date: '2026-06-15T10:00:00', starred: true }),
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

describe('faviconUrl', () => {
  it('builds a favicon url from the sender domain', () => {
    expect(faviconUrl('noreply@github.com')).toContain('domain=github.com');
  });

  it('returns null when there is no domain', () => {
    expect(faviconUrl('not-an-email')).toBeNull();
  });
});

describe('senderInitial', () => {
  it('uses the first letter, uppercased', () => {
    expect(senderInitial('dana whitfield')).toBe('D');
  });

  it('falls back to ? for empty names', () => {
    expect(senderInitial('')).toBe('?');
  });
});
