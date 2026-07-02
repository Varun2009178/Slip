# Tiny Email Client — Design

**Date:** 2026-07-01
**Status:** v1 approved by proxy; v2 (below) approved by user.

## v2 — Real Gmail, no AI, second colorway (user-approved 2026-07-01)

1. **Remove AI entirely** — delete `lib/ai.ts` + tests, the Rewrite bar, the
   API-key prompt, and the `@anthropic-ai/sdk` dependency.
2. **Real Gmail, browser-only** (user confirmed the one-time Google Cloud
   OAuth Client ID setup):
   - `lib/gmail.ts`: Google Identity Services token popup + Gmail REST API.
   - Client ID pasted once (localStorage). Access token in memory only —
     Google popup re-appears after reload/expiry (instant when signed in).
   - Inbox = newest 25 INBOX messages. Bold = Gmail `UNREAD`.
     Pinned = `STARRED` (deliberate, unlike Gmail's auto-IMPORTANT).
   - Open → removes `UNREAD` in Gmail; thread fetched, earlier messages collapsed.
   - `E` = archive (remove `INBOX` label) — the Gmail-honest "done".
   - `⌘Enter` sends for real (RFC 2822 MIME → `messages.send`); replies thread
     via `threadId` + `In-Reply-To`/`References`.
   - Mock data and the localStorage read/done store are deleted — Gmail is the
     source of truth.
   - Scopes: `gmail.modify` + `gmail.send`.
3. **Warm paper colorway** — cream background, ink-brown text, terracotta
   accent. Toggle in the inbox header, persisted, applied via
   `data-theme="paper"` on `<html>`.

Testing: pure Gmail plumbing is unit-tested (sender parsing, MIME body
extraction incl. base64url + HTML fallback, outbound MIME building, RFC 2047
subject encoding). OAuth/network paths are verified manually by the user —
they require real Google credentials.

---

## v3 — Proper formatting, wider layout, sender logos (user-requested 2026-07-01)

1. **HTML email rendering** — `extractBodies()` returns both the plain-text and
   the raw HTML part. When HTML exists, the reader renders it in a sandboxed
   `<iframe srcdoc>` (`allow-same-origin allow-popups`, **no scripts**) with a
   small injected stylesheet (margins, responsive images) and
   `<base target="_blank">`. Height auto-fits the content. Plain-text emails
   render as before. Applies to thread messages too.
2. **Wider layout** — `.app` max-width 680px → 960px; inbox grid rebalanced.
3. **Sender logos** — inbox rows and the reader show a small round avatar:
   the sender domain's favicon (Google s2 favicon service), falling back to a
   letter initial when the image fails. Starred marker moves to a small ★ by
   the date.

## v1 (original)

## Purpose

A tiny, minimal email client prototype. The composer is the centerpiece: a doc-like
writing surface with inline Claude AI rewrites. Everything else (inbox, reading,
"Done") exists to make the composer feel real. Guiding constraint from the spec:
**"If you add more than this, you'll ruin it."**

## Scope — exactly four features

1. **Inbox** — a single flat list of emails. No categories, no tabs.
   - Unread = bold.
   - Important = pinned to the top (subtle marker, no loud colors).
2. **Reading view** — one email at a time, clean typography.
   - Threads collapsed by default: older messages shown as "N earlier messages",
     expand on click.
3. **Composer** — the whole point.
   - Big writing area, like a doc, not a tiny box. To/Subject as quiet fields above.
   - `Cmd+Enter` sends (simulated: confirmation, return to inbox).
   - Inline AI via Claude: **Shorter**, **More formal**, **Blunter** — rewrite the
     selection (or the whole draft if nothing is selected).
4. **"Done" system** — instead of archive.
   - Press `E` (in list or reading view) → email fades away (CSS transition) and is
     removed. No undo, no archive folder. Clearing your brain.

Explicit non-features: search, folders, labels, undo, attachments, real sending,
settings screens, onboarding.

## Decisions made in the user's absence

| Decision | Choice | Why |
|---|---|---|
| Data source | Mock data, simulated send | Spec says "(or simulate send)"; real Gmail would triple the project |
| Stack | Vite + React + TypeScript, one plain CSS file, no UI libraries | Small, standard, fast to run; plain CSS matches "purely simple" |
| AI backend | Anthropic API directly from the browser (CORS-enabled with the direct-browser-access header); API key pasted once and kept in localStorage | No server needed = stays tiny. Missing key → the AI buttons ask for one inline |
| Persistence | read/done state in localStorage | "Done" feels real across reloads; trivially resettable |

## Architecture

```
src/
  main.tsx          entry
  App.tsx           view state machine: inbox | reading | composing
  data/emails.ts    mock emails + threads (typed)
  lib/store.ts      load/save read+done state (localStorage)
  lib/ai.ts         Claude rewrite calls (shorter / formal / blunt)
  components/
    Inbox.tsx       list, pinned-first sort, unread bold, E-to-done
    Reader.tsx      single email, collapsed thread, E-to-done
    Composer.tsx    doc-like editor, Cmd+Enter, AI toolbar
  styles.css        the entire design system
```

- **Data model:** `Email { id, from, to, subject, body, date, unread, important, thread: Message[] }`. `done` and `read` ids live in localStorage, merged at load.
- **State:** plain `useState` in `App` — a view enum plus the email list. No router, no state library.
- **AI:** `lib/ai.ts` exposes `rewrite(text, mode)`. Uses `claude-opus-4-8` (the current default Claude model) via the official `@anthropic-ai/sdk` with browser access enabled, and a strict "return only the rewritten text" system prompt. Errors surface as a quiet inline message, never a modal.
- **Keyboard:** `E` = done, `C` = compose, `Esc` = back, `Cmd+Enter` = send, `↑/↓` = move selection in inbox, `Enter` = open.

## Visual language

Near-white background, near-black text, one system font stack, generous whitespace,
no logos, no color except a single muted accent for the unread dot and pinned
marker. Fades and motion kept under 250ms.

## Error handling

- No API key → AI buttons reveal a one-line inline key input.
- API failure → inline "Couldn't rewrite — try again" text; draft never touched.
- localStorage unavailable → app still works, state just doesn't persist.

## Testing

- Vitest unit tests for the pure logic: inbox sort (pinned-first), done/read store
  round-trip, and the AI prompt construction / response unwrapping (API mocked).
- UI verified by running the app end-to-end (manual/scripted drive), not snapshot tests —
  the UI is small and changes fast; testing pinned-sort logic beats testing markup.
