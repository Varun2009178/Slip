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
