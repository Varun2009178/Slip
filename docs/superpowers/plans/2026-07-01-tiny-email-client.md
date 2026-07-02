# Tiny Email Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tiny, minimal email client prototype — simplified inbox, clean reading view, doc-like composer with Claude AI rewrites, and an E-to-done system.

**Architecture:** Single-page Vite + React + TypeScript app. Mock emails in `src/data/emails.ts`; read/done state in localStorage via `src/lib/store.ts`; pure inbox logic in `src/lib/mail.ts`; Claude rewrites in `src/lib/ai.ts` (browser-direct via the official SDK). `App.tsx` is a three-view state machine (inbox / reading / composing) with global keyboard handling.

**Tech Stack:** Vite, React 18, TypeScript, plain CSS, `@anthropic-ai/sdk`, Vitest + jsdom for unit tests.

Spec: `docs/superpowers/specs/2026-07-01-tiny-email-client-design.md`

---

### Task 1: Scaffold the project

**Files:**
- Create: entire Vite react-ts template at repo root, `vite.config.ts` (test config)

- [ ] **Step 1: Scaffold Vite app in the existing repo**

Run (repo root already has `docs/` and `.git`; scaffold into a temp dir and move):

```bash
npm create vite@latest tiny-mail-tmp -- --template react-ts
rsync -a tiny-mail-tmp/ ./ && rm -rf tiny-mail-tmp
npm install
npm install @anthropic-ai/sdk
npm install -D vitest jsdom
```

- [ ] **Step 2: Remove template noise**

Delete `src/App.css`, `src/assets/react.svg`, `public/vite.svg`. Replace `src/index.css` usage later (Task 6 creates `src/styles.css`). Set `<title>Mail</title>` in `index.html` and remove the vite.svg favicon link.

- [ ] **Step 3: Configure Vitest**

Replace `vite.config.ts` with:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
});
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 4: Verify the dev build compiles**

Run: `npx tsc -b && npx vite build`
Expected: builds without errors (template App still present — fine for now).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite + React + TS app with Vitest"
```

---

### Task 2: Data model and mock emails

**Files:**
- Create: `src/data/emails.ts`

- [ ] **Step 1: Write the data file**

```ts
export interface Message {
  id: string;
  from: string;
  body: string;
  date: string; // ISO 8601
}

export interface Email {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
  date: string; // ISO 8601
  important: boolean;
  thread: Message[]; // earlier messages, oldest first
}

