# Backend Time Features (Snooze, Nudges, Send Later) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Cloudflare Worker + D1 backend that holds encrypted Gmail refresh tokens and fires time-based jobs (scheduled send, snooze wake-ups, follow-up nudge checks) on a 1-minute cron, plus the Slip UI for snooze, remind-me, and send-later.

**Architecture:** The SPA switches to Google's authorization-code flow when `VITE_API_URL` is set; the Worker exchanges the code, stores the refresh token AES-GCM-encrypted in D1, and returns a session JWT + access token. The client keeps calling Gmail directly; the Worker only executes due rows from a single `jobs` table. Spec: `docs/superpowers/specs/2026-07-09-power-features-design.md`.

**Tech Stack:** Cloudflare Workers (no framework, manual router), D1 (SQLite), cron triggers, WebCrypto (HS256 JWT + AES-GCM), vitest, wrangler. Frontend: existing React 19 + Vite app.

**Conventions:** All frontend paths relative to repo root. Server code lives in `server/` with its own `package.json`. Every task ends with a commit; run `npm test` (root) or `npm test` (in `server/`) as noted. Timestamps are **epoch milliseconds** everywhere.

---

### Task 1: Extract shared MIME module (Worker-safe)

The Worker must build MIME for scheduled sends. `buildMime` and friends live in `src/lib/gmail.ts`, which imports DOM-touching code (`stripHtml` uses `document`). Extract the pure outbound-MIME helpers into `src/lib/mime.ts` with **no DOM references** so the Worker can import it.

**Files:**
- Create: `src/lib/mime.ts`
- Modify: `src/lib/gmail.ts` (delete the moved block, re-export from `./mime`)

- [ ] **Step 1: Create `src/lib/mime.ts`** — move, verbatim, from `src/lib/gmail.ts`: `utf8ToBase64`, `encodeHeader`, `Attachment`, `OutgoingMail`, `wrap76`, `boundarySeq`, `newBoundary`, `multipart`, `buildMime`, and (if present in the outbound block) the base64url send encoder. Export `encodeHeader`, `buildMime`, and the two interfaces. The file must not reference `document`, `window`, or anything else from `gmail.ts`.

- [ ] **Step 2: Update `src/lib/gmail.ts`** — delete the moved code and add at the top:

```ts
export { buildMime, encodeHeader, type Attachment, type OutgoingMail } from './mime';
import { buildMime, type OutgoingMail } from './mime';
```

(`sendEmail`/`saveDraft` keep compiling unchanged; all existing importers of `OutgoingMail` from `./gmail` keep working via the re-export.)

- [ ] **Step 3: Verify** — Run: `npm test && npm run build`. Expected: 57 tests pass, build clean.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "refactor: extract Worker-safe MIME builders into src/lib/mime.ts"`

---

### Task 2: Scaffold the Worker project

**Files:**
- Create: `server/package.json`, `server/wrangler.toml`, `server/tsconfig.json`, `server/schema.sql`, `server/src/index.ts` (stub), `server/vitest.config.ts`
- Modify: `.gitignore` (add `server/node_modules`, `server/.wrangler`)

- [ ] **Step 1: `server/package.json`**

```json
{
  "name": "slip-api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "db:local": "wrangler d1 execute slip-db --local --file=./schema.sql",
    "db:remote": "wrangler d1 execute slip-db --remote --file=./schema.sql"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260701.0",
    "typescript": "~6.0.2",
    "vitest": "^4.1.9",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: `server/wrangler.toml`**

```toml
name = "slip-api"
main = "src/index.ts"
compatibility_date = "2026-07-01"

[triggers]
crons = ["* * * * *"]

[[d1_databases]]
binding = "DB"
database_name = "slip-db"
database_id = "REPLACE_ME_AFTER_wrangler_d1_create"

[vars]
ALLOWED_ORIGIN = "http://localhost:5173"
```

- [ ] **Step 3: `server/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,              -- Google account id (sub)
  email TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,  -- base64(iv || AES-GCM ciphertext)
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('send','snooze','nudge')),
  fire_at INTEGER NOT NULL,         -- epoch ms
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','done','needs-followup','canceled','failed')),
  payload TEXT NOT NULL,            -- JSON, shape depends on type
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_due ON jobs (status, fire_at);
CREATE INDEX IF NOT EXISTS jobs_user ON jobs (user_id, status, type);
```

- [ ] **Step 4: `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "../src/lib/mime.ts"]
}
```

- [ ] **Step 5: `server/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node' } });
```

- [ ] **Step 6: `server/src/index.ts` stub** (real router arrives in Task 5):

```ts
export interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;   // long random string, HS256 JWT key
  TOKEN_KEY: string;        // base64 32-byte AES-GCM key
  ALLOWED_ORIGIN: string;
}

export default {
  async fetch(): Promise<Response> {
    return new Response('slip-api', { status: 200 });
  },
  async scheduled(): Promise<void> {},
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 7: Install & verify** — Run: `cd server && npm install && npx tsc --noEmit`. Expected: clean.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "chore: scaffold Cloudflare Worker (slip-api) with D1 schema and cron trigger"`

---

### Task 3: Crypto + session lib (AES-GCM, HS256 JWT)

**Files:**
- Create: `server/src/lib/crypto.ts`
- Test: `server/src/lib/crypto.test.ts`

- [ ] **Step 1: Write failing tests** — `server/src/lib/crypto.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decryptText, encryptText, signSession, verifySession } from './crypto';

const KEY = btoa(String.fromCharCode(...new Uint8Array(32))); // base64 of 32 zero bytes

describe('encryptText/decryptText', () => {
  it('round-trips', async () => {
    const enc = await encryptText('1//refresh-token', KEY);
    expect(enc).not.toContain('refresh-token');
    expect(await decryptText(enc, KEY)).toBe('1//refresh-token');
  });
  it('produces a different ciphertext each call (random IV)', async () => {
    expect(await encryptText('x', KEY)).not.toBe(await encryptText('x', KEY));
  });
});

describe('signSession/verifySession', () => {
  it('round-trips sub and email', async () => {
    const jwt = await signSession({ sub: 'u1', email: 'a@b.c' }, 'secret', 60_000);
    expect(await verifySession(jwt, 'secret')).toEqual({ sub: 'u1', email: 'a@b.c' });
  });
  it('rejects a bad signature', async () => {
    const jwt = await signSession({ sub: 'u1', email: 'a@b.c' }, 'secret', 60_000);
    expect(await verifySession(jwt, 'other')).toBeNull();
  });
  it('rejects an expired token', async () => {
    const jwt = await signSession({ sub: 'u1', email: 'a@b.c' }, 'secret', -1000);
    expect(await verifySession(jwt, 'secret')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `cd server && npm test`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `server/src/lib/crypto.ts`**

```ts
// AES-GCM secret storage + minimal HS256 session JWTs, WebCrypto only
// (runs identically in Workers and Node >= 20).

function b64encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function b64decode(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function b64url(bytes: Uint8Array): string {
  return b64encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Uint8Array {
  return b64decode(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
}

async function aesKey(keyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', b64decode(keyB64), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptText(plain: string, keyB64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await aesKey(keyB64),
    new TextEncoder().encode(plain),
  );
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ct), 12);
  return b64encode(out);
}

export async function decryptText(encB64: string, keyB64: string): Promise<string> {
  const data = b64decode(encB64);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: data.slice(0, 12) },
    await aesKey(keyB64),
    data.slice(12),
  );
  return new TextDecoder().decode(plain);
}

