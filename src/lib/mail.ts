import type { Email } from '../data/emails';

export function sortInbox(emails: Email[]): Email[] {
  return [...emails].sort((a, b) => {
    if (a.important !== b.important) return a.important ? -1 : 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

export function formatDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
