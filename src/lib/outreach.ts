import type { Email } from './types';

// ── Types ──────────────────────────────────────────────────

export type RecipientStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'replied';

export interface Recipient {
  id: string;
  fields: Record<string, string>; // keyed by column name; 'email' required
  status: RecipientStatus;
  messageId?: string;
  threadId?: string;
  sentAt?: string; // ISO 8601
  error?: string; // last failure, user-visible
  override?: { subject: string; body: string }; // per-recipient edit from preview
}

export type CampaignState = 'draft' | 'sending' | 'paused' | 'done';

export interface Campaign {
  id: string;
  name: string;
  createdAt: string;
  columns: string[]; // ordered; must include 'email' to be sendable
  subjectTemplate: string;
  bodyTemplate: string;
  recipients: Recipient[];
  state: CampaignState;
}

// ── Parsing ────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

export interface ParsedPaste {
  columns: string[];
  rows: Record<string, string>[];
}

// Sheets pastes as TSV. The first row is headers unless a cell in it is an
// email address — then it's data and columns get auto names, with the email
// column detected so templates can rely on 'email' existing.
export function parsePasted(text: string): ParsedPaste {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');
  if (lines.length === 0) return { columns: [], rows: [] };
  const grid = lines.map((l) => l.split('\t').map((c) => c.trim()));
  const firstIsData = grid[0].some(isValidEmail);
  const columns = firstIsData
    ? grid[0].map((cell, i) => (isValidEmail(cell) ? 'email' : `col${i + 1}`))
    : grid[0].map((h, i) => h.toLowerCase() || `col${i + 1}`);
  const dataRows = firstIsData ? grid : grid.slice(1);
  const rows = dataRows.map((cells) =>
    Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? ''])),
  );
  return { columns, rows };
}

// ── Templating ─────────────────────────────────────────────

const VAR_RE = /\{\{\s*([\w-]+)\s*\}\}/g;

export function templateVars(tpl: string): string[] {
  return [...new Set([...tpl.matchAll(VAR_RE)].map((m) => m[1]))];
}

export function renderTemplate(tpl: string, fields: Record<string, string>): string {
  return tpl.replace(VAR_RE, (whole, name: string) => fields[name] ?? whole);
}

// ── Constructors ───────────────────────────────────────────

export function newRecipient(fields: Record<string, string>): Recipient {
  return { id: crypto.randomUUID(), fields, status: 'queued' };
}

export function newCampaign(): Campaign {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    name: `${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} batch`,
    createdAt: now.toISOString(),
    columns: ['name', 'email'],
    subjectTemplate: '',
    bodyTemplate: '',
    recipients: [],
    state: 'draft',
  };
}

// ── Table editing (all pure) ───────────────────────────────

function mapRecipient(c: Campaign, id: string, f: (r: Recipient) => Recipient): Campaign {
  return { ...c, recipients: c.recipients.map((r) => (r.id === id ? f(r) : r)) };
}

export function setCell(c: Campaign, recipientId: string, column: string, value: string): Campaign {
  return mapRecipient(c, recipientId, (r) => ({ ...r, fields: { ...r.fields, [column]: value } }));
}

export function addRow(c: Campaign): Campaign {
  return { ...c, recipients: [...c.recipients, newRecipient({})] };
}

export function removeRow(c: Campaign, recipientId: string): Campaign {
  return { ...c, recipients: c.recipients.filter((r) => r.id !== recipientId) };
}

export function addColumn(c: Campaign, name: string): Campaign {
  const col = name.trim().toLowerCase();
  if (!col || c.columns.includes(col)) return c;
  return { ...c, columns: [...c.columns, col] };
}

export function renameColumn(c: Campaign, from: string, to: string): Campaign {
  const col = to.trim().toLowerCase();
  if (!col || from === 'email' || c.columns.includes(col) || !c.columns.includes(from)) return c;
  return {
    ...c,
    columns: c.columns.map((x) => (x === from ? col : x)),
    recipients: c.recipients.map((r) => {
      const { [from]: value, ...rest } = r.fields;
      return { ...r, fields: value === undefined ? rest : { ...rest, [col]: value } };
    }),
  };
}

export function removeColumn(c: Campaign, name: string): Campaign {
  if (name === 'email' || !c.columns.includes(name)) return c;
  return {
    ...c,
    columns: c.columns.filter((x) => x !== name),
    recipients: c.recipients.map((r) => {
      const { [name]: _dropped, ...rest } = r.fields;
      return { ...r, fields: rest };
    }),
  };
}

// A row is "blank" if every field is empty — a fresh addRow() row shouldn't
// block a paste from acting as a clean import.
function hasData(c: Campaign): boolean {
  return c.recipients.some((r) => Object.values(r.fields).some((v) => v.trim() !== ''));
}