export interface SessionClaims {
  sub: string;
  email: string;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signSession(claims: SessionClaims, secret: string, ttlMs: number): Promise<string> {
  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify({ ...claims, exp: Date.now() + ttlMs })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifySession(jwt: string, secret: string): Promise<SessionClaims | null> {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  const ok = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    b64urlDecode(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!ok) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
    if (typeof claims.exp !== 'number' || claims.exp < Date.now()) return null;
    return { sub: claims.sub, email: claims.email };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests** — `cd server && npm test`. Expected: PASS (5 tests).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(server): AES-GCM secret storage and HS256 session JWTs"`

---

### Task 4: Google OAuth helpers

**Files:**
- Create: `server/src/lib/google.ts`
- Test: `server/src/lib/google.test.ts`

- [ ] **Step 1: Write failing tests** (mock `fetch`):

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeCode, refreshAccessToken } from './google';

const creds = { clientId: 'id', clientSecret: 'sec' };
afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, json: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(json), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('exchangeCode', () => {
  it('posts the code and returns tokens', async () => {
    const fn = stubFetch(200, { access_token: 'at', refresh_token: 'rt', expires_in: 3599 });
    const out = await exchangeCode('the-code', creds);
    expect(out).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresIn: 3599 });
    const body = String((fn.mock.calls[0][1] as RequestInit).body);
    expect(body).toContain('code=the-code');
    expect(body).toContain('redirect_uri=postmessage');
    expect(body).toContain('grant_type=authorization_code');
  });
  it('throws token-exchange-failed on non-200', async () => {
    stubFetch(400, { error: 'invalid_grant' });
    await expect(exchangeCode('bad', creds)).rejects.toThrow('token-exchange-failed');
  });
  it('throws no-refresh-token when Google omits it', async () => {
    stubFetch(200, { access_token: 'at', expires_in: 3599 });
    await expect(exchangeCode('c', creds)).rejects.toThrow('no-refresh-token');
  });
});

