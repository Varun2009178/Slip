# Slip outreach flow — design

**Date:** 2026-07-13
**Status:** approved by Varun (conversation, 2026-07-13)

## What Slip is now

Slip is a free, open-source tool for sending personalized cold emails to a list of
people, one at a time, from your own Gmail — without the CRM. The existing minimal
email client (inbox, reader, composer) stays as the shell; the outreach flow is the
product and the thing the beta is judged on.

Success metric for the beta: someone imports a list and sends a batch.

## Decisions already made

- **App shape:** outreach-first. After connecting Gmail, the landing view is
  campaigns home. The inbox stays reachable (needed to read replies) but secondary.
- **List input:** paste from Google Sheets (tab-separated, first row = headers)
  plus a manual Notion-style row editor. No CSV file upload in v1.
- **Send pacing:** automatic random 45–120 s gap between sends. No user knobs.
  Sends run from the open tab (no backend); the UI says so plainly.
- **Auth model:** one shared OAuth client baked in at build time
  (`VITE_GOOGLE_CLIENT_ID`), consent screen in Testing status, beta users added
  manually as test users (waitlist → console). Already implemented.

## User flow

Campaigns home → new batch → four steps, back/forward freely, autosaved:

1. **People.** Notion-style editable table styled like the rest of the site.
   Columns: `email` (required) plus arbitrary others (`name`, `paper`, `lab`, …).
   Fill by pasting a Sheets selection (TSV; first row becomes headers unless it
   looks like data, i.e. contains a valid email) or by typing rows manually.
   Add/remove rows and columns inline. Invalid emails are flagged on the row.
2. **Write.** Subject + body templates. `{{variable}}` placeholders matching
   column names; a chip row lists available columns for insertion. Validation
   before proceeding: unknown variables and rows with empty values for used
   variables are warnings shown per-row/per-variable.
3. **Preview.** Every recipient listed; click one to see the fully rendered
   email. Any single email is editable; the edit is stored as a per-recipient
   override and badged "edited". Re-editing the shared template does not clobber
   overrides. Nothing sends from this screen.
4. **Send & track.** Banner: sending one every 1–2 minutes, keep this tab open.
   Live per-recipient status: queued → sending → sent | failed (failed rows get
   a retry button). Pause/resume anytime. After sending, the same screen is the
   tracking view: sent rows flip to **replied** when their Gmail thread contains
   a message from an address that isn't the sender's. Reply check runs when the
   view opens and every 60 s while it stays open.

## Architecture

New code lives beside the existing patterns; no backend, no new dependencies.

### Data model (`src/lib/outreach.ts` + `src/lib/types.ts`)

```ts
interface Recipient {
  id: string;                        // stable, generated at row creation
  fields: Record<string, string>;    // keyed by column name; 'email' required
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'replied';
  messageId?: string;                // from messages.send response
  threadId?: string;
  sentAt?: string;                   // ISO 8601
  error?: string;                    // last failure, user-visible
  override?: { subject: string; body: string }; // per-recipient edit from Preview
}

interface Campaign {
  id: string;
  name: string;                      // defaults to first send date / editable
  createdAt: string;
  columns: string[];                 // ordered; always includes 'email'
  subjectTemplate: string;
  bodyTemplate: string;              // plain text with {{vars}} (v1: plain text)
  recipients: Recipient[];
  state: 'draft' | 'sending' | 'paused' | 'done';
}
```

Persistence: localStorage key `slip-campaigns` (JSON array), written after every
mutation, including after each individual send. Same try/catch tolerance as the
existing `slip-has-access` handling.

### Pure logic (test-first, vitest, same style as existing `lib/*.test.ts`)

- `parsePasted(text: string): { columns: string[]; rows: Record<string, string>[] }`
  — TSV from a Sheets paste. First row becomes headers unless any cell in it is a
  valid email address (then columns are auto-named and the row is data).
- `renderTemplate(tpl: string, fields: Record<string, string>): string`
  — `{{name}}` substitution, whitespace-tolerant (`{{ name }}`).
- `templateVars(tpl: string): string[]` — variables referenced by a template.
- `validateCampaign(c): Issue[]` — unknown variables, invalid emails, empty
  values for used variables; each issue names the row/variable.
- `hasReply(threadMessages: Email[], selfEmail: string): boolean` — true when
  any message's `fromEmail` differs from `selfEmail` (case-insensitive).
- `nextSendDelayMs(): number` — uniform random in [45_000, 120_000].

### Gmail additions (`src/lib/gmail.ts`)

- `sendEmail` gains a return value: `{ id, threadId }` from the API response
  (currently discarded).
- `fetchSelfEmail(): Promise<string>` — GET `/gmail/v1/users/me/profile`,
  returns `emailAddress`. Covered by existing gmail scopes.

### Send runner (`src/hooks/useCampaignSender.ts` or colocated in App)

While a campaign is `sending` and the tab is open: take the first `queued`
recipient, mark `sending`, call `sendEmail` with the rendered (or overridden)
subject/body, record `messageId`/`threadId`/`sentAt`, mark `sent`, persist, then
wait `nextSendDelayMs()` and repeat. Rules:

- **Failure:** mark `failed` with the error; continue to the next recipient.
- **401 (token expired — likely mid-run, tokens last ~1 h):** set campaign to
  `paused`, surface a "reconnect gmail" button that re-runs `connect()` and
  resumes. State was persisted after the last completed send, so no loss and no
  double-send.
- **Tab close/refresh:** `beforeunload` warning while `sending`; on reload a
  `sending` campaign is shown as `paused` with a resume button.
- **Done:** when no `queued` recipients remain, state becomes `done`.

### Components (`src/components/`)

- `Campaigns.tsx` — home: campaign list with state badges, "new batch".
- `RecipientTable.tsx` — the Notion-style table (People step). Owns paste
  handling, inline cell editing, add/remove row/column, per-row email validation.
- `TemplateStep.tsx` — subject + body inputs, variable chips, validation panel.
- `PreviewStep.tsx` — recipient list + rendered email pane, per-recipient edit.
- `SendStep.tsx` — banner, live status list, pause/resume/retry, reply tracking.

App wiring: new view states in the existing `view` union; post-connect landing
becomes campaigns home; sidebar gets a campaigns entry (and keeps inbox).

## Error handling summary

| Failure | Behavior |
|---|---|
| Send fails (4xx/5xx after retries) | Row marked failed with message, batch continues, retry button |
| Token expires mid-run | Campaign auto-pauses, one-click reconnect + resume |
| Tab closed mid-run | Campaign paused on next open; resume button |
| localStorage full/blocked | Campaign works in-memory for the session; banner warns state won't survive refresh |
| Reply check fails | Silent; retried on next 60 s tick (status just stays stale) |

## Testing

- Pure functions above: full vitest coverage, written test-first.
- `hasReply`, `parsePasted`, `validateCampaign` carry the correctness burden.
- Send runner: logic factored so ordering/pause/resume decisions are testable
  without timers where practical; timer integration verified manually.
- End-to-end: manual run against a real Gmail account before Varun's live
  cold-research batch (send a 2–3 recipient campaign to self-controlled inboxes).

## Explicitly out of scope (v1)

- Open/click tracking (needs a pixel server; also contrary to the product's ethos)
- Follow-up sequences and scheduled follow-ups
- CSV file upload
- Multiple campaigns sending simultaneously (one `sending` campaign at a time)
- Rich text / HTML templates (plain text is the right default for cold email)
- Any backend or server-side sending
