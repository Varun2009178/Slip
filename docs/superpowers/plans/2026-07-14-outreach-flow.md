# Outreach Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Slip into the outreach tool: paste a list, write one `{{variable}}` template, preview every email, send staggered 45–120 s apart from the user's own Gmail, and track who replied.

**Architecture:** All domain logic (parsing, templating, validation, campaign state transitions) is pure functions in `src/lib/outreach.ts`, test-first. Persistence is a thin localStorage module (`src/lib/campaignStore.ts`). A React hook (`src/hooks/useCampaignSender.ts`) drives the send loop at App level so in-app navigation never pauses a run. Four wizard screens render inside the existing shell.

**Tech Stack:** React 19 + TypeScript + Vite, vitest (jsdom), existing `src/lib/gmail.ts` for all Gmail API calls. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-13-outreach-flow-design.md`

**Conventions to follow (from this codebase):** lowercase UI copy, CSS in `src/styles.css` using vars `--muted/--hover/--active/--surface/--text`, localStorage wrapped in try/catch (see `src/lib/snooze.ts`), tests colocated as `src/lib/*.test.ts` in vitest `describe/it` style.

---

## File map

| File | Responsibility |
|---|---|
| `src/lib/outreach.ts` (create) | Types + all pure domain logic |
| `src/lib/outreach.test.ts` (create) | Tests for the above |
| `src/lib/campaignStore.ts` (create) | localStorage load/save/upsert + crash normalization |
| `src/lib/campaignStore.test.ts` (create) | Tests for the above |
| `src/lib/gmail.ts` (modify) | `sendEmail` returns `{id, threadId}`; add `fetchSelfEmail` |
| `src/hooks/useCampaignSender.ts` (create) | Send loop: send → wait 45–120 s → repeat; pause on 401 |
| `src/components/Campaigns.tsx` (create) | Campaigns home (list + new batch) |
| `src/components/RecipientTable.tsx` (create) | Step 1 "people": Notion-style table + Sheets paste |
| `src/components/TemplateStep.tsx` (create) | Step 2 "write": subject/body templates + variable chips |
| `src/components/PreviewStep.tsx` (create) | Step 3 "preview": rendered emails + per-recipient overrides |
| `src/components/SendStep.tsx` (create) | Step 4 "send": run controls, live status, reply tracking |
| `src/components/CampaignWizard.tsx` (create) | Step tabs + renders the active step |
| `src/components/Sidebar.tsx` (modify) | Add "outreach" nav entry |
| `src/App.tsx` (modify) | View union, campaign state, sender hook, landing, palette |
| `src/styles.css` (modify) | Styles for all of the above (appended) |

---

### Task 1: Domain core — parsing and templating

**Files:**
- Create: `src/lib/outreach.ts`
- Test: `src/lib/outreach.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/outreach.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  parsePasted,
  renderTemplate,
  templateVars,
} from './outreach';

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('ada@cs.stanford.edu')).toBe(true);
  });
  it('rejects junk', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
  it('tolerates surrounding whitespace', () => {
    expect(isValidEmail('  ada@cs.stanford.edu ')).toBe(true);
  });
});

describe('parsePasted', () => {
  it('uses the first row as headers when it has no email', () => {
    const text = 'name\temail\tpaper\nAda\tada@cs.stanford.edu\tOn Computable Numbers';
    expect(parsePasted(text)).toEqual({
      columns: ['name', 'email', 'paper'],
      rows: [{ name: 'Ada', email: 'ada@cs.stanford.edu', paper: 'On Computable Numbers' }],
    });
  });
  it('lowercases header names', () => {
    const text = 'Name\tEmail\nAda\tada@cs.stanford.edu';
    expect(parsePasted(text).columns).toEqual(['name', 'email']);
  });
  it('treats the first row as data when it contains an email, auto-naming columns', () => {
    const text = 'Ada\tada@cs.stanford.edu\nGrace\tgrace@mit.edu';
    expect(parsePasted(text)).toEqual({
      columns: ['col1', 'email'],
      rows: [
        { col1: 'Ada', email: 'ada@cs.stanford.edu' },
        { col1: 'Grace', email: 'grace@mit.edu' },
      ],
    });
  });
  it('handles CRLF, blank lines, and ragged short rows', () => {
    const text = 'name\temail\r\nAda\tada@cs.stanford.edu\r\n\r\nGrace\t';
    expect(parsePasted(text).rows).toEqual([
      { name: 'Ada', email: 'ada@cs.stanford.edu' },
      { name: 'Grace', email: '' },
    ]);
  });
  it('returns empty for empty paste', () => {
    expect(parsePasted('  \n ')).toEqual({ columns: [], rows: [] });
  });
});

describe('templateVars', () => {
  it('finds unique variables, whitespace-tolerant', () => {
    expect(templateVars('hi {{name}}, i read {{ paper }} and {{name}}')).toEqual([
      'name',
      'paper',
    ]);
  });
  it('is empty for a plain string', () => {
    expect(templateVars('no variables here')).toEqual([]);
  });
});

describe('renderTemplate', () => {
  it('substitutes fields', () => {
    expect(renderTemplate('hi {{name}}, re: {{ paper }}', { name: 'Ada', paper: 'CN' })).toBe(
      'hi Ada, re: CN',
    );
  });
  it('leaves unknown variables literal so they are visible in preview', () => {
    expect(renderTemplate('hi {{nmae}}', { name: 'Ada' })).toBe('hi {{nmae}}');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/outreach.test.ts`
Expected: FAIL — cannot resolve `./outreach`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/outreach.ts`:

```ts
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
```

(The `Email` import is used by `hasReply` in Task 3; TypeScript may flag it as unused until then — if so, add it in Task 3 instead.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/outreach.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/outreach.ts src/lib/outreach.test.ts
git commit -m "feat: outreach domain core — sheets paste parsing and {{var}} templating"
```

---

### Task 2: Domain — constructors, table editing, validation

**Files:**
- Modify: `src/lib/outreach.ts` (append)
- Test: `src/lib/outreach.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/outreach.test.ts` (extend the import from `./outreach` with the new names):

```ts
import {
  addColumn,
  addRow,
  applyPaste,
  newCampaign,
  newRecipient,
  removeColumn,
  removeRow,
  renameColumn,
  setCell,
  validateCampaign,
} from './outreach';

describe('newCampaign', () => {
  it('starts as an empty draft with name and email columns', () => {
    const c = newCampaign();
    expect(c.state).toBe('draft');
    expect(c.columns).toEqual(['name', 'email']);
    expect(c.recipients).toEqual([]);
    expect(c.id).not.toBe(newCampaign().id);
  });
});

describe('table editing', () => {
  it('setCell writes a field on one recipient', () => {
    let c = addRow(newCampaign());
    c = setCell(c, c.recipients[0].id, 'name', 'Ada');
    expect(c.recipients[0].fields.name).toBe('Ada');
  });
  it('addRow/removeRow', () => {
    let c = addRow(addRow(newCampaign()));
    expect(c.recipients).toHaveLength(2);
    c = removeRow(c, c.recipients[0].id);
    expect(c.recipients).toHaveLength(1);
  });
  it('addColumn ignores duplicates and empties', () => {
    let c = addColumn(newCampaign(), 'paper');
    expect(c.columns).toEqual(['name', 'email', 'paper']);
    expect(addColumn(c, 'paper').columns).toEqual(['name', 'email', 'paper']);
    expect(addColumn(c, '  ').columns).toEqual(['name', 'email', 'paper']);
  });
  it('renameColumn renames the column and every row key', () => {
    let c = addRow(newCampaign());
    c = setCell(c, c.recipients[0].id, 'name', 'Ada');
    c = renameColumn(c, 'name', 'first');
    expect(c.columns).toEqual(['first', 'email']);
    expect(c.recipients[0].fields).toEqual({ first: 'Ada' });
  });
  it('removeColumn refuses to remove email', () => {
    const c = newCampaign();
    expect(removeColumn(c, 'email').columns).toContain('email');
    expect(removeColumn(c, 'name').columns).toEqual(['email']);
  });
});

describe('applyPaste', () => {
  const text = 'name\temail\nAda\tada@cs.stanford.edu';
  it('replaces columns and rows when the table is empty', () => {
    const c = applyPaste(addRow(newCampaign()), text); // one blank row still counts as empty
    expect(c.columns).toEqual(['name', 'email']);
    expect(c.recipients).toHaveLength(1);
    expect(c.recipients[0].fields.email).toBe('ada@cs.stanford.edu');
  });
  it('appends rows and merges new columns when the table has data', () => {
    let c = applyPaste(newCampaign(), text);
    c = applyPaste(c, 'name\temail\tpaper\nGrace\tgrace@mit.edu\tCOBOL');
    expect(c.columns).toEqual(['name', 'email', 'paper']);
    expect(c.recipients).toHaveLength(2);
    expect(c.recipients[1].fields.paper).toBe('COBOL');
  });
});

describe('validateCampaign', () => {
  function filled(): ReturnType<typeof newCampaign> {
    let c = applyPaste(newCampaign(), 'name\temail\nAda\tada@cs.stanford.edu');
    return { ...c, subjectTemplate: 'hi {{name}}', bodyTemplate: 'about {{name}}' };
  }
  it('passes a complete campaign', () => {
    expect(validateCampaign(filled())).toEqual([]);
  });
  it('flags no recipients', () => {
    const c = { ...filled(), recipients: [] };
    expect(validateCampaign(c).map((i) => i.kind)).toContain('no-recipients');
  });
  it('flags a missing email column', () => {
    const c = filled();
    const noEmail = {
      ...c,
      columns: ['name'],
      recipients: c.recipients.map((r) => ({ ...r, fields: { name: 'Ada' } })),
    };
    expect(validateCampaign(noEmail).map((i) => i.kind)).toContain('no-email-column');
  });
  it('flags invalid emails with the recipient id', () => {
    let c = filled();
    c = setCell(c, c.recipients[0].id, 'email', 'nope');
    const issue = validateCampaign(c).find((i) => i.kind === 'bad-email');
    expect(issue?.recipientId).toBe(c.recipients[0].id);
  });
  it('flags template variables that match no column', () => {
    const c = { ...filled(), bodyTemplate: 'hi {{nmae}}' };
    const issue = validateCampaign(c).find((i) => i.kind === 'unknown-var');
    expect(issue?.variable).toBe('nmae');
  });
  it('flags empty values for used variables, unless the recipient has an override', () => {
    let c = filled();
    c = setCell(c, c.recipients[0].id, 'name', '');
    expect(validateCampaign(c).map((i) => i.kind)).toContain('empty-value');
    const overridden = {
      ...c,
      recipients: c.recipients.map((r) => ({ ...r, override: { subject: 's', body: 'b' } })),
    };
    expect(validateCampaign(overridden).map((i) => i.kind)).not.toContain('empty-value');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/outreach.test.ts`
Expected: FAIL — `newCampaign` (etc.) not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/outreach.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/outreach.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/outreach.ts src/lib/outreach.test.ts
git commit -m "feat: campaign table editing and validation"
```

---

### Task 3: Domain — send-state transitions, reply detection, pacing

**Files:**
- Modify: `src/lib/outreach.ts` (append)
- Test: `src/lib/outreach.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/outreach.test.ts` (extend the `./outreach` import with the new names; also `import type { Email } from './types'`):

```ts
import {
  hasReply,
  MAX_GAP_MS,
  MIN_GAP_MS,
  nextSendDelayMs,
  recordFailed,
  recordReplied,
  recordSent,
  renderedFor,
  requeueRecipient,
  retryRecipient,
  startNextSend,
} from './outreach';

function sendable() {
  let c = applyPaste(newCampaign(), 'name\temail\nAda\tada@cs.stanford.edu\nGrace\tgrace@mit.edu');
  return { ...c, subjectTemplate: 'hi {{name}}', bodyTemplate: 'dear {{name}}', state: 'sending' as const };
}

describe('renderedFor', () => {
  it('renders the templates with the recipient fields', () => {
    const c = sendable();
    expect(renderedFor(c, c.recipients[0])).toEqual({ subject: 'hi Ada', body: 'dear Ada' });
  });
  it('prefers a per-recipient override', () => {
    const c = sendable();
    const r = { ...c.recipients[0], override: { subject: 's', body: 'b' } };
    expect(renderedFor(c, r)).toEqual({ subject: 's', body: 'b' });
  });
});

describe('send-state transitions', () => {
  it('startNextSend picks the first queued recipient and marks it sending', () => {
    const next = startNextSend(sendable());
    expect(next?.recipient.fields.name).toBe('Ada');
    expect(next?.campaign.recipients[0].status).toBe('sending');
  });
  it('startNextSend returns null when paused or exhausted', () => {
    expect(startNextSend({ ...sendable(), state: 'paused' })).toBeNull();
    const done = {
      ...sendable(),
      recipients: sendable().recipients.map((r) => ({ ...r, status: 'sent' as const })),
    };
    expect(startNextSend(done)).toBeNull();
  });
  it('recordSent stores ids and date; campaign becomes done after the last one', () => {
    let c = sendable();
    const first = startNextSend(c)!;
    c = recordSent(first.campaign, first.recipient.id, { id: 'm1', threadId: 't1' });
    expect(c.recipients[0]).toMatchObject({ status: 'sent', messageId: 'm1', threadId: 't1' });
    expect(c.state).toBe('sending'); // one still queued
    const second = startNextSend(c)!;
    c = recordSent(second.campaign, second.recipient.id, { id: 'm2', threadId: 't2' });
    expect(c.state).toBe('done');
  });
  it('recordFailed keeps going and retryRecipient requeues', () => {
    let c = sendable();
    const first = startNextSend(c)!;
    c = recordFailed(first.campaign, first.recipient.id, 'gmail-500');
    expect(c.recipients[0]).toMatchObject({ status: 'failed', error: 'gmail-500' });
    c = retryRecipient(c, c.recipients[0].id);
    expect(c.recipients[0].status).toBe('queued');
    expect(c.recipients[0].error).toBeUndefined();
  });
  it('requeueRecipient puts a sending recipient back to queued (auth-expiry path)', () => {
    const first = startNextSend(sendable())!;
    const c = requeueRecipient(first.campaign, first.recipient.id);
    expect(c.recipients[0].status).toBe('queued');
  });
  it('recordReplied only flips sent recipients', () => {
    let c = sendable();
    const first = startNextSend(c)!;
    c = recordSent(first.campaign, first.recipient.id, { id: 'm1', threadId: 't1' });
    c = recordReplied(c, c.recipients[0].id);
    expect(c.recipients[0].status).toBe('replied');
    expect(recordReplied(c, c.recipients[1].id).recipients[1].status).toBe('queued');
  });
});

describe('hasReply', () => {
  const msg = (fromEmail: string): Email => ({
    id: '1', threadId: 't', rfcMessageId: '', from: fromEmail, fromEmail,
    subject: '', snippet: '', body: '', bodyHtml: null,
    date: new Date().toISOString(), unread: false, starred: false,
  });
  it('is false when every message is from the sender', () => {
    expect(hasReply([msg('me@gmail.com')], 'me@gmail.com')).toBe(false);
  });
  it('is true when someone else appears in the thread, case-insensitively', () => {
    expect(hasReply([msg('me@gmail.com'), msg('Ada@CS.Stanford.EDU')], 'me@gmail.com')).toBe(true);
  });
});

describe('nextSendDelayMs', () => {
  it('stays within 45–120 s', () => {
    expect(nextSendDelayMs(() => 0)).toBe(MIN_GAP_MS);
    expect(nextSendDelayMs(() => 0.999999)).toBeLessThan(MAX_GAP_MS);
    expect(nextSendDelayMs(() => 0.5)).toBe(MIN_GAP_MS + (MAX_GAP_MS - MIN_GAP_MS) / 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/outreach.test.ts`
Expected: FAIL — new exports missing.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/outreach.ts`:

```ts
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
```

Make sure `import type { Email } from './types';` is present at the top of the file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/outreach.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test` — expected: all files pass.

```bash
git add src/lib/outreach.ts src/lib/outreach.test.ts
git commit -m "feat: campaign send-state machine, reply detection, pacing"
```

---

### Task 4: Campaign store (localStorage)

**Files:**
- Create: `src/lib/campaignStore.ts`
- Test: `src/lib/campaignStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/campaignStore.test.ts` (vitest runs in jsdom, so `localStorage` exists — see `RichEditor.test.tsx` precedent):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { newCampaign } from './outreach';
import { loadCampaigns, saveCampaigns, upsertCampaign } from './campaignStore';

beforeEach(() => localStorage.clear());

describe('campaignStore', () => {
  it('round-trips campaigns', () => {
    const c = newCampaign();
    expect(saveCampaigns([c])).toBe(true);
    expect(loadCampaigns()).toEqual([c]);
  });
  it('returns [] for missing or corrupt data', () => {
    expect(loadCampaigns()).toEqual([]);
    localStorage.setItem('slip-campaigns', '{nonsense');
    expect(loadCampaigns()).toEqual([]);
    localStorage.setItem('slip-campaigns', '"a string"');
    expect(loadCampaigns()).toEqual([]);
  });
  it('upsertCampaign prepends new and replaces existing in place', () => {
    const a = newCampaign();
    const b = newCampaign();
    let list = upsertCampaign([a], b);
    expect(list.map((c) => c.id)).toEqual([b.id, a.id]);
    list = upsertCampaign(list, { ...a, name: 'renamed' });
    expect(list[1].name).toBe('renamed');
    expect(list).toHaveLength(2);
  });
  it('normalizes a campaign that died mid-send: paused, in-flight row marked failed', () => {
    const c = {
      ...newCampaign(),
      state: 'sending' as const,
      recipients: [
        { id: 'r1', fields: { email: 'a@b.co' }, status: 'sending' as const },
        { id: 'r2', fields: { email: 'c@d.co' }, status: 'queued' as const },
      ],
    };
    saveCampaigns([c]);
    const [loaded] = loadCampaigns();
    expect(loaded.state).toBe('paused');
    expect(loaded.recipients[0].status).toBe('failed');
    expect(loaded.recipients[0].error).toMatch(/check .*sent/i);
    expect(loaded.recipients[1].status).toBe('queued');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/campaignStore.test.ts`
Expected: FAIL — cannot resolve `./campaignStore`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/campaignStore.ts`:

```ts
// Campaigns in localStorage, written after every mutation (including after
// every individual send) so a refresh or crash never loses progress.

import type { Campaign } from './outreach';

const KEY = 'slip-campaigns';

// A campaign loaded while still 'sending' means the tab died mid-run. It
// comes back paused. A recipient stuck at 'sending' is ambiguous — the send
// may or may not have gone out — so it's marked failed with a message telling
// the user to check Gmail's Sent before retrying, rather than risking a
// silent duplicate email.
function normalize(list: Campaign[]): Campaign[] {
  return list.map((c) =>
    c.state !== 'sending'
      ? c
      : {
          ...c,
          state: 'paused',
          recipients: c.recipients.map((r) =>
            r.status === 'sending'
              ? { ...r, status: 'failed', error: 'interrupted — check sent in gmail before retrying' }
              : r,
          ),
        },
  );
}

export function loadCampaigns(): Campaign[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? normalize(parsed) : [];
  } catch {
    return [];
  }
}

// False when storage is blocked/full — the app keeps working in memory and
// warns that the batch won't survive a refresh.
export function saveCampaigns(list: Campaign[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function upsertCampaign(list: Campaign[], c: Campaign): Campaign[] {
  return list.some((x) => x.id === c.id)
    ? list.map((x) => (x.id === c.id ? c : x))
    : [c, ...list];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/campaignStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/campaignStore.ts src/lib/campaignStore.test.ts
git commit -m "feat: campaign persistence with mid-send crash normalization"
```

---

### Task 5: Gmail additions — send returns ids, fetch own address

**Files:**
- Modify: `src/lib/gmail.ts`

- [ ] **Step 1: Change `sendEmail` to return the API's message ref**

In `src/lib/gmail.ts`, replace the existing `sendEmail` (currently `Promise<void>`, discards the response):

```ts
export interface SentRef {
  id: string;
  threadId: string;
}

export async function sendEmail(mail: OutgoingMail): Promise<SentRef> {
  return api<SentRef>('/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw: toBase64Url(buildMime(mail)), threadId: mail.threadId }),
  });
}
```

Existing callers in `App.tsx` ignore the return value; no call-site changes needed.

- [ ] **Step 2: Add `fetchSelfEmail`**

Add below `fetchProfile` in `src/lib/gmail.ts`:

```ts
// The user's own address, for telling replies apart from their sent mail.
export async function fetchSelfEmail(): Promise<string> {
  const p = await api<{ emailAddress: string }>('/profile');
  return p.emailAddress;
}
```

(`/profile` is `GET gmail/v1/users/me/profile` — covered by the existing gmail scopes; goes through `api()` so it gets auth + retry for free.)

- [ ] **Step 3: Verify**

Run: `npm run lint && npm test && npx tsc -b`
Expected: lint passes (one pre-existing `exhaustive-deps` warning in App.tsx is fine), all tests pass, typecheck clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/gmail.ts
git commit -m "feat: sendEmail returns message/thread ids; fetchSelfEmail"
```

---

### Task 6: Send-runner hook

**Files:**
- Create: `src/hooks/useCampaignSender.ts` (new directory `src/hooks/`)

The loop logic (who's next, what happens on success/failure/401) is already tested pure functions; this hook only wires them to timers and `sendEmail`. Timer orchestration is verified manually in Task 12.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useCampaignSender.ts`:

```ts
import { useEffect, useRef } from 'react';
import { sendEmail } from '../lib/gmail';
import {
  nextSendDelayMs,
  recordFailed,
  recordSent,
  renderedFor,
  requeueRecipient,
  startNextSend,
  type Campaign,
} from '../lib/outreach';

interface Deps {
  campaign: Campaign | null; // the one campaign currently in state 'sending'
  update: (c: Campaign) => void; // persists + updates App state
  onAuthExpired: (paused: Campaign) => void; // show the reconnect affordance
}

// Drives the active campaign while the tab is open: send one, wait 45–120 s,
// repeat. The effect is keyed on (id, state) so per-send updates don't
// restart it; `live` carries the freshest campaign into the async loop.
export function useCampaignSender({ campaign, update, onAuthExpired }: Deps) {
  const live = useRef(campaign);
  live.current = campaign;

  const id = campaign?.state === 'sending' ? campaign.id : null;

  useEffect(() => {
    if (!id) return;
    let stopped = false;
    let timer: number | undefined;

    async function step(): Promise<void> {
      const current = live.current;
      if (stopped || !current || current.id !== id || current.state !== 'sending') return;
      const next = startNextSend(current);
      if (!next) return;
      update(next.campaign);
      live.current = next.campaign;
      const { subject, body } = renderedFor(next.campaign, next.recipient);
      let after: Campaign;
      try {
        const sent = await sendEmail({ to: next.recipient.fields.email, subject, body });
        // Always record a completed send, even if the user paused meanwhile —
        // the email is out; the state must say so.
        after = recordSent(live.current ?? next.campaign, next.recipient.id, sent);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'send failed';
        const base = live.current ?? next.campaign;
        if (msg === 'not-connected') {
          // Token expired: the API refused before sending, so requeue and pause.
          const paused: Campaign = { ...requeueRecipient(base, next.recipient.id), state: 'paused' };
          update(paused);
          live.current = paused;
          onAuthExpired(paused);
          return;
        }
        after = recordFailed(base, next.recipient.id, msg);
      }
      update(after);
      live.current = after;
      if (!stopped && after.state === 'sending') {
        timer = window.setTimeout(step, nextSendDelayMs());
      }
    }

    void step();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
    // update/onAuthExpired are stable enough for this app's inline handlers;
    // re-running on their identity would restart the send loop mid-wait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: clean. (`npm run lint` may flag the exhaustive-deps suppression comment style; oxlint uses the same rule name — if it warns, leave the warning, matching the existing one in App.tsx.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCampaignSender.ts
git commit -m "feat: campaign send loop hook — staggered sends, pause on auth expiry"
```

---

### Task 7: Campaigns home + wizard shell + styles

**Files:**
- Create: `src/components/Campaigns.tsx`
- Create: `src/components/CampaignWizard.tsx`
- Modify: `src/styles.css` (append)

- [ ] **Step 1: Campaigns home**

Create `src/components/Campaigns.tsx`:

```tsx
import type { Campaign } from '../lib/outreach';

interface Props {
  campaigns: Campaign[];
  onOpen: (id: string) => void;
  onNew: () => void;
}

const STATE_LABEL: Record<Campaign['state'], string> = {
  draft: 'draft',
  sending: 'sending…',
  paused: 'paused',
  done: 'sent',
};

export default function Campaigns({ campaigns, onOpen, onNew }: Props) {
  return (
    <div className="campaigns">
      <div className="campaigns-head">
        <h1>outreach</h1>
        <button className="send" onClick={onNew}>
          new batch
        </button>
      </div>
      {campaigns.length === 0 ? (
        <p className="campaigns-empty">
          paste a list, write one email with {'{{variables}}'}, preview every single one, and slip
          sends them a couple of minutes apart from your own gmail.
        </p>
      ) : (
        <ul className="campaign-list">
          {campaigns.map((c) => {
            const sent = c.recipients.filter((r) => r.status === 'sent' || r.status === 'replied');
            const replied = c.recipients.filter((r) => r.status === 'replied');
            return (
              <li key={c.id}>
                <button className="campaign-row" onClick={() => onOpen(c.id)}>
                  <span className="campaign-name">{c.name}</span>
                  <span className={`campaign-state is-${c.state}`}>{STATE_LABEL[c.state]}</span>
                  <span className="campaign-stats">
                    {sent.length}/{c.recipients.length} sent · {replied.length} replied
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wizard shell**

Create `src/components/CampaignWizard.tsx` (the step components arrive in Tasks 8–10; to keep this task compiling on its own, render placeholders now and swap them as the steps land — each later task states the exact swap):

```tsx
import type { Campaign } from '../lib/outreach';

export type WizardStep = 'people' | 'write' | 'preview' | 'send';

export const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'people', label: '1 · people' },
  { key: 'write', label: '2 · write' },
  { key: 'preview', label: '3 · preview' },
  { key: 'send', label: '4 · send' },
];

interface Props {
  campaign: Campaign;
  step: WizardStep;
  selfEmail: string | null;
  onChange: (c: Campaign) => void;
  onStep: (s: WizardStep) => void;
  onExit: () => void;
}

export default function CampaignWizard({ campaign, step, selfEmail, onChange, onStep, onExit }: Props) {
  return (
    <div className="wizard">
      <div className="wizard-head">
        <button className="wizard-back" onClick={onExit}>
          ← batches
        </button>
        <input
          className="wizard-name"
          value={campaign.name}
          onChange={(e) => onChange({ ...campaign, name: e.target.value })}
        />
        <nav className="wizard-steps">
          {STEPS.map(({ key, label }) => (
            <button
              key={key}
              className={key === step ? 'wizard-step active' : 'wizard-step'}
              onClick={() => onStep(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
      {step === 'people' && <p className="campaigns-empty">people step coming in task 8</p>}
      {step === 'write' && <p className="campaigns-empty">write step coming in task 9</p>}
      {step === 'preview' && <p className="campaigns-empty">preview step coming in task 10</p>}
      {step === 'send' && <p className="campaigns-empty">send step coming in task 10</p>}
      {selfEmail === null && step === 'send' && null /* selfEmail is threaded to SendStep in task 10 */}
    </div>
  );
}
```

- [ ] **Step 3: Styles**

Append to `src/styles.css`:

```css
/* ── Outreach ─────────────────────────────────────────────── */