describe('refreshAccessToken', () => {
  it('returns a fresh access token', async () => {
    stubFetch(200, { access_token: 'at2', expires_in: 3599 });
    expect(await refreshAccessToken('rt', creds)).toEqual({ accessToken: 'at2', expiresIn: 3599 });
  });
  it('throws invalid_grant when revoked', async () => {
    stubFetch(400, { error: 'invalid_grant' });
    await expect(refreshAccessToken('rt', creds)).rejects.toThrow('invalid_grant');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `cd server && npm test`. Expected: FAIL.

- [ ] **Step 3: Implement `server/src/lib/google.ts`**

```ts
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface GoogleCreds {
  clientId: string;
  clientSecret: string;
}

async function tokenRequest(params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(data.error === 'invalid_grant' ? 'invalid_grant' : 'token-exchange-failed');
  }
  return data;
}

// Popup-mode code flow uses the literal redirect_uri "postmessage".
export async function exchangeCode(code: string, creds: GoogleCreds) {
  const data = await tokenRequest({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: 'postmessage',
    grant_type: 'authorization_code',
  });
  if (typeof data.refresh_token !== 'string') throw new Error('no-refresh-token');
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in as number,
  };
}

export async function refreshAccessToken(refreshToken: string, creds: GoogleCreds) {
  const data = await tokenRequest({
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'refresh_token',
  });
  return { accessToken: data.access_token as string, expiresIn: data.expires_in as number };
}

export async function fetchUserinfo(accessToken: string): Promise<{ sub: string; email: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('userinfo-failed');
  const data = (await res.json()) as { sub: string; email: string };
  return { sub: data.sub, email: data.email };
}
```

- [ ] **Step 4: Run tests** — `cd server && npm test`. Expected: PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(server): Google code-exchange and token-refresh helpers"`

---

### Task 5: Job validation + the HTTP API (auth, jobs CRUD)

**Files:**
- Create: `server/src/lib/jobs.ts`
- Modify: `server/src/index.ts` (replace stub with the router)
- Test: `server/src/lib/jobs.test.ts`

- [ ] **Step 1: Write failing validation tests** — `server/src/lib/jobs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateJobInput } from './jobs';

const future = Date.now() + 60_000;

describe('validateJobInput', () => {
  it('accepts a send job without attachments', () => {
    const v = validateJobInput({
      type: 'send',
      fireAt: future,
      payload: { mail: { to: 'a@b.c', subject: 'hi', body: 'x' } },
    });
    expect(v.ok).toBe(true);
  });
  it('rejects a send job with attachments', () => {
    const v = validateJobInput({
      type: 'send',
      fireAt: future,
      payload: { mail: { to: 'a@b.c', subject: 'hi', body: 'x', attachments: [{}] } },
    });
    expect(v).toEqual({ ok: false, error: 'attachments-not-supported' });
  });
  it('rejects past fireAt and unknown types', () => {
    expect(validateJobInput({ type: 'send', fireAt: 5, payload: { mail: { to: 'a', subject: '', body: '' } } }).ok).toBe(false);
    expect(validateJobInput({ type: 'nope', fireAt: future, payload: {} }).ok).toBe(false);
  });
  it('requires messageId for snooze and threadId+afterMs for nudge', () => {
    expect(validateJobInput({ type: 'snooze', fireAt: future, payload: { messageId: 'm', threadId: 't' } }).ok).toBe(true);
    expect(validateJobInput({ type: 'snooze', fireAt: future, payload: { threadId: 't' } }).ok).toBe(false);
    expect(validateJobInput({ type: 'nudge', fireAt: future, payload: { threadId: 't', afterMs: 1, to: 'a@b.c', subject: 's' } }).ok).toBe(true);
    expect(validateJobInput({ type: 'nudge', fireAt: future, payload: { afterMs: 1 } }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `cd server && npm test`. Expected: FAIL.

- [ ] **Step 3: Implement `server/src/lib/jobs.ts`**

```ts
export type JobType = 'send' | 'snooze' | 'nudge';

export interface JobRow {
  id: string;
  user_id: string;
  type: JobType;
  fire_at: number;
  status: 'pending' | 'done' | 'needs-followup' | 'canceled' | 'failed';
  payload: string;
  created_at: number;
}

export interface SendPayload {
  mail: { to: string; subject: string; body: string; bodyHtml?: string; threadId?: string; inReplyTo?: string };
}
export interface SnoozePayload {
  messageId: string;
  threadId: string;
  from?: string;
  subject?: string;
}
export interface NudgePayload {
  threadId: string;
  afterMs: number; // only replies newer than this count
  to: string;
  subject: string;
}

type Validation = { ok: true } | { ok: false; error: string };

export function validateJobInput(input: { type?: unknown; fireAt?: unknown; payload?: any }): Validation {
  if (typeof input.fireAt !== 'number' || input.fireAt < Date.now() - 60_000) {
    return { ok: false, error: 'bad-fire-at' };
  }
  const p = input.payload ?? {};
  switch (input.type) {
    case 'send': {
      const mail = p.mail ?? {};
      if (Array.isArray(mail.attachments) && mail.attachments.length > 0) {
        return { ok: false, error: 'attachments-not-supported' };
      }
      if (typeof mail.to !== 'string' || !mail.to || typeof mail.subject !== 'string' || typeof mail.body !== 'string') {
        return { ok: false, error: 'bad-mail' };
      }
      return { ok: true };
    }
    case 'snooze':
      return typeof p.messageId === 'string' && typeof p.threadId === 'string'
        ? { ok: true }
        : { ok: false, error: 'bad-snooze' };
    case 'nudge':
      return typeof p.threadId === 'string' && typeof p.afterMs === 'number' &&
        typeof p.to === 'string' && typeof p.subject === 'string'
        ? { ok: true }
        : { ok: false, error: 'bad-nudge' };
    default:
      return { ok: false, error: 'bad-type' };
  }
}
```

- [ ] **Step 4: Run tests** — `cd server && npm test`. Expected: PASS.

- [ ] **Step 5: Replace `server/src/index.ts` with the router**

```ts
import { decryptText, encryptText, signSession, verifySession, type SessionClaims } from './lib/crypto';
import { exchangeCode, fetchUserinfo, refreshAccessToken } from './lib/google';
import { validateJobInput, type JobRow } from './lib/jobs';
import { runDueJobs } from './cron';

export interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  TOKEN_KEY: string;
  ALLOWED_ORIGIN: string;
}

const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

function cors(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  };
}

function json(env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(env) },
  });
}

function creds(env: Env) {
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
}

async function requireSession(req: Request, env: Env): Promise<SessionClaims | null> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  return verifySession(auth.slice(7), env.SESSION_SECRET);
}

async function handleAuthGoogle(req: Request, env: Env): Promise<Response> {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code) return json(env, { error: 'missing-code' }, 400);
  let tokens;
  try {
    tokens = await exchangeCode(code, creds(env));
  } catch (e) {
    return json(env, { error: (e as Error).message }, 403);
  }
  const who = await fetchUserinfo(tokens.accessToken);
  const enc = await encryptText(tokens.refreshToken, env.TOKEN_KEY);
  await env.DB.prepare(
    `INSERT INTO users (id, email, refresh_token_enc, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, refresh_token_enc = excluded.refresh_token_enc`,
  ).bind(who.sub, who.email, enc, Date.now()).run();
  const session = await signSession({ sub: who.sub, email: who.email }, env.SESSION_SECRET, SESSION_TTL_MS);
  return json(env, { session, accessToken: tokens.accessToken, expiresIn: tokens.expiresIn, email: who.email });
}

async function handleAuthToken(claims: SessionClaims, env: Env): Promise<Response> {
  const row = await env.DB.prepare('SELECT refresh_token_enc FROM users WHERE id = ?')
    .bind(claims.sub).first<{ refresh_token_enc: string }>();
  if (!row) return json(env, { error: 'unknown-user' }, 401);
  try {
    const rt = await decryptText(row.refresh_token_enc, env.TOKEN_KEY);
    const t = await refreshAccessToken(rt, creds(env));
    return json(env, { accessToken: t.accessToken, expiresIn: t.expiresIn, email: claims.email });
  } catch {
    return json(env, { error: 'reauth-required' }, 401);
  }
}