export const emails: Email[] = [
  {
    id: 'e1',
    from: 'Priya Raman',
    fromEmail: 'priya@lattice.dev',
    subject: 'Q3 roadmap review — Thursday?',
    body: 'Can we move the roadmap review to Thursday at 2pm? Sofia is out Wednesday and I want her in the room for the infra discussion.\n\nIf Thursday works, I will send the updated invite tonight.',
    date: '2026-07-01T09:12:00',
    important: true,
    thread: [],
  },
  {
    id: 'e2',
    from: 'Dana Whitfield',
    fromEmail: 'dana.whitfield@northbeam.io',
    subject: 'Re: Contract renewal terms',
    body: 'Legal signed off on the revised terms. The only remaining change is the 60-day notice period we discussed — see section 4.2.\n\nIf that looks right to you, we can countersign this week.',
    date: '2026-07-01T08:47:00',
    important: true,
    thread: [
      {
        id: 'e2-t1',
        from: 'You',
        body: 'Thanks Dana — we would want the notice period at 60 days rather than 30. Everything else in the draft looks fine.',
        date: '2026-06-29T16:20:00',
      },
      {
        id: 'e2-t2',
        from: 'Dana Whitfield',
        body: 'Understood, let me run the 60-day notice period by legal and get back to you.',
        date: '2026-06-30T10:05:00',
      },
    ],
  },
  {
    id: 'e3',
    from: 'Marcus Oyelaran',
    fromEmail: 'marcus@figstack.com',
    subject: 'Design crit notes from yesterday',
    body: 'Notes from the crit:\n\nThe empty state needs work — three people flagged it as confusing. The settings reorg landed well. Nav icons are still split, I say we ship the text-only version and revisit.\n\nFull notes in the doc, but that is the gist.',
    date: '2026-06-30T17:31:00',
    important: false,
    thread: [],
  },
  {
    id: 'e4',
    from: 'Elena Vasquez',
    fromEmail: 'elena.v@corticalsystems.com',
    subject: 'Intro: Sam from Meridian Capital',
    body: 'You two should know each other. Sam leads developer tools investments at Meridian and has been following your space closely.\n\nSam — meet one of the sharpest builders I know. I will let you two take it from here.',
    date: '2026-06-30T14:02:00',
    important: false,
    thread: [],
  },
  {
    id: 'e5',
    from: 'GitHub',
    fromEmail: 'noreply@github.com',
    subject: '[lattice/core] Release v2.14.0 published',
    body: 'Release v2.14.0 has been published.\n\nHighlights: new streaming API, 40% faster cold starts, and the deprecation of the legacy webhook format announced in v2.10.',
    date: '2026-06-30T11:15:00',
    important: false,
    thread: [],
  },
  {
    id: 'e6',
    from: 'Tomás Herrera',
    fromEmail: 'tomas@lattice.dev',
    subject: 'Re: Postgres migration window',
    body: 'Confirmed with the SRE team — we have a window Saturday 02:00–04:00 UTC. Read replicas stay up the whole time, primary fails over once, expected write downtime under 90 seconds.\n\nI will run the rehearsal Friday and send the checklist after.',
    date: '2026-06-29T19:44:00',
    important: false,
    thread: [
      {
        id: 'e6-t1',
        from: 'You',
        body: 'What is the realistic downtime estimate for the primary? If it is more than a few minutes we should schedule a maintenance banner.',
        date: '2026-06-29T09:10:00',
      },
    ],
  },
  {
    id: 'e7',
    from: 'Aiko Tanaka',
    fromEmail: 'aiko@pressroom.jp',
    subject: 'Interview request — developer tools piece',
    body: 'I am writing a piece on the new wave of developer productivity tools for Pressroom and would love 20 minutes of your time next week.\n\nHappy to work around your schedule — mornings JST tend to be best on my end.',
    date: '2026-06-28T22:08:00',
    important: false,
    thread: [],
  },
  {
    id: 'e8',
    from: 'Stripe',
    fromEmail: 'receipts@stripe.com',
    subject: 'Your June invoice is available',
    body: 'Your invoice for June 2026 is now available.\n\nTotal: $1,284.00. Payment will be collected automatically from the card on file on July 5.',
    date: '2026-06-28T07:00:00',
    important: false,
    thread: [],
  },
  {
    id: 'e9',
    from: 'Noor Haddad',
    fromEmail: 'noor@openatlas.org',
    subject: 'Speaking at Atlas Conf in October?',
    body: 'We are putting together the speaker lineup for Atlas Conf (Oct 14–15, Lisbon) and your name came up immediately for the infrastructure track.\n\n30-minute talk, topic of your choosing. Travel and accommodation covered. Interested?',
    date: '2026-06-27T13:26:00',
    important: false,
    thread: [],
  },
];
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/emails.ts && git commit -m "feat: add email data model and mock inbox"
```

---

### Task 3: Inbox logic (`lib/mail.ts`) — TDD

**Files:**
- Create: `src/lib/mail.ts`
- Test: `src/lib/mail.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/lib/mail.test.ts`
Expected: FAIL — cannot resolve `./mail`.

- [ ] **Step 3: Implement `src/lib/mail.ts`**

```ts
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
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/lib/mail.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mail.ts src/lib/mail.test.ts && git commit -m "feat: inbox sort (pinned-first) and date formatting"
```

---

### Task 4: Persistence (`lib/store.ts`) — TDD

**Files:**
- Create: `src/lib/store.ts`
- Test: `src/lib/store.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/lib/store.test.ts`
Expected: FAIL — cannot resolve `./store`.

- [ ] **Step 3: Implement `src/lib/store.ts`**

```ts
const KEY = 'tiny-mail-state';

export interface MailState {
  readIds: string[];
  doneIds: string[];
}

const EMPTY: MailState = { readIds: [], doneIds: [] };