.campaigns { max-width: 720px; margin: 0 auto; padding: 48px 24px; width: 100%; }
.campaigns-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.campaigns-head h1 { font-size: 22px; font-weight: 700; }
.campaigns-empty { color: var(--muted); line-height: 1.6; max-width: 46ch; }
.campaign-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.campaign-row {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 12px 14px; border: 0; border-radius: 8px; background: none;
  font: inherit; text-align: left; cursor: pointer;
}
.campaign-row:hover { background: var(--hover); }
.campaign-name { font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.campaign-state { font-size: 12px; color: var(--muted); border: 1px solid var(--hover); border-radius: 99px; padding: 2px 10px; }
.campaign-state.is-sending { color: #1a7f37; border-color: #1a7f37; }
.campaign-state.is-paused { color: #9a6700; border-color: #9a6700; }
.campaign-stats { font-size: 13px; color: var(--muted); white-space: nowrap; }

.wizard { max-width: 860px; margin: 0 auto; padding: 32px 24px; width: 100%; }
.wizard-head { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
.wizard-back { border: 0; background: none; font: inherit; color: var(--muted); cursor: pointer; padding: 4px 0; }
.wizard-back:hover { color: var(--text); }
.wizard-name {
  font: inherit; font-weight: 700; font-size: 17px; border: 0; background: none;
  border-bottom: 1px dashed transparent; min-width: 0; flex: 1;
}
.wizard-name:hover, .wizard-name:focus { border-bottom-color: var(--muted); outline: none; }
.wizard-steps { display: flex; gap: 4px; }
.wizard-step {
  border: 0; background: none; font: inherit; font-size: 13px; color: var(--muted);
  padding: 6px 10px; border-radius: 6px; cursor: pointer;
}
.wizard-step:hover { background: var(--hover); }
.wizard-step.active { background: var(--active); color: var(--text); font-weight: 600; }
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc -b && npm run lint`
Expected: clean (components aren't wired into App yet; that's Task 11).

- [ ] **Step 5: Commit**

```bash
git add src/components/Campaigns.tsx src/components/CampaignWizard.tsx src/styles.css
git commit -m "feat: campaigns home and wizard shell"
```

---

### Task 8: People step — Notion-style recipient table

**Files:**
- Create: `src/components/RecipientTable.tsx`
- Modify: `src/components/CampaignWizard.tsx` (swap placeholder)
- Modify: `src/styles.css` (append)

- [ ] **Step 1: Write the component**

Create `src/components/RecipientTable.tsx` (all mutations go through the tested pure functions):

```tsx
import {
  addColumn,
  addRow,
  applyPaste,
  isValidEmail,
  removeColumn,
  removeRow,
  renameColumn,
  setCell,
  type Campaign,
} from '../lib/outreach';

interface Props {
  campaign: Campaign;
  onChange: (c: Campaign) => void;
  onNext: () => void;
}

export default function RecipientTable({ campaign, onChange, onNext }: Props) {
  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text/plain');
    // Multi-cell pastes (tabs or newlines) are imports; single values fall
    // through to the focused input's normal paste.
    if (!/[\t\n\r]/.test(text)) return;
    e.preventDefault();
    onChange(applyPaste(campaign, text));
  }

  function promptColumn() {
    const name = window.prompt('column name (becomes a {{variable}})');
    if (name) onChange(addColumn(campaign, name));
  }

  const ready = campaign.recipients.some((r) => isValidEmail(r.fields.email ?? ''));

  return (
    <div className="people" onPaste={handlePaste}>
      <p className="step-hint">
        paste straight from google sheets (first row = column names), or type below. every column
        is a {'{{variable}}'} you can use in the email.
      </p>
      <table className="sheet">
        <thead>
          <tr>
            {campaign.columns.map((col) => (
              <th key={col}>
                <input
                  className="sheet-head"
                  value={col}
                  readOnly={col === 'email'}
                  onChange={(e) => onChange(renameColumn(campaign, col, e.target.value))}
                />
                {col !== 'email' && (
                  <button
                    className="sheet-x"
                    title={`remove ${col}`}
                    onClick={() => onChange(removeColumn(campaign, col))}
                  >
                    ×
                  </button>
                )}
              </th>
            ))}
            <th className="sheet-add">
              <button className="sheet-plus" title="add column" onClick={promptColumn}>
                +
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {campaign.recipients.map((r) => (
            <tr key={r.id}>
              {campaign.columns.map((col) => {
                const value = r.fields[col] ?? '';
                const bad = col === 'email' && value.trim() !== '' && !isValidEmail(value);
                return (
                  <td key={col}>
                    <input
                      className={bad ? 'sheet-cell cell-bad' : 'sheet-cell'}
                      value={value}
                      placeholder={col}
                      onChange={(e) => onChange(setCell(campaign, r.id, col, e.target.value))}
                    />
                  </td>
                );
              })}
              <td className="sheet-add">
                <button className="sheet-x" title="remove row" onClick={() => onChange(removeRow(campaign, r.id))}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="step-actions">
        <button className="ghost" onClick={() => onChange(addRow(campaign))}>
          + add person
        </button>
        <button className="send" disabled={!ready} onClick={onNext}>
          write the email →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Swap the wizard placeholder**

In `src/components/CampaignWizard.tsx`, add `import RecipientTable from './RecipientTable';` and replace the people placeholder line with:

```tsx
{step === 'people' && (
  <RecipientTable campaign={campaign} onChange={onChange} onNext={() => onStep('write')} />
)}
```

- [ ] **Step 3: Styles**

Append to `src/styles.css`:

```css
.step-hint { color: var(--muted); font-size: 14px; line-height: 1.6; margin-bottom: 20px; max-width: 56ch; }
.sheet { width: 100%; border-collapse: collapse; }
.sheet th, .sheet td { border-bottom: 1px solid var(--hover); padding: 0; position: relative; }
.sheet th { text-align: left; }
.sheet-head {
  font: inherit; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: lowercase;
  border: 0; background: none; padding: 8px 10px; width: 100%;
}
.sheet-head:focus { outline: none; color: var(--text); }
.sheet-cell { font: inherit; font-size: 14px; border: 0; background: none; padding: 9px 10px; width: 100%; }
.sheet-cell:focus { outline: none; background: var(--hover); border-radius: 4px; }
.sheet-cell.cell-bad { text-decoration: underline wavy #c0392b; text-underline-offset: 3px; }
.sheet-add { width: 32px; }
.sheet-x, .sheet-plus {
  border: 0; background: none; color: var(--muted); cursor: pointer; font: inherit;
  padding: 4px 8px; border-radius: 4px; opacity: 0;
}
.sheet-plus { opacity: 1; }
.sheet tr:hover .sheet-x, .sheet th:hover .sheet-x { opacity: 1; }
.sheet-x:hover, .sheet-plus:hover { background: var(--hover); color: var(--text); }
.step-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; gap: 12px; }
.ghost {
  border: 0; background: none; font: inherit; font-size: 14px; color: var(--muted);
  cursor: pointer; padding: 8px 10px; border-radius: 6px;
}
.ghost:hover { background: var(--hover); color: var(--text); }
```

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run lint && npm test`
Expected: clean / pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/RecipientTable.tsx src/components/CampaignWizard.tsx src/styles.css
git commit -m "feat: people step — notion-style table with sheets paste"
```

---

### Task 9: Write step — templates, variable chips, validation

**Files:**
- Create: `src/components/TemplateStep.tsx`
- Modify: `src/components/CampaignWizard.tsx` (swap placeholder)
- Modify: `src/styles.css` (append)

- [ ] **Step 1: Write the component**

Create `src/components/TemplateStep.tsx`:

```tsx
import { useRef } from 'react';
import { blockingIssues, validateCampaign, type Campaign } from '../lib/outreach';

interface Props {
  campaign: Campaign;
  onChange: (c: Campaign) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function TemplateStep({ campaign, onChange, onBack, onNext }: Props) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function insertVar(col: string) {
    const el = bodyRef.current;
    const token = `{{${col}}}`;
    if (!el) {
      onChange({ ...campaign, bodyTemplate: campaign.bodyTemplate + token });
      return;
    }
    const { selectionStart: s, selectionEnd: e, value } = el;
    const bodyTemplate = value.slice(0, s) + token + value.slice(e);
    onChange({ ...campaign, bodyTemplate });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + token.length, s + token.length);
    });
  }

  const issues = validateCampaign(campaign);
  const blockers = blockingIssues(issues);
  const warnings = issues.filter((i) => i.kind === 'empty-value');

  return (
    <div className="write-step">
      <input
        className="field"
        placeholder="subject — {{variables}} work here too"
        value={campaign.subjectTemplate}
        onChange={(e) => onChange({ ...campaign, subjectTemplate: e.target.value })}
      />
      <div className="var-chips">
        {campaign.columns
          .filter((c) => c !== 'email')
          .map((col) => (
            <button key={col} className="var-chip" onClick={() => insertVar(col)}>
              {'{{' + col + '}}'}
            </button>
          ))}
      </div>
      <textarea
        ref={bodyRef}
        className="field body-tpl"
        placeholder={'hi {{name}},\n\ni read {{paper}} and…'}
        value={campaign.bodyTemplate}
        onChange={(e) => onChange({ ...campaign, bodyTemplate: e.target.value })}
      />
      {(blockers.length > 0 || warnings.length > 0) && (
        <ul className="issue-list">
          {blockers.map((i, n) => (
            <li key={`b${n}`} className="issue-block">
              {i.message}
            </li>
          ))}
          {warnings.length > 0 && (
            <li className="issue-warn">
              {warnings.length} value{warnings.length === 1 ? ' is' : 's are'} empty — those emails
              will keep the literal {'{{variable}}'} unless you edit them in preview
            </li>
          )}
        </ul>
      )}
      <div className="step-actions">
        <button className="ghost" onClick={onBack}>
          ← people
        </button>
        <button
          className="send"
          disabled={blockers.length > 0 || !campaign.subjectTemplate.trim() || !campaign.bodyTemplate.trim()}
          onClick={onNext}
        >
          preview every email →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Swap the wizard placeholder**

In `src/components/CampaignWizard.tsx`, add `import TemplateStep from './TemplateStep';` and replace the write placeholder with:

```tsx
{step === 'write' && (
  <TemplateStep
    campaign={campaign}
    onChange={onChange}
    onBack={() => onStep('people')}
    onNext={() => onStep('preview')}
  />
)}
```

- [ ] **Step 3: Styles**

Append to `src/styles.css`:

```css
.write-step { display: flex; flex-direction: column; gap: 12px; }
.var-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.var-chip {
  border: 1px solid var(--hover); background: none; font: inherit; font-size: 12px;
  color: var(--muted); border-radius: 99px; padding: 3px 10px; cursor: pointer;
}
.var-chip:hover { background: var(--hover); color: var(--text); }
.body-tpl { min-height: 260px; resize: vertical; line-height: 1.6; font-family: inherit; }
.issue-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.issue-block { color: #c0392b; }
.issue-warn { color: #9a6700; }
```

- [ ] **Step 4: Verify**

Run: `npx tsc -b && npm run lint && npm test`
Expected: clean / pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/TemplateStep.tsx src/components/CampaignWizard.tsx src/styles.css
git commit -m "feat: write step — templates with variable chips and validation"
```

---

### Task 10: Preview and Send steps

**Files:**
- Create: `src/components/PreviewStep.tsx`
- Create: `src/components/SendStep.tsx`
- Modify: `src/components/CampaignWizard.tsx` (swap placeholders)
- Modify: `src/styles.css` (append)

- [ ] **Step 1: Preview step**

Create `src/components/PreviewStep.tsx`:

```tsx
import { useState } from 'react';
import { renderedFor, type Campaign } from '../lib/outreach';

interface Props {
  campaign: Campaign;
  onChange: (c: Campaign) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function PreviewStep({ campaign, onChange, onBack, onNext }: Props) {
  const [openId, setOpenId] = useState<string | null>(campaign.recipients[0]?.id ?? null);
  const open = campaign.recipients.find((r) => r.id === openId) ?? null;
  const rendered = open ? renderedFor(campaign, open) : null;

  function setOverride(patch: Partial<{ subject: string; body: string }>) {
    if (!open || !rendered) return;
    const override = { ...rendered, ...patch };
    onChange({
      ...campaign,
      recipients: campaign.recipients.map((r) => (r.id === open.id ? { ...r, override } : r)),
    });
  }

  function revert() {
    if (!open) return;
    onChange({
      ...campaign,
      recipients: campaign.recipients.map((r) =>
        r.id === open.id ? { ...r, override: undefined } : r,
      ),
    });
  }

  return (
    <div className="preview-step">
      <ul className="preview-list">
        {campaign.recipients.map((r) => (
          <li key={r.id}>
            <button
              className={r.id === openId ? 'preview-row active' : 'preview-row'}
              onClick={() => setOpenId(r.id)}
            >
              <span className="preview-to">{r.fields.email || '(no email)'}</span>
              {r.override && <span className="edited-badge">edited</span>}
            </button>
          </li>
        ))}
      </ul>
      {open && rendered && (
        <div className="preview-pane">
          <input
            className="field"
            value={rendered.subject}
            onChange={(e) => setOverride({ subject: e.target.value })}
          />
          <textarea
            className="field preview-body"
            value={rendered.body}
            onChange={(e) => setOverride({ body: e.target.value })}
          />
          <div className="preview-meta">
            {open.override ? (
              <button className="ghost" onClick={revert}>
                revert to template
              </button>
            ) : (
              <span className="step-hint">editing here changes only this one email</span>
            )}
          </div>
        </div>
      )}
      <div className="step-actions preview-actions">
        <button className="ghost" onClick={onBack}>
          ← write
        </button>
        <button className="send" onClick={onNext}>
          looks right — go to send →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Send step**

Create `src/components/SendStep.tsx`:

```tsx
import { useEffect } from 'react';
import { fetchThread } from '../lib/gmail';
import {
  blockingIssues,
  hasReply,
  recordReplied,
  retryRecipient,
  validateCampaign,
  type Campaign,
  type Recipient,
} from '../lib/outreach';

interface Props {
  campaign: Campaign;
  selfEmail: string | null;
  onChange: (c: Campaign) => void;
}

const STATUS_LABEL: Record<Recipient['status'], string> = {
  queued: 'queued',
  sending: 'sending…',
  sent: 'sent',
  failed: 'failed',
  replied: 'replied ✓',
};

const POLL_MS = 60_000;

export default function SendStep({ campaign, selfEmail, onChange }: Props) {
  const blockers = blockingIssues(validateCampaign(campaign));
  const counts = {
    sent: campaign.recipients.filter((r) => r.status === 'sent' || r.status === 'replied').length,
    replied: campaign.recipients.filter((r) => r.status === 'replied').length,
    failed: campaign.recipients.filter((r) => r.status === 'failed').length,
    total: campaign.recipients.length,
  };

  // Reply tracking: on open and every minute, look at each sent thread and
  // flip to replied when someone who isn't the sender shows up in it.
  useEffect(() => {
    if (!selfEmail) return;
    let cancelled = false;
    async function check() {
      let current = campaign;
      for (const r of campaign.recipients) {
        if (cancelled) return;
        if (r.status !== 'sent' || !r.threadId) continue;
        try {
          const thread = await fetchThread(r.threadId);
          if (cancelled) return;
          if (hasReply(thread, selfEmail!)) current = recordReplied(current, r.id);
        } catch {
          // stale status is fine; next tick retries
        }
      }
      if (!cancelled && current !== campaign) onChange(current);
    }
    void check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // Re-keying on sent-count keeps the poll fresh without restarting per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfEmail, campaign.id, counts.sent]);

  const banner =
    campaign.state === 'sending'
      ? 'sending one every 1–2 minutes — keep this tab open'
      : campaign.state === 'paused'
        ? 'paused — nothing is sending'
        : campaign.state === 'done'
          ? `all done — ${counts.sent}/${counts.total} sent, ${counts.replied} replied`
          : `ready — ${counts.total} emails will go out one every 1–2 minutes`;

  return (
    <div className="send-step">
      <div className={`send-banner is-${campaign.state}`}>
        <span>{banner}</span>
        {campaign.state === 'draft' && (
          <button
            className="send"
            disabled={blockers.length > 0}
            onClick={() => onChange({ ...campaign, state: 'sending' })}
          >
            start sending
          </button>
        )}
        {campaign.state === 'sending' && (
          <button className="ghost" onClick={() => onChange({ ...campaign, state: 'paused' })}>
            pause
          </button>
        )}
        {campaign.state === 'paused' && (
          <button className="send" onClick={() => onChange({ ...campaign, state: 'sending' })}>
            resume
          </button>
        )}
      </div>
      {blockers.length > 0 && campaign.state === 'draft' && (
        <ul className="issue-list">
          {blockers.map((i, n) => (
            <li key={n} className="issue-block">
              {i.message}
            </li>
          ))}
        </ul>
      )}
      <ul className="send-list">
        {campaign.recipients.map((r) => (
          <li key={r.id} className="send-row">
            <span className="preview-to">{r.fields.email}</span>
            <span className={`send-status is-${r.status}`}>{STATUS_LABEL[r.status]}</span>
            {r.status === 'failed' && (
              <>
                <span className="send-error" title={r.error}>
                  {r.error}
                </span>
                <button className="ghost" onClick={() => onChange(retryRecipient(campaign, r.id))}>
                  retry
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Swap the wizard placeholders**

In `src/components/CampaignWizard.tsx`, add the two imports and replace the preview/send placeholders (and delete the leftover `selfEmail === null` no-op line):

```tsx
import PreviewStep from './PreviewStep';
import SendStep from './SendStep';
```

```tsx
{step === 'preview' && (
  <PreviewStep
    campaign={campaign}
    onChange={onChange}
    onBack={() => onStep('write')}
    onNext={() => onStep('send')}
  />
)}
{step === 'send' && <SendStep campaign={campaign} selfEmail={selfEmail} onChange={onChange} />}
```

- [ ] **Step 4: Styles**

Append to `src/styles.css`:

```css
.preview-step { display: grid; grid-template-columns: 240px 1fr; gap: 20px; }
.preview-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; max-height: 480px; overflow-y: auto; }
.preview-row {
  display: flex; align-items: center; gap: 8px; width: 100%; border: 0; background: none;
  font: inherit; font-size: 13px; text-align: left; padding: 8px 10px; border-radius: 6px; cursor: pointer;
}
.preview-row:hover { background: var(--hover); }
.preview-row.active { background: var(--active); font-weight: 600; }
.preview-to { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.edited-badge { font-size: 11px; color: #9a6700; border: 1px solid #9a6700; border-radius: 99px; padding: 1px 8px; }
.preview-pane { display: flex; flex-direction: column; gap: 10px; }
.preview-body { min-height: 300px; resize: vertical; line-height: 1.6; font-family: inherit; }
.preview-meta { display: flex; justify-content: flex-end; }
.preview-actions { grid-column: 1 / -1; }

.send-step { display: flex; flex-direction: column; gap: 16px; }
.send-banner {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 16px; border-radius: 8px; background: var(--hover); font-size: 14px;
}
.send-banner.is-sending { background: #e8f5ec; color: #1a7f37; }
.send-banner.is-paused { background: #fff4dc; color: #9a6700; }
.send-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }
.send-row { display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-bottom: 1px solid var(--hover); font-size: 14px; }
.send-status { font-size: 12px; color: var(--muted); white-space: nowrap; }
.send-status.is-sent { color: #1a7f37; }
.send-status.is-replied { color: #1a7f37; font-weight: 600; }
.send-status.is-failed { color: #c0392b; }
.send-status.is-sending { color: #9a6700; }
.send-error { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }

@media (max-width: 720px) {
  .preview-step { grid-template-columns: 1fr; }
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc -b && npm run lint && npm test`
Expected: clean / pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/PreviewStep.tsx src/components/SendStep.tsx src/components/CampaignWizard.tsx src/styles.css
git commit -m "feat: preview with per-email overrides; send step with live status and reply tracking"
```

---

### Task 11: App and Sidebar wiring

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Sidebar — outreach entry**

In `src/components/Sidebar.tsx`:

Add to `Props`:

```ts
  outreachActive: boolean;
  onOutreach: () => void;
```

Destructure both in the component signature. Then insert this block between the `side-brand` div and the `side-label` "Mail" div:

```tsx
      <div className="side-label">Outreach</div>
      <button
        className={outreachActive ? 'nav-item active' : 'nav-item'}
        onClick={onOutreach}
      >
        <IconSent />
        Batches
      </button>
```

(`IconSent` is already imported.)

- [ ] **Step 2: App — imports, state, view union**

In `src/App.tsx`:

Add `fetchSelfEmail` to the existing `./lib/gmail` import list, then add these new import lines:

```ts
import { newCampaign, type Campaign } from './lib/outreach';
import { loadCampaigns, saveCampaigns, upsertCampaign } from './lib/campaignStore';
import { useCampaignSender } from './hooks/useCampaignSender';
import Campaigns from './components/Campaigns';
import CampaignWizard, { type WizardStep } from './components/CampaignWizard';
```

Extend the `View` union:

```ts
type View =
  | { name: 'home' }
  | { name: 'list' }
  | { name: 'reading'; id: string }
  | { name: 'force' }
  | { name: 'campaigns' }
  | { name: 'campaign'; id: string; step: WizardStep }
  | { name: 'composing'; replyTo?: Email; draft?: Draft; prefill?: Prefill };
```

Add state inside `App()` next to the other `useState` calls:

```ts
const [campaigns, setCampaigns] = useState<Campaign[]>(loadCampaigns);
const [selfEmail, setSelfEmail] = useState<string | null>(null);
```

- [ ] **Step 3: App — update helper, sender hook, beforeunload**

Add below the state declarations (before `handleConnect`):

```ts
  function updateCampaign(c: Campaign) {
    setCampaigns((prev) => {
      const next = upsertCampaign(prev, c);
      if (!saveCampaigns(next)) {
        setToast({ text: "storage is blocked — this batch won't survive a refresh" });
      }
      return next;
    });
  }

  const activeCampaign = campaigns.find((c) => c.state === 'sending') ?? null;

  useCampaignSender({
    campaign: activeCampaign,
    update: updateCampaign,
    onAuthExpired: (paused) =>
      setToast({
        text: 'gmail session expired — the batch is paused',
        actionLabel: 'reconnect & resume',
        onAction: () => {
          setToast(null);
          connect()
            .then(() => updateCampaign({ ...paused, state: 'sending' }))
            .catch(() => setToast({ text: "couldn't reconnect — try again from the batch page" }));
        },
      }),
  });

  // Leaving the page kills the send loop; warn while a batch is going out.
  useEffect(() => {
    if (!activeCampaign) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [activeCampaign !== null]);
```

- [ ] **Step 4: App — land on outreach after connect**

In `handleConnect`, replace:

```ts
setView(start === 'keys' ? { name: 'home' } : { name: 'list' });
```

with:

```ts
setView(start === 'inbox' ? { name: 'list' } : { name: 'campaigns' });
fetchSelfEmail().then(setSelfEmail).catch(() => undefined);
```

Update the start-toggle copy so the setting still describes reality — in the sidebar block (`Sidebar.tsx`), change the start button's label line from `Start: {start === 'keys' ? 'keys' : 'inbox'}` to `Start: {start === 'keys' ? 'outreach' : 'inbox'}`, and in App's `commands` array change the start command label to:

```ts
label: start === 'keys' ? 'start in inbox after connecting' : 'start in outreach after connecting',
```

- [ ] **Step 5: App — render the new views**

Inside `<main className="pane">`, add before the `view.name === 'home'` block:

```tsx
        {view.name === 'campaigns' && (
          <Campaigns
            campaigns={campaigns}
            onOpen={(id) => {
              const c = campaigns.find((x) => x.id === id);
              const step: WizardStep = c && c.state !== 'draft' ? 'send' : 'people';
              setView({ name: 'campaign', id, step });
            }}
            onNew={() => {
              const c = newCampaign();
              updateCampaign(c);
              setView({ name: 'campaign', id: c.id, step: 'people' });
            }}
          />
        )}
        {view.name === 'campaign' &&
          (() => {
            const c = campaigns.find((x) => x.id === view.id);
            if (!c) return null;
            return (
              <CampaignWizard
                campaign={c}
                step={view.step}
                selfEmail={selfEmail}
                onChange={updateCampaign}
                onStep={(step) => setView({ name: 'campaign', id: view.id, step })}
                onExit={() => setView({ name: 'campaigns' })}
              />
            );
          })()}
```

Pass the new Sidebar props where `<Sidebar>` is rendered:

```tsx
        outreachActive={view.name === 'campaigns' || view.name === 'campaign'}
        onOutreach={() => setView({ name: 'campaigns' })}
```

- [ ] **Step 6: App — palette command**

In the `commands` array (near the other `go-*` commands):

```ts
if (view.name !== 'campaigns') {
  commands.push({ id: 'go-outreach', label: 'go to outreach', run: () => setView({ name: 'campaigns' }) });
}
```

- [ ] **Step 7: Verify**

Run: `npx tsc -b && npm run lint && npm test`
Expected: typecheck clean; lint may show the pre-existing App.tsx exhaustive-deps warning (and possibly one for the new beforeunload effect — acceptable, same pattern); all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/components/Sidebar.tsx
git commit -m "feat: wire outreach into the app — landing view, sidebar, sender loop, reconnect toast"
```

---

### Task 12: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full check**

Run: `npm run lint && npm test && npm run build`
Expected: lint (pre-existing warning only), all tests pass, build succeeds.

- [ ] **Step 2: Drive the real app**

Start `npm run dev`, open `http://localhost:5173` in a headless browser with `localStorage.slip-has-access=1`. Without connecting Gmail you can still verify the wizard UI by seeding state — but the meaningful check needs a connected session, which only Varun can do. Verify programmatically what's verifiable:

1. Connect screen renders (no client-id UI).
2. With a seeded campaign in `localStorage.slip-campaigns` and the app connected-state unavailable, at minimum screenshot the front page; full wizard verification happens in step 3.

For UI verification without OAuth, temporarily seed in the browser console is not possible pre-connect (views render only when connected) — so rely on Varun's manual pass:

- [ ] **Step 3: Manual pass (Varun, connected)**

1. Connect Gmail → lands on outreach home.
2. New batch → paste 2–3 rows from a real Google Sheet (own/test addresses) → columns appear, bad email shows wavy underline.
3. Write → chips insert variables, blockers disable the button when a typo'd `{{variable}}` exists.
4. Preview → each email rendered; edit one → "edited" badge; revert works.
5. Send → start; first email goes immediately, second after 45–120 s. Pause mid-run → nothing sends; resume → continues. Status flips queued → sending → sent.
6. Reply from one recipient inbox → within ~1 min on the send screen the row flips to "replied ✓".
7. Refresh mid-send → campaign shows paused with the interrupted row failed; retry requeues it.
8. Check Gmail Sent: messages exist, personalized correctly.

- [ ] **Step 4: Commit any fixes found, then final commit if needed**

---

## Self-review notes (already applied)

- **Spec coverage:** paste import (T1/T2/T8), manual table (T2/T8), templates+validation (T2/T9), preview+overrides (T3/T10), staggered send (T3/T6), pause/resume/retry (T3/T10), 401 pause+reconnect (T6/T11), crash normalization (T4), reply tracking (T3/T10), outreach-first landing + sidebar + palette (T11), storage-blocked warning (T11), beforeunload (T11). Rich text, CSV upload, open tracking, multi-campaign sending: excluded per spec.
- **Type consistency:** `Campaign`/`Recipient`/`Issue`/`WizardStep`/`SentRef` defined once and imported everywhere; all state mutations go through functions defined in Tasks 2–3.
- **Known judgment calls:** paste into a table that has data appends rather than replaces; `renameColumn` refuses to rename `email`; empty-value issues are warnings, everything else blocks send.