async function handleJobs(req: Request, claims: SessionClaims, env: Env, url: URL): Promise<Response> {
  if (req.method === 'POST') {
    const input = (await req.json().catch(() => ({}))) as { type?: string; fireAt?: number; payload?: unknown };
    const v = validateJobInput(input);
    if (!v.ok) return json(env, { error: v.error }, 400);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO jobs (id, user_id, type, fire_at, status, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(id, claims.sub, input.type, input.fireAt, 'pending', JSON.stringify(input.payload), Date.now()).run();
    return json(env, { id }, 201);
  }
  if (req.method === 'GET') {
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status') ?? 'pending';
    const q = type
      ? env.DB.prepare('SELECT * FROM jobs WHERE user_id = ? AND status = ? AND type = ? ORDER BY fire_at').bind(claims.sub, status, type)
      : env.DB.prepare('SELECT * FROM jobs WHERE user_id = ? AND status = ? ORDER BY fire_at').bind(claims.sub, status);
    const { results } = await q.all<JobRow>();
    return json(env, results.map((r) => ({
      id: r.id, type: r.type, fireAt: r.fire_at, status: r.status, payload: JSON.parse(r.payload),
    })));
  }
  return json(env, { error: 'method-not-allowed' }, 405);
}

async function handleJobDelete(id: string, claims: SessionClaims, env: Env): Promise<Response> {
  const res = await env.DB.prepare(
    "UPDATE jobs SET status = 'canceled' WHERE id = ? AND user_id = ? AND status IN ('pending','needs-followup')",
  ).bind(id, claims.sub).run();
  return res.meta.changes > 0 ? json(env, { ok: true }) : json(env, { error: 'not-found' }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    if (url.pathname === '/auth/google' && req.method === 'POST') return handleAuthGoogle(req, env);

    const claims = await requireSession(req, env);
    if (url.pathname === '/auth/token' && req.method === 'POST') {
      return claims ? handleAuthToken(claims, env) : json(env, { error: 'unauthorized' }, 401);
    }
    if (!claims) return json(env, { error: 'unauthorized' }, 401);
    if (url.pathname === '/api/jobs') return handleJobs(req, claims, env, url);
    const m = url.pathname.match(/^\/api\/jobs\/([\w-]+)$/);
    if (m && req.method === 'DELETE') return handleJobDelete(m[1], claims, env);
    return json(env, { error: 'not-found' }, 404);
  },

  async scheduled(_ctrl: ScheduledController, env: Env): Promise<void> {
    await runDueJobs(env);
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 6: Create a placeholder `server/src/cron.ts`** so it compiles (Task 6 fills it):

```ts
import type { Env } from './index';
export async function runDueJobs(_env: Env): Promise<void> {}
```

- [ ] **Step 7: Verify** — `cd server && npx tsc --noEmit && npm test`. Expected: clean, tests pass.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(server): auth endpoints and jobs CRUD with session guard"`

---

### Task 6: Cron executor

**Files:**
- Modify: `server/src/cron.ts` (replace placeholder)
- Test: `server/src/cron.test.ts`

- [ ] **Step 1: Write failing tests for the pure decision logic**

```ts
import { describe, expect, it } from 'vitest';
import { threadHasReply } from './cron';

const msg = (from: string, ms: number) => ({
  internalDate: String(ms),
  payload: { headers: [{ name: 'From', value: from }] },
});

describe('threadHasReply', () => {
  it('true when someone else wrote after afterMs', () => {
    expect(threadHasReply([msg('Me <me@x.co>', 1000), msg('Ada <ada@y.co>', 2000)], 'me@x.co', 1500)).toBe(true);
  });
  it('false when only my own messages follow', () => {
    expect(threadHasReply([msg('me@x.co', 1000), msg('"Me" <ME@X.CO>', 2000)], 'me@x.co', 1500)).toBe(false);
  });
  it('false when the reply predates afterMs', () => {
    expect(threadHasReply([msg('ada@y.co', 1000)], 'me@x.co', 1500)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `cd server && npm test`. Expected: FAIL.

- [ ] **Step 3: Implement `server/src/cron.ts`**

```ts
import { decryptText } from './lib/crypto';
import { refreshAccessToken } from './lib/google';
import type { JobRow, NudgePayload, SendPayload, SnoozePayload } from './lib/jobs';
import type { Env } from './index';
import { buildMime } from '../../src/lib/mime';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface ThreadMsg {
  internalDate: string;
  payload: { headers: { name: string; value: string }[] };
}

export function threadHasReply(messages: ThreadMsg[], userEmail: string, afterMs: number): boolean {
  const me = userEmail.toLowerCase();
  return messages.some((m) => {
    if (Number(m.internalDate) <= afterMs) return false;
    const from = m.payload.headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
    return !from.toLowerCase().includes(me);
  });
}

function mimeToBase64Url(mime: string): string {
  const bytes = new TextEncoder().encode(mime);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function gmail(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${GMAIL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  });
}

async function executeJob(job: JobRow, token: string, userEmail: string): Promise<'done' | 'needs-followup'> {
  const payload = JSON.parse(job.payload);
  if (job.type === 'send') {
    const { mail } = payload as SendPayload;
    const body: Record<string, string> = { raw: mimeToBase64Url(buildMime(mail)) };
    if (mail.threadId) body.threadId = mail.threadId;
    const res = await gmail(token, '/messages/send', { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`gmail-send-${res.status}`);
    return 'done';
  }
  if (job.type === 'snooze') {
    const { messageId } = payload as SnoozePayload;
    const res = await gmail(token, `/messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify({ addLabelIds: ['INBOX', 'UNREAD'] }),
    });
    if (!res.ok) throw new Error(`gmail-modify-${res.status}`);
    return 'done';
  }
  // nudge
  const { threadId, afterMs } = payload as NudgePayload;
  const res = await gmail(token, `/threads/${threadId}?format=metadata&metadataHeaders=From`);
  if (!res.ok) throw new Error(`gmail-thread-${res.status}`);
  const thread = (await res.json()) as { messages: ThreadMsg[] };
  return threadHasReply(thread.messages ?? [], userEmail, afterMs) ? 'done' : 'needs-followup';
}

export async function runDueJobs(env: Env): Promise<void> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM jobs WHERE status = 'pending' AND fire_at <= ? ORDER BY fire_at LIMIT 50",
  ).bind(Date.now()).all<JobRow>();
  if (results.length === 0) return;

  const tokens = new Map<string, { token: string; email: string }>();
  for (const job of results) {
    try {
      let auth = tokens.get(job.user_id);
      if (!auth) {
        const user = await env.DB.prepare('SELECT email, refresh_token_enc FROM users WHERE id = ?')
          .bind(job.user_id).first<{ email: string; refresh_token_enc: string }>();
        if (!user) throw new Error('unknown-user');
        const rt = await decryptText(user.refresh_token_enc, env.TOKEN_KEY);
        const t = await refreshAccessToken(rt, {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        });
        auth = { token: t.accessToken, email: user.email };
        tokens.set(job.user_id, auth);
      }
      const status = await executeJob(job, auth.token, auth.email);
      await env.DB.prepare('UPDATE jobs SET status = ? WHERE id = ?').bind(status, job.id).run();
    } catch (e) {
      await env.DB.prepare('UPDATE jobs SET status = ?, payload = json_set(payload, ?, ?) WHERE id = ?')
        .bind('failed', '$._error', (e as Error).message, job.id).run();
    }
  }
}
```

- [ ] **Step 4: Verify** — `cd server && npx tsc --noEmit && npm test`. Expected: clean, PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(server): cron executor for send/snooze/nudge jobs"`

---

### Task 7: Client — backend auth mode + jobs client

**Files:**
- Modify: `src/lib/gmail.ts` (code flow, session storage, silent reconnect; `sendEmail` returns ids)
- Create: `src/lib/backend.ts`
- Modify: `src/App.tsx` (silent reconnect on mount)

- [ ] **Step 1: Extend the GIS typings and scopes in `src/lib/gmail.ts`** — add `userinfo.email` scope and code-client types:

```ts
const SCOPES =
  'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

interface CodeClient { requestCode: () => void }
// inside GoogleGlobal.accounts.oauth2 add:
//   initCodeClient: (config: {
//     client_id: string; scope: string; ux_mode: 'popup';
//     callback: (resp: { code?: string; error?: string }) => void;
//     error_callback?: (err: { type?: string; message?: string }) => void;
//   }) => CodeClient;
```

- [ ] **Step 2: Add backend connect path in `src/lib/gmail.ts`**

```ts
export const API_URL: string | null = import.meta.env.VITE_API_URL ?? null;
const SESSION_KEY = 'tiny-mail-session';

export function getSession(): string | null {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}
function setSession(s: string | null): void {
  try { s ? localStorage.setItem(SESSION_KEY, s) : localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

// Silent: valid stored session -> access token without a popup. Returns false if a popup is needed.
export async function reconnect(): Promise<boolean> {
  const session = API_URL && getSession();
  if (!session) return false;
  const res = await fetch(`${API_URL}/auth/token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session}` },
  });
  if (!res.ok) { setSession(null); return false; }
  accessToken = ((await res.json()) as { accessToken: string }).accessToken;
  return true;
}

async function connectViaBackend(): Promise<void> {
  if (await reconnect()) return;
  const clientId = getClientId();
  if (!clientId) throw new Error('missing-client-id');
  await loadGis();
  const code = await new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts!.oauth2!.initCodeClient({
      client_id: clientId,
      scope: SCOPES,
      ux_mode: 'popup',
      callback: (resp) => (resp.code ? resolve(resp.code) : reject(new Error(resp.error ?? 'auth-failed'))),
      error_callback: (err) => reject(new Error(err.message ?? err.type ?? 'auth-failed')),
    });
    client.requestCode();
  });
  const res = await fetch(`${API_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(res.status === 403 ? 'access_denied' : 'auth-failed');
  const data = (await res.json()) as { session: string; accessToken: string };
  setSession(data.session);
  accessToken = data.accessToken;
}

// connect() becomes:
export async function connect(): Promise<void> {
  if (API_URL) return connectViaBackend();
  /* ...existing token-flow body unchanged... */
}
```

- [ ] **Step 3: Make `sendEmail` return ids** (needed by nudges) — change its tail to:

```ts
export async function sendEmail(mail: OutgoingMail): Promise<{ id: string; threadId: string }> {
  /* existing MIME + raw building unchanged */
  return api<{ id: string; threadId: string }>('/messages/send', { method: 'POST', body: JSON.stringify(body) });
}
```

- [ ] **Step 4: Create `src/lib/backend.ts`**

```ts
import { API_URL, getSession } from './gmail';

export type JobType = 'send' | 'snooze' | 'nudge';

export interface Job<P = Record<string, unknown>> {
  id: string;
  type: JobType;
  fireAt: number;
  status: string;
  payload: P;
}

export function backendEnabled(): boolean {
  return !!API_URL;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getSession();
  if (!API_URL || !session) throw new Error('no-backend-session');
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw new Error(`backend-${res.status}`);
  return res.json() as Promise<T>;
}

export function createJob(type: JobType, fireAt: number, payload: unknown): Promise<{ id: string }> {
  return api('/api/jobs', { method: 'POST', body: JSON.stringify({ type, fireAt, payload }) });
}

export function listJobs<P>(type: JobType, status = 'pending'): Promise<Job<P>[]> {
  return api(`/api/jobs?type=${type}&status=${status}`);
}

export function cancelJob(id: string): Promise<{ ok: boolean }> {
  return api(`/api/jobs/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 5: Silent reconnect on mount in `src/App.tsx`** — add near the theme effect:

```tsx
useEffect(() => {
  reconnect()
    .then((ok) => {
      if (!ok) return;
      fetchProfile().then(setProfile).catch(() => undefined);
      return fetchInbox().then(setEmails);
    })
    .catch(() => undefined);
}, []);
```

(No `entering` animation on the silent path — the overlay stays exclusive to the explicit Connect click.)

- [ ] **Step 6: Verify** — `npm test && npm run build`; then end-to-end: `cd server && npm run db:local && npm run dev` (Worker on http://localhost:8787), `VITE_API_URL=http://localhost:8787 npm run dev`, connect with a real Google account (client with secret configured), reload the page → inbox loads with no popup.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: code-flow auth via backend with silent reconnect + jobs client"`

---

### Task 8: Snooze times lib + UI

**Files:**
- Create: `src/lib/when.ts` (shared by snooze + send later)
- Create: `src/components/WhenPicker.tsx`
- Modify: `src/App.tsx` (`s` key, snooze action, Snoozed section), `src/components/Sidebar.tsx`, `src/components/Inbox.tsx` (snoozed mode rows), `src/styles.css`
- Test: `src/lib/when.test.ts`

- [ ] **Step 1: Write failing tests** — `src/lib/when.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sendLaterPresets, snoozePresets } from './when';

// Wed 2026-07-08 21:00 local
const now = new Date(2026, 6, 8, 21, 0);

describe('snoozePresets', () => {
  it('later today is +3h', () => {
    const p = snoozePresets(now).find((x) => x.label === 'Later today')!;
    expect(p.when.getTime() - now.getTime()).toBe(3 * 3600_000);
  });
  it('tomorrow morning is next day 8am', () => {
    const p = snoozePresets(now).find((x) => x.label === 'Tomorrow')!;
    expect([p.when.getDate(), p.when.getHours()]).toEqual([9, 8]);
  });
  it('weekend is Saturday 8am, next week is Monday 8am', () => {
    const wk = snoozePresets(now).find((x) => x.label === 'This weekend')!;
    const mo = snoozePresets(now).find((x) => x.label === 'Next week')!;
    expect([wk.when.getDay(), wk.when.getHours()]).toEqual([6, 8]);
    expect([mo.when.getDay(), mo.when.getHours()]).toEqual([1, 8]);
    expect(mo.when.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe('sendLaterPresets', () => {
  it('has tomorrow 8am and 1pm, both in the future', () => {
    for (const p of sendLaterPresets(now)) expect(p.when.getTime()).toBeGreaterThan(now.getTime());
    expect(sendLaterPresets(now).some((p) => p.when.getHours() === 8)).toBe(true);
    expect(sendLaterPresets(now).some((p) => p.when.getHours() === 13)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test`. Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/when.ts`**

```ts
export interface WhenOption {
  label: string;
  when: Date;
}

function at(base: Date, addDays: number, hour: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + addDays);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function nextDow(base: Date, dow: number, hour: number): Date {
  const d = at(base, 0, hour);
  do { d.setDate(d.getDate() + 1); } while (d.getDay() !== dow);
  return d;
}

export function snoozePresets(now: Date): WhenOption[] {
  return [
    { label: 'Later today', when: new Date(now.getTime() + 3 * 3600_000) },
    { label: 'Tomorrow', when: at(now, 1, 8) },
    { label: 'This weekend', when: nextDow(now, 6, 8) },
    { label: 'Next week', when: nextDow(now, 1, 8) },
  ];
}

export function sendLaterPresets(now: Date): WhenOption[] {
  return [
    { label: 'Tomorrow 8am', when: at(now, 1, 8) },
    { label: 'Tomorrow 1pm', when: at(now, 1, 13) },
    { label: 'Monday 8am', when: nextDow(now, 1, 8) },
  ];
}

export function formatWhen(d: Date): string {
  return d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
```

- [ ] **Step 4: Run tests** — `npm test`. Expected: PASS.

- [ ] **Step 5: Create `src/components/WhenPicker.tsx`** — a small centered overlay sharing the palette's visual language:

```tsx
import { useEffect, useRef, useState } from 'react';
import { formatWhen, type WhenOption } from '../lib/when';

interface Props {
  title: string;
  options: WhenOption[];
  onPick: (when: Date) => void;
  onClose: () => void;
}

export default function WhenPicker({ title, options, onPick, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [custom, setCustom] = useState('');
  const customRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => Math.min(Math.max(i + (e.key === 'ArrowDown' ? 1 : -1), 0), options.length));
      } else if (e.key === 'Enter') {
        if (document.activeElement === customRef.current) {
          const d = new Date(custom);
          if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) onPick(d);
        } else if (index < options.length) onPick(options[index].when);
      }
      e.stopPropagation();
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [index, custom, options, onPick, onClose]);

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="when-picker" onClick={(e) => e.stopPropagation()}>
        <div className="when-title">{title}</div>
        {options.map((o, i) => (
          <button
            key={o.label}
            className={i === index ? 'when-option active' : 'when-option'}
            onMouseEnter={() => setIndex(i)}
            onClick={() => onPick(o.when)}
          >
            {o.label}
            <span className="when-time">{formatWhen(o.when)}</span>
          </button>
        ))}
        <input
          ref={customRef}
          type="datetime-local"
          className={index === options.length ? 'field when-custom active' : 'field when-custom'}
          value={custom}
          onFocus={() => setIndex(options.length)}
          onChange={(e) => setCustom(e.target.value)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Wire snooze into `src/App.tsx`**
  - State: `const [snoozeTarget, setSnoozeTarget] = useState<Email | null>(null);` and `const [snoozed, setSnoozed] = useState<Job<SnoozePayload>[] | null>(null);`
  - Key handler: in the list/reading branches add `else if (e.key.toLowerCase() === 's' && backendEnabled()) setSnoozeTarget(currentEmail)` (list: selected email in inbox section only; reading: the open email).
  - Action:

```tsx
function snoozeEmail(email: Email, when: Date) {
  setSnoozeTarget(null);
  setFadingIds((f) => [...f, email.id]);
  window.setTimeout(() => {
    setFadingIds((f) => f.filter((x) => x !== email.id));
    setEmails((list) => list?.filter((m) => m.id !== email.id) ?? null);
    setView((v) => (v.name === 'reading' && v.id === email.id ? { name: 'list' } : v));
    archive(email.id)
      .then(() => createJob('snooze', when.getTime(), {
        messageId: email.id, threadId: email.threadId, from: email.from, subject: email.subject,
      }))
      .then(() => showToast({ text: `Snoozed until ${formatWhen(when)}` }))
      .catch(() => {
        setEmails((list) => (list ? [...list, email] : [email]));
        showToast({ text: "Couldn't snooze" });
      });
  }, FADE_MS);
}
```

  - Render: `{snoozeTarget && <WhenPicker title="Snooze until…" options={snoozePresets(new Date())} onPick={(w) => snoozeEmail(snoozeTarget, w)} onClose={() => setSnoozeTarget(null)} />}`
  - **Snoozed section**: extend `Section` type in `src/components/Inbox.tsx` with `'snoozed'`; in `navigate('snoozed')` load `listJobs<SnoozePayload>('snooze')` and map each job to an `Email`-shaped row (`id: job.id`, `from: payload.from`, `subject: payload.subject`, `snippet: 'Back ' + formatWhen(new Date(job.fireAt))`, `date: new Date(job.fireAt).toISOString()`); `E`/dismiss in this section = unsnooze: `cancelJob(job.id)` then `unarchive(payload.messageId)` then remove the row.
  - Sidebar: add `{ key: 'snoozed', label: 'Snoozed', icon: <IconClock /> }` to `ITEMS` in `src/components/Sidebar.tsx`, gated on `backendEnabled()`. Add `IconClock` to `src/components/icons.tsx`:

```tsx
export function IconClock({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8V8l2.2 1.6" />
    </svg>
  );
}
```

- [ ] **Step 7: CSS** — add to `src/styles.css` (shared by WhenPicker and palette):

```css
.overlay-backdrop {
  position: fixed; inset: 0; z-index: 40;
  background: rgba(0, 0, 0, 0.18);
  display: grid; place-items: start center; padding-top: 18vh;
}
.when-picker {
  background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
  width: min(24rem, 92vw); padding: 0.4rem; display: flex; flex-direction: column;
}
.when-title { font-size: 0.8rem; color: var(--muted); padding: 0.5rem 0.75rem 0.25rem; }
.when-option {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.55rem 0.75rem; border-radius: 8px; font-size: 0.95rem; text-align: left;
}
.when-option.active { background: var(--hover); }
.when-time { color: var(--muted); font-size: 0.85rem; }
.when-custom { margin: 0.25rem 0.75rem 0.5rem; }
.when-custom.active { border-color: var(--text); }
```

- [ ] **Step 8: Verify end-to-end** — with Worker + app running: press `s` on an email → pick "Later today" → row fades, toast shows; Snoozed section lists it; `wrangler d1 execute slip-db --local --command "UPDATE jobs SET fire_at = 0"` then wait ≤1 min (or `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` with `wrangler dev --test-scheduled`) → email back in inbox, unread.

- [ ] **Step 9: Commit** — `git add -A && git commit -m "feat: snooze — s key, when-picker, Snoozed section, cron wake"`

---

### Task 9: Send later

**Files:**
- Modify: `src/components/Composer.tsx` (Send later button → WhenPicker → `onSendLater`), `src/App.tsx` (handler + Scheduled section), `src/components/Sidebar.tsx`, `src/components/Inbox.tsx` (`'scheduled'` Section)

- [ ] **Step 1: Composer** — add prop `onSendLater: (mail: OutgoingMail, when: Date, draftId?: string) => Promise<void>` to Composer's Props; next to the Send button render (only when `backendEnabled()`):

```tsx
<button className="ghost" title="Send later" onClick={() => setPickingWhen(true)} disabled={sending}>
  Send later
</button>
{pickingWhen && (
  <WhenPicker
    title="Send at…"
    options={sendLaterPresets(new Date())}
    onClose={() => setPickingWhen(false)}
    onPick={(when) => {
      setPickingWhen(false);
      if (attachments.length > 0) { setError('Attachments aren’t supported on scheduled sends yet'); return; }
      submit(() => onSendLater(buildOutgoing(), when, draft?.draftId));
    }}
  />
)}
```

(`buildOutgoing()` = however Composer currently assembles the `OutgoingMail` for `onSend` — reuse the same expression; `submit` = the existing send-wrapping error/disabled logic.)

- [ ] **Step 2: App handler**

```tsx
async function handleSendLater(mail: OutgoingMail, when: Date, draftId?: string) {
  await createJob('send', when.getTime(), { mail });
  if (draftId) {
    deleteDraft(draftId).catch(() => undefined);
    setDrafts((list) => list?.filter((d) => d.draftId !== draftId) ?? null);
  }
  setView({ name: 'list' });
  showToast({ text: `Will send ${formatWhen(when)}` });
}
```

- [ ] **Step 3: Scheduled section** — same pattern as Snoozed: `Section` union gains `'scheduled'`; navigate loads `listJobs<SendPayload>('send')`; rows show `to`/`subject`, snippet `Sends {formatWhen(fireAt)}`; `E` cancels the job (`cancelJob`) and shows toast "Canceled — saved nowhere, recompose if needed" (v1 keeps it simple; no draft resurrection). Sidebar item `{ key: 'scheduled', label: 'Scheduled', icon: <IconSendLater /> }` gated on `backendEnabled()`; reuse `IconClock` if a second clock feels redundant — pick `IconSendLater`:

```tsx
export function IconSendLater({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M13.5 2.5 7 9m6.5-6.5-4.2 11-2.3-4.7-4.7-2.3z" />
    </svg>
  );
}
```

- [ ] **Step 4: Verify end-to-end** — compose to yourself → Send later → Tomorrow 8am → appears in Scheduled; force `fire_at = 0` in local D1, trigger the cron, confirm the mail arrives in Gmail and job status is `done`.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: send later — composer picker, Scheduled section, cron send"`

---

### Task 10: Follow-up nudges

**Files:**
- Modify: `src/components/Composer.tsx` (remind-me select), `src/App.tsx` (create nudge after send; Follow-up group above inbox), `src/components/Inbox.tsx` (render follow-up group), `src/styles.css`

- [ ] **Step 1: Composer remind-me control** — state `const [remindDays, setRemindDays] = useState(0);` rendered near Send (backend mode only):

```tsx
<select className="field remind-select" value={remindDays} onChange={(e) => setRemindDays(Number(e.target.value))}>
  <option value={0}>No reminder</option>
  <option value={1}>Nudge me in 1 day</option>
  <option value={3}>Nudge me in 3 days</option>
  <option value={7}>Nudge me in 7 days</option>
</select>
```

Pass `remindDays` through `onSend(mail, draftId, remindDays)` (extend the Props signature).

- [ ] **Step 2: App — create the nudge after a successful send** (in `handleSend`):

```tsx
async function handleSend(mail: OutgoingMail, draftId?: string, remindDays = 0) {
  const sent = await sendEmail(mail); // now returns { id, threadId }
  if (remindDays > 0 && backendEnabled()) {
    createJob('nudge', Date.now() + remindDays * 86_400_000, {
      threadId: sent.threadId, afterMs: Date.now(), to: mail.to, subject: mail.subject,
    }).catch(() => showToast({ text: "Sent, but couldn't set the reminder" }));
  }
  /* existing draft cleanup + toast unchanged */
}
```

- [ ] **Step 3: Follow-up group** — App loads it with the inbox:

```tsx
const [followups, setFollowups] = useState<Job<NudgePayload>[]>([]);
// wherever the inbox is (re)fetched, alongside:
if (backendEnabled()) listJobs<NudgePayload>('nudge', 'needs-followup').then(setFollowups).catch(() => undefined);
```

Render above the list in `src/components/Inbox.tsx` via a new prop `followups` + callbacks `onFollowupReply(job)`, `onFollowupDismiss(job)`:

```tsx
{followups.length > 0 && mode === 'inbox' && (
  <div className="followups">
    <div className="side-label">Follow up</div>
    {followups.map((j) => (
      <div key={j.id} className="followup-row">
        <span className="followup-who">{j.payload.to}</span>
        <span className="followup-subject">{j.payload.subject || '(no subject)'}</span>
        <span className="followup-age">no reply</span>
        <button className="ghost" onClick={() => onFollowupReply(j)}>Reply</button>
        <button className="ghost" onClick={() => onFollowupDismiss(j)}>Dismiss</button>
      </div>
    ))}
  </div>
)}
```

App handlers: Reply → `setView({ name: 'composing', replyTo: /* fetch latest own message of thread via fetchThread(j.payload.threadId) last item */ })` then `cancelJob(j.id)`; Dismiss → `cancelJob(j.id)` and drop from state.

CSS:

```css
.followups { border-bottom: 1px solid var(--line); padding: 0.35rem 0 0.6rem; }
.followup-row {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.35rem 0.75rem; font-size: 0.9rem;
}
.followup-who { font-weight: 600; }
.followup-subject { color: var(--muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.followup-age { color: var(--accent); font-size: 0.8rem; }
```

- [ ] **Step 4: Verify end-to-end** — send yourself a mail with "Nudge me in 1 day", set the job's `fire_at = 0` in local D1, run the cron: because *you* replied to nothing, the thread has only your message → job flips to `needs-followup` → reload Slip → Follow up group shows; reply from the other account and re-run → job resolves silently.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: follow-up nudges — remind-me on send, cron check, follow-up group"`

---

### Task 11: Palette + docs integration

**Files:**
- Modify: `src/App.tsx` (palette commands for snooze/send-later/sections), `README.md`

- [ ] **Step 1: Add backend-gated commands to the ⌘K palette list** (palette itself ships separately, client-only): `Snooze… (S)` → `setSnoozeTarget(current)`; `Go to Snoozed`, `Go to Scheduled` → `navigate(...)`; inside composing view the palette is closed, so no send-later command needed there.

- [ ] **Step 2: README** — extend the Deploying section:

````markdown
### Backend (snooze, send later, follow-up nudges)

```sh
cd server
npm install
npx wrangler d1 create slip-db          # paste database_id into wrangler.toml
npm run db:remote                        # apply schema
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET   # OAuth client must be Web application type
npx wrangler secret put SESSION_SECRET         # long random string
npx wrangler secret put TOKEN_KEY              # openssl rand -base64 32
npm run deploy
```

Then build the app with `VITE_API_URL=https://slip-api.<your>.workers.dev` and set
`ALLOWED_ORIGIN` in wrangler.toml to your app origin. Google console: the same
OAuth client needs your app origin under Authorized JavaScript origins (code flow
in popup mode still uses no redirect URI).
````

- [ ] **Step 3: Verify** — `npm test && npm run build && cd server && npm test && npx tsc --noEmit`.

- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat: palette commands for time features + backend deploy docs"`

---

## Self-review notes

- Spec coverage: snooze (Task 8), nudges (Task 10), send later (Task 9), auth/backend (Tasks 2–7), palette integration (Task 11). Palette itself is out of scope here (shipped client-side separately).
- Types referenced across tasks: `SnoozePayload`/`NudgePayload`/`SendPayload` defined in Task 5 (`server/src/lib/jobs.ts`) — the client mirrors these shapes inline via `createJob` payloads; `Job` defined in Task 7 `src/lib/backend.ts`; `WhenOption`/`snoozePresets`/`sendLaterPresets`/`formatWhen` in Task 8 `src/lib/when.ts`; `reconnect`/`API_URL`/`getSession` in Task 7 `src/lib/gmail.ts`; `runDueJobs`/`threadHasReply` in Task 6 `server/src/cron.ts`.
- Known v1 limits (intentional): no attachments on scheduled sends; canceling a scheduled send does not resurrect a draft; nudge "Reply" fetches the thread to build the reply context; Worker imports `../../src/lib/mime` (wrangler bundles across the repo root fine — `mime.ts` must stay DOM-free, enforced by Task 1).
