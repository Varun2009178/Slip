# Tiny Email Client — Design

**Date:** 2026-07-01
**Status:** Approved by proxy (user provided a detailed spec and was away during clarifying questions; decisions below follow the spec's explicit guidance, e.g. "send (or simulate send)").

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
