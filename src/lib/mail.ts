import type { Email } from './types';

export function sortInbox(emails: Email[]): Email[] {
  return [...emails].sort((a, b) => {
    if (a.starred !== b.starred) return a.starred ? -1 : 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

export function faviconUrl(fromEmail: string): string | null {
  const domain = fromEmail.split('@')[1];
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

export function senderInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export function formatDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