export function loadState(): MailState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    const p = parsed as Partial<MailState>;
    return {
      readIds: Array.isArray(p.readIds) ? p.readIds : [],
      doneIds: Array.isArray(p.doneIds) ? p.doneIds : [],
    };
  } catch {
    return EMPTY;
  }
}

export function saveState(state: MailState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — state simply doesn't persist
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/lib/store.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts && git commit -m "feat: localStorage persistence for read/done state"
```

---

### Task 5: Claude rewrites (`lib/ai.ts`) — TDD on the pure parts

**Files:**
- Create: `src/lib/ai.ts`
- Test: `src/lib/ai.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { extractText, systemPromptFor } from './ai';

describe('systemPromptFor', () => {
  it('includes the mode-specific instruction', () => {
    expect(systemPromptFor('shorter')).toMatch(/shorter/i);
    expect(systemPromptFor('formal')).toMatch(/formal/i);
    expect(systemPromptFor('blunt')).toMatch(/blunt/i);
  });

  it('demands only the rewritten text', () => {
    expect(systemPromptFor('shorter')).toMatch(/only the rewritten email body/i);
  });
});

describe('extractText', () => {
  it('joins text blocks and ignores other block types', () => {
    const content = [
      { type: 'thinking', thinking: '' },
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'world' },
    ];
    expect(extractText(content)).toBe('Hello world');
  });

  it('trims surrounding whitespace', () => {
    expect(extractText([{ type: 'text', text: '\n  hi  \n' }])).toBe('hi');
  });

  it('returns empty string for no text blocks', () => {
    expect(extractText([{ type: 'thinking' }])).toBe('');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/lib/ai.test.ts`
Expected: FAIL — cannot resolve `./ai`.

- [ ] **Step 3: Implement `src/lib/ai.ts`**

Uses the official SDK browser-direct (`dangerouslyAllowBrowser`). Model is `claude-opus-4-8`; no sampling params (removed on Opus 4.8); system prompt pins output to the rewritten text only.

```ts
import Anthropic from '@anthropic-ai/sdk';

export type RewriteMode = 'shorter' | 'formal' | 'blunt';

const INSTRUCTIONS: Record<RewriteMode, string> = {
  shorter: 'Rewrite the email to be significantly shorter while keeping every essential point.',
  formal: 'Rewrite the email in a more formal, professional register.',
  blunt: 'Rewrite the email to be blunt and direct. Cut hedging, softeners, and filler.',
};

export function systemPromptFor(mode: RewriteMode): string {
  return `You rewrite email drafts. ${INSTRUCTIONS[mode]} Keep the sender's intent and any names, dates, and facts intact. Respond with only the rewritten email body — no preamble, no quotes, no commentary.`;
}

interface TextishBlock {
  type: string;
  text?: string;
}

export function extractText(content: TextishBlock[]): string {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
}

const KEY_STORAGE = 'tiny-mail-api-key';

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setApiKey(key: string): void {
  try {
    localStorage.setItem(KEY_STORAGE, key);
  } catch {
    // ignore — key just won't persist
  }
}

export async function rewrite(text: string, mode: RewriteMode): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('missing-api-key');

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    system: systemPromptFor(mode),
    messages: [{ role: 'user', content: text }],
  });

  const result = extractText(message.content);
  if (!result) throw new Error('empty-response');
  return result;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run src/lib/ai.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai.ts src/lib/ai.test.ts && git commit -m "feat: Claude rewrite service with local API key storage"
```

---

### Task 6: The design system (`styles.css`)

**Files:**
- Create: `src/styles.css`
- Delete: `src/index.css`

- [ ] **Step 1: Write the stylesheet**

```css
:root {
  --bg: #fafaf9;
  --surface: #ffffff;
  --text: #1c1c1a;
  --muted: #8a8a85;
  --line: #ececea;
  --accent: #3d5af1;
  font-size: 16px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app {
  max-width: 680px;
  margin: 0 auto;
  padding: 3rem 1.5rem 4rem;
}

h1 { font-size: 1.35rem; font-weight: 600; margin: 0; letter-spacing: -0.01em; }

button {
  font: inherit;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text);
  padding: 0.4rem 0.7rem;
  border-radius: 6px;
}
button:hover { background: var(--line); }
button:disabled { opacity: 0.4; cursor: default; }

kbd {
  font-family: inherit;
  font-size: 0.7rem;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 0 0.3rem;
  margin-left: 0.35rem;
}

/* ── Inbox ─────────────────────────────── */

.inbox-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 1.25rem;
}

.email-list { list-style: none; margin: 0; padding: 0; }

.email-row {
  display: grid;
  grid-template-columns: 1rem 11rem 1fr 4rem;
  gap: 0.6rem;
  align-items: baseline;
  padding: 0.7rem 0.5rem;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  border-radius: 6px;
  transition: opacity 0.25s ease, transform 0.25s ease, background 0.1s ease;
}
.email-row.selected { background: var(--surface); box-shadow: 0 0 0 1px var(--line); }
.email-row.fading { opacity: 0; transform: translateX(10px); pointer-events: none; }

.email-row .pin { color: var(--accent); font-size: 0.55rem; }
.email-row .from { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.email-row .subject-preview {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--muted);
}
.email-row .subject-preview .subject { color: var(--text); margin-right: 0.6rem; }
.email-row .date { color: var(--muted); font-size: 0.8rem; text-align: right; white-space: nowrap; }

.email-row.unread .from,
.email-row.unread .subject { font-weight: 650; }

.empty {
  color: var(--muted);
  text-align: center;
  padding: 5rem 0;
  font-size: 1.05rem;
}

.hints {
  display: flex;
  gap: 1.25rem;
  justify-content: center;
  margin-top: 2.5rem;
  color: var(--muted);
  font-size: 0.8rem;
}

/* ── Reader ────────────────────────────── */

.reader-nav, .composer-nav {
  display: flex;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.email {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.email.fading { opacity: 0; transform: translateX(10px); }

.email h1 { margin-bottom: 0.4rem; }
.meta { color: var(--muted); font-size: 0.85rem; margin: 0 0 1.75rem; }
.meta span { color: var(--muted); }

.body { line-height: 1.65; font-size: 1rem; }
.body p { margin: 0 0 1em; }

.thread-toggle {
  display: block;
  color: var(--muted);
  font-size: 0.85rem;
  border: 1px dashed var(--line);
  border-radius: 8px;
  padding: 0.5rem 0.9rem;
  margin-bottom: 1.5rem;
}

.thread-message {
  border-left: 2px solid var(--line);
  padding-left: 1rem;
  margin-bottom: 1.5rem;
  color: var(--muted);
}
.thread-message .meta { margin-bottom: 0.4rem; }
.thread-message .body { font-size: 0.92rem; color: inherit; }

/* ── Composer ──────────────────────────── */

.composer { display: flex; flex-direction: column; min-height: 70vh; }

.field {
  font: inherit;
  border: none;
  background: none;
  outline: none;
  padding: 0.55rem 0.25rem;
  border-bottom: 1px solid var(--line);
  color: var(--text);
}
.field::placeholder { color: var(--muted); }
.field.subject { font-weight: 600; }

.body-input {
  flex: 1;
  font: inherit;
  font-size: 1.05rem;
  line-height: 1.7;
  border: none;
  outline: none;
  resize: none;
  background: none;
  padding: 1.25rem 0.25rem;
  color: var(--text);
  min-height: 40vh;
}
.body-input::placeholder { color: var(--muted); }

.send { background: var(--text); color: var(--bg); }
.send:hover { background: #000; }
.send kbd { color: var(--bg); border-color: rgba(255, 255, 255, 0.3); }

.ai-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--line);
  flex-wrap: wrap;
}
.ai-label { color: var(--muted); font-size: 0.8rem; margin-right: 0.3rem; }
.ai-bar button { border: 1px solid var(--line); font-size: 0.85rem; }
.ai-error { color: #b3261e; font-size: 0.82rem; margin-left: 0.5rem; }

.key-entry input {
  font: inherit;
  font-size: 0.85rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 0.35rem 0.6rem;
  outline: none;
  width: 16rem;
}

/* ── Toast ─────────────────────────────── */

.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--text);
  color: var(--bg);
  padding: 0.5rem 1.1rem;
  border-radius: 999px;
  font-size: 0.85rem;
}
```

- [ ] **Step 2: Point the entry at it**

Replace `src/main.tsx` with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Delete `src/index.css`.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: minimal design system stylesheet"
```

---

### Task 7: Inbox component + App state machine

**Files:**
- Create: `src/components/Inbox.tsx`
- Replace: `src/App.tsx`

- [ ] **Step 1: Write `src/components/Inbox.tsx`**

```tsx
import type { Email } from '../data/emails';
import { formatDate } from '../lib/mail';

interface Props {
  emails: Email[];
  readIds: string[];
  selectedId: string | null;
  fadingIds: string[];
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  onCompose: () => void;
}

export default function Inbox({ emails, readIds, selectedId, fadingIds, onOpen, onSelect, onCompose }: Props) {
  return (
    <div>
      <header className="inbox-header">
        <h1>Inbox</h1>
        <button onClick={onCompose}>
          Compose<kbd>C</kbd>
        </button>
      </header>

      {emails.length === 0 ? (
        <p className="empty">All done.</p>
      ) : (
        <ul className="email-list">
          {emails.map((email) => (
            <li
              key={email.id}
              className={[
                'email-row',
                readIds.includes(email.id) ? '' : 'unread',
                email.id === selectedId ? 'selected' : '',
                fadingIds.includes(email.id) ? 'fading' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => onSelect(email.id)}
              onClick={() => onOpen(email.id)}
            >
              <span className="pin">{email.important ? '●' : ''}</span>
              <span className="from">{email.from}</span>
              <span className="subject-preview">
                <span className="subject">{email.subject}</span>
                {email.body.replace(/\n+/g, ' ')}
              </span>
              <span className="date">{formatDate(email.date)}</span>
            </li>
          ))}
        </ul>
      )}

      <footer className="hints">
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>E</kbd> done</span>
        <span><kbd>C</kbd> compose</span>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/App.tsx`** (Reader/Composer imported here; created in Tasks 8–9 — build won't pass until Task 9)

```tsx
import { useEffect, useMemo, useState } from 'react';
import { emails as allEmails, type Email } from './data/emails';
import { loadState, saveState, type MailState } from './lib/store';
import { sortInbox } from './lib/mail';
import Inbox from './components/Inbox';
import Reader from './components/Reader';
import Composer from './components/Composer';

type View =
  | { name: 'inbox' }
  | { name: 'reading'; id: string }
  | { name: 'composing'; replyTo?: Email };

const FADE_MS = 250;

export default function App() {
  const [state, setState] = useState<MailState>(loadState);
  const [view, setView] = useState<View>({ name: 'inbox' });
  const [fadingIds, setFadingIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const inbox = useMemo(
    () => sortInbox(allEmails.filter((e) => !state.doneIds.includes(e.id))),
    [state.doneIds],
  );

  useEffect(() => saveState(state), [state]);

  // Keep a valid selection as the inbox changes
  useEffect(() => {
    if (!selectedId || !inbox.some((e) => e.id === selectedId)) {
      setSelectedId(inbox[0]?.id ?? null);
    }
  }, [inbox, selectedId]);

  function openEmail(id: string) {
    setState((s) => (s.readIds.includes(id) ? s : { ...s, readIds: [...s.readIds, id] }));
    setView({ name: 'reading', id });
  }

  function markDone(id: string) {
    if (fadingIds.includes(id)) return;
    setFadingIds((f) => [...f, id]);
    window.setTimeout(() => {
      setFadingIds((f) => f.filter((x) => x !== id));
      setState((s) => ({ ...s, doneIds: [...s.doneIds, id] }));
      setView((v) => (v.name === 'reading' && v.id === id ? { name: 'inbox' } : v));
    }, FADE_MS);
  }

  function sendDraft() {
    setView({ name: 'inbox' });
    setToast('Sent');
    window.setTimeout(() => setToast(null), 1600);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (view.name === 'composing') return; // Composer handles its own keys
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (view.name === 'inbox') {
        const idx = inbox.findIndex((m) => m.id === selectedId);
        if (e.key === 'ArrowDown' || e.key === 'j') {
          e.preventDefault();
          setSelectedId(inbox[Math.min(idx + 1, inbox.length - 1)]?.id ?? null);
        } else if (e.key === 'ArrowUp' || e.key === 'k') {
          e.preventDefault();
          setSelectedId(inbox[Math.max(idx - 1, 0)]?.id ?? null);
        } else if (e.key === 'Enter' && selectedId) {
          openEmail(selectedId);
        } else if (e.key.toLowerCase() === 'e' && selectedId) {
          markDone(selectedId);
        } else if (e.key.toLowerCase() === 'c') {
          setView({ name: 'composing' });
        }
      } else if (view.name === 'reading') {
        if (e.key.toLowerCase() === 'e') markDone(view.id);
        else if (e.key === 'Escape') setView({ name: 'inbox' });
        else if (e.key.toLowerCase() === 'r') {
          const email = allEmails.find((m) => m.id === view.id);
          setView({ name: 'composing', replyTo: email });
        } else if (e.key.toLowerCase() === 'c') {
          setView({ name: 'composing' });
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, inbox, selectedId, fadingIds]);

  const readingEmail = view.name === 'reading' ? allEmails.find((m) => m.id === view.id) : undefined;

  return (
    <div className="app">
      {view.name === 'inbox' && (
        <Inbox
          emails={inbox}
          readIds={state.readIds}
          selectedId={selectedId}
          fadingIds={fadingIds}
          onOpen={openEmail}
          onSelect={setSelectedId}
          onCompose={() => setView({ name: 'composing' })}
        />
      )}
      {readingEmail && (
        <Reader
          email={readingEmail}
          fading={fadingIds.includes(readingEmail.id)}
          onBack={() => setView({ name: 'inbox' })}
          onDone={() => markDone(readingEmail.id)}
          onReply={() => setView({ name: 'composing', replyTo: readingEmail })}
        />
      )}
      {view.name === 'composing' && (
        <Composer replyTo={view.replyTo} onClose={() => setView({ name: 'inbox' })} onSend={sendDraft} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Commit** (build still red until Task 9 — commit after Task 9 instead if preferred; otherwise commit now with a note)

```bash
git add src/components/Inbox.tsx src/App.tsx && git commit -m "feat: inbox view and app state machine (reader/composer pending)"
```

---

### Task 8: Reader component

**Files:**
- Create: `src/components/Reader.tsx`

- [ ] **Step 1: Write `src/components/Reader.tsx`**

```tsx
import { useState } from 'react';
import type { Email } from '../data/emails';
import { formatDate } from '../lib/mail';

interface Props {
  email: Email;
  fading: boolean;
  onBack: () => void;
  onDone: () => void;
  onReply: () => void;
}

export default function Reader({ email, fading, onBack, onDone, onReply }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <header className="reader-nav">
        <button onClick={onBack}>
          ← Inbox<kbd>Esc</kbd>
        </button>
        <div>
          <button onClick={onReply}>
            Reply<kbd>R</kbd>
          </button>
          <button onClick={onDone}>
            Done<kbd>E</kbd>
          </button>
        </div>
      </header>

      <article className={fading ? 'email fading' : 'email'}>
        <h1>{email.subject}</h1>
        <p className="meta">
          {email.from} <span>&lt;{email.fromEmail}&gt;</span> · {formatDate(email.date)}
        </p>

        {email.thread.length > 0 && !expanded && (
          <button className="thread-toggle" onClick={() => setExpanded(true)}>
            {email.thread.length} earlier {email.thread.length === 1 ? 'message' : 'messages'}
          </button>
        )}
        {expanded &&
          email.thread.map((m) => (
            <div key={m.id} className="thread-message">
              <p className="meta">
                {m.from} · {formatDate(m.date)}
              </p>
              <div className="body">
                {m.body.split('\n\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          ))}

        <div className="body">
          {email.body.split('\n\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Reader.tsx && git commit -m "feat: reading view with collapsed thread"
```

---

### Task 9: Composer component

**Files:**
- Create: `src/components/Composer.tsx`

- [ ] **Step 1: Write `src/components/Composer.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import type { Email } from '../data/emails';
import { getApiKey, rewrite, setApiKey, type RewriteMode } from '../lib/ai';

interface Props {
  replyTo?: Email;
  onClose: () => void;
  onSend: () => void;
}

const MODE_LABELS: Record<RewriteMode, string> = {
  shorter: 'Shorter',
  formal: 'More formal',
  blunt: 'Blunter',
};

export default function Composer({ replyTo, onClose, onSend }: Props) {
  const [to, setTo] = useState(replyTo?.fromEmail ?? '');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<RewriteMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bodyRef.current?.focus();
  }, []);

  async function runRewrite(mode: RewriteMode) {
    if (!body.trim() || busy) return;
    if (!getApiKey()) {
      setNeedsKey(true);
      return;
    }
    const el = bodyRef.current;
    const start = el?.selectionStart ?? 0;
    const end = el?.selectionEnd ?? 0;
    const hasSelection = start !== end;
    const target = hasSelection ? body.slice(start, end) : body;

    setBusy(mode);
    setError(null);
    try {
      const result = await rewrite(target, mode);
      setBody(hasSelection ? body.slice(0, start) + result + body.slice(end) : result);
    } catch {
      setError("Couldn't rewrite — try again");
    } finally {
      setBusy(null);
      bodyRef.current?.focus();
    }
  }

  function trySend() {
    if (!to.trim()) {
      setError('Add a recipient');
      return;
    }
    if (!body.trim()) {
      setError('Write something first');
      return;
    }
    onSend();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      trySend();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  return (
    <div className="composer" onKeyDown={handleKeyDown}>
      <header className="composer-nav">
        <button onClick={onClose}>
          ← Discard<kbd>Esc</kbd>
        </button>
        <button className="send" onClick={trySend}>
          Send<kbd>⌘↵</kbd>
        </button>
      </header>

      <input className="field" placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
      <input
        className="field subject"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <textarea
        ref={bodyRef}
        className="body-input"
        placeholder="Write…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <footer className="ai-bar">
        <span className="ai-label">Rewrite</span>
        {(Object.keys(MODE_LABELS) as RewriteMode[]).map((mode) => (
          <button key={mode} disabled={!!busy || !body.trim()} onClick={() => runRewrite(mode)}>
            {busy === mode ? '…' : MODE_LABELS[mode]}
          </button>
        ))}
        {error && <span className="ai-error">{error}</span>}
        {needsKey && (
          <span className="key-entry">
            <input
              type="password"
              placeholder="Paste Anthropic API key, press Enter"
              value={keyInput}
              autoFocus
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && keyInput.trim()) {
                  setApiKey(keyInput.trim());
                  setNeedsKey(false);
                  setKeyInput('');
                }
                if (e.key === 'Escape') setNeedsKey(false);
              }}
            />
          </span>
        )}
      </footer>
    </div>
  );
}
```

Note: selection is applied against the `body` captured at call time; a rewrite takes a few seconds and the textarea is not editable-disabled — acceptable for a prototype.

- [ ] **Step 2: Full build + test pass**

Run: `npx tsc -b && npx vite build && npx vitest run`
Expected: build succeeds, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/Composer.tsx && git commit -m "feat: doc-like composer with Cmd+Enter send and Claude rewrites"
```

---

### Task 10: End-to-end verification

- [ ] **Step 1: Run the app**

Run: `npm run dev` (background), open `http://localhost:5173`.

- [ ] **Step 2: Drive the flows**

Verify against the spec:
1. Inbox shows 9 emails; the 2 important ones (`Priya`, `Dana`) pinned on top; all bold (unread).
2. Open an email (click or Enter) → clean reading view; back to inbox → that row no longer bold. Reload → still not bold (persistence).
3. Email `e2` shows "2 earlier messages" collapsed; click expands.
4. Press `E` on a row → fades out and disappears. Reload → still gone.
5. Press `C` → composer; big writing area focused; `Esc` discards; `Cmd+Enter` with To+body → "Sent" toast, back to inbox.
6. Rewrite buttons with no API key → inline key prompt appears. With a key: type a rambly draft, click "Shorter" → body replaced by a shorter version. (If no key available at verification time, verify the error path renders inline, not as a modal.)
7. No console errors.

- [ ] **Step 3: Final commit if any fixes were made**

```bash
git add -A && git commit -m "fix: polish from end-to-end verification"
```
