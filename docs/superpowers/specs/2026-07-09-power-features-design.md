# Slip power features: ⌘K palette + time-based features (backend)

Date: 2026-07-09. Approved by user (platform: Cloudflare Worker + D1).

## Goal

Four features:

1. **⌘K command palette** — fuzzy-searchable overlay for every action; completes the
   existing keyboard layer (j/k, e, r, c already work). **Client-only — built now.**
2. **Snooze** — "not now, come back Tuesday": archive an email and have it return to
   the inbox at a chosen time, even if Slip is closed.
3. **Follow-up nudges** — "remind me if no reply in 3 days" on sent mail; if the
   thread is still silent at the deadline, it surfaces in a pinned Follow-up group.
4. **Send later** — schedule a send for a future time; it sends even if the tab is
   closed (v1: no attachments on scheduled sends).

Features 2–4 need actions to fire while the user is offline → **tiny backend**:
Cloudflare Worker + D1 (SQLite) + a 1-minute cron trigger. See the implementation
plan at `docs/superpowers/plans/2026-07-09-backend-time-features.md`.

## Architecture

- **Auth switches to the authorization-code flow** when a backend URL is configured
  (`VITE_API_URL`). The Worker exchanges the code, stores the Gmail **refresh token
  encrypted (AES-GCM)** in D1, and returns a 30-day session JWT plus a short-lived
  access token. The client still calls Gmail directly for everything interactive;
  the Worker acts only for time-based jobs. With a stored session the app
  reconnects silently on load (no popup). Without `VITE_API_URL` the current
  client-only token flow keeps working (time features hidden).
- **One `jobs` table drives all three features**: `(id, user_id, type
  send|snooze|nudge, fire_at, status pending|done|needs-followup|canceled|failed,
  payload JSON)`. Cron each minute executes due jobs with a refreshed access token:
  - `send` → build MIME (shared `src/lib/mime.ts`) → Gmail send.
  - `snooze` → add INBOX + UNREAD labels back (client archived it at snooze time).
  - `nudge` → fetch thread metadata; a message from someone else after the tracked
    send resolves the job silently; otherwise status `needs-followup`.
- **Client UI**: `s`-key/palette snooze picker (Later today / Tomorrow 8am /
  Weekend / Next week); Snoozed sidebar section (pending snooze jobs, unsnooze);
  composer "Remind me if no reply" (1/3/7 days) and "Send later" picker; Scheduled
  sidebar section with cancel; Follow-up group pinned atop the inbox with
  Reply/Dismiss.

## Constraints & caveats

- Storing refresh tokens server-side + restricted Gmail scopes ⇒ Google app
  verification (incl. CASA) required before opening to the public; Testing mode
  (≤100 users) until then.
- Scheduled-send payloads live in a D1 row → attachments excluded in v1.
- Secrets needed at deploy: Google client ID + secret, session-JWT secret,
  32-byte token-encryption key.

## Testing

Pure logic (JWT, AES-GCM roundtrip, job validation, nudge thread resolution,
snooze/send-later preset times, palette fuzzy filter) unit-tested with vitest.
End-to-end verified by driving the app against `wrangler dev`.