export function applyPaste(c: Campaign, text: string): Campaign {
  const { columns, rows } = parsePasted(text);
  if (rows.length === 0) return c;
  const pasted = rows.map(newRecipient);
  if (!hasData(c)) return { ...c, columns, recipients: pasted };
  const merged = [...c.columns, ...columns.filter((col) => !c.columns.includes(col))];
  return { ...c, columns: merged, recipients: [...c.recipients, ...pasted] };
}

// ── Validation ─────────────────────────────────────────────

export interface Issue {
  kind: 'no-recipients' | 'no-email-column' | 'bad-email' | 'unknown-var' | 'empty-value';
  message: string;
  recipientId?: string;
  variable?: string;
}

export function validateCampaign(c: Campaign): Issue[] {
  const issues: Issue[] = [];
  if (c.recipients.length === 0) {
    issues.push({ kind: 'no-recipients', message: 'add at least one person' });
  }
  if (!c.columns.includes('email')) {
    issues.push({ kind: 'no-email-column', message: "the table needs an 'email' column" });
  }
  const vars = [...new Set([...templateVars(c.subjectTemplate), ...templateVars(c.bodyTemplate)])];
  for (const v of vars) {
    if (!c.columns.includes(v)) {
      issues.push({ kind: 'unknown-var', message: `{{${v}}} doesn't match any column`, variable: v });
    }
  }
  for (const r of c.recipients) {
    if (!isValidEmail(r.fields.email ?? '')) {
      issues.push({
        kind: 'bad-email',
        message: `"${r.fields.email ?? ''}" isn't a valid email`,
        recipientId: r.id,
      });
    }
    if (r.override) continue; // hand-edited emails don't use the template
    for (const v of vars) {
      if (c.columns.includes(v) && !(r.fields[v] ?? '').trim()) {
        issues.push({ kind: 'empty-value', message: `missing {{${v}}}`, recipientId: r.id, variable: v });
      }
    }
  }
  return issues;
}

// Issues that block sending; empty-value is a warning (fixable in preview).
export function blockingIssues(issues: Issue[]): Issue[] {
  return issues.filter((i) => i.kind !== 'empty-value');
}

// ── Rendering for send ─────────────────────────────────────

export function renderedFor(c: Campaign, r: Recipient): { subject: string; body: string } {
  return (
    r.override ?? {
      subject: renderTemplate(c.subjectTemplate, r.fields),
      body: renderTemplate(c.bodyTemplate, r.fields),
    }
  );
}

// ── Send-state transitions ─────────────────────────────────

function setStatus(c: Campaign, id: string, patch: Partial<Recipient>): Campaign {
  return mapRecipient(c, id, (r) => ({ ...r, ...patch }));
}

// Once nothing is queued or in flight, a sending campaign is done.
function settle(c: Campaign): Campaign {
  const active = c.recipients.some((r) => r.status === 'queued' || r.status === 'sending');
  return c.state === 'sending' && !active ? { ...c, state: 'done' } : c;
}

export function startNextSend(c: Campaign): { campaign: Campaign; recipient: Recipient } | null {
  if (c.state !== 'sending') return null;
  const next = c.recipients.find((r) => r.status === 'queued');
  if (!next) return null;
  const recipient: Recipient = { ...next, status: 'sending' };
  return { campaign: mapRecipient(c, next.id, () => recipient), recipient };
}

export function recordSent(c: Campaign, id: string, sent: { id: string; threadId: string }): Campaign {
  return settle(
    setStatus(c, id, {
      status: 'sent',
      messageId: sent.id,
      threadId: sent.threadId,
      sentAt: new Date().toISOString(),
      error: undefined,
    }),
  );
}

export function recordFailed(c: Campaign, id: string, error: string): Campaign {
  return settle(setStatus(c, id, { status: 'failed', error }));
}

export function retryRecipient(c: Campaign, id: string): Campaign {
  const r = c.recipients.find((x) => x.id === id);
  if (r?.status !== 'failed') return c;
  return setStatus(c, id, { status: 'queued', error: undefined });
}

// Auth expired before the API accepted the send — safe to put back in line.
export function requeueRecipient(c: Campaign, id: string): Campaign {
  const r = c.recipients.find((x) => x.id === id);
  if (r?.status !== 'sending') return c;
  return setStatus(c, id, { status: 'queued' });
}

export function recordReplied(c: Campaign, id: string): Campaign {
  const r = c.recipients.find((x) => x.id === id);
  if (r?.status !== 'sent') return c;
  return setStatus(c, id, { status: 'replied' });
}

// ── Reply detection ────────────────────────────────────────

export function hasReply(thread: Email[], selfEmail: string): boolean {
  const self = selfEmail.trim().toLowerCase();
  return thread.some((m) => m.fromEmail.trim().toLowerCase() !== self);
}

// ── Pacing ─────────────────────────────────────────────────

export const MIN_GAP_MS = 45_000;
export const MAX_GAP_MS = 120_000;

export function nextSendDelayMs(rand: () => number = Math.random): number {
  return Math.floor(MIN_GAP_MS + rand() * (MAX_GAP_MS - MIN_GAP_MS));
}
