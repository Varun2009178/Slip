# Mail

A tiny, minimal email client for your real Gmail. Browser-only — no server.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
```

## One-time Gmail setup (~5 min)

The app talks to Gmail directly from your browser, so it needs your own free
OAuth Client ID:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (any name).
2. **APIs & Services → Library** → enable **Gmail API**.
3. **APIs & Services → OAuth consent screen** → External → fill in app name +
   your email → under **Test users**, add your own Gmail address.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   Web application → add `http://localhost:5173` to **Authorized JavaScript
   origins**.
5. Copy the Client ID and paste it into the app's first screen.

Then click **Connect Gmail** and sign in with the Google popup. The Client ID
is kept in localStorage; the access token lives only in memory, so you'll
re-do the (instant) popup after a reload or about an hour.

## What it does

- **Inbox** — your newest 25 inbox messages in one flat list. Unread is bold;
  **starred is pinned** to the top. Nothing else.
- **Reading** — one email at a time; opening marks it read in Gmail; earlier
  thread messages stay collapsed until you ask.
- **Composer** — a big rich-text surface: bold/italic/underline/strike,
  headings, quotes, lists, links, any text + highlight color, font family and
  size. What you see is what's sent (HTML email with a plain-text fallback).
  `⌘Enter` really sends. Replies thread onto the original conversation.
  **+ Add images** attaches pictures (up to ~4 MB total).
- **Drafts** — `⌘S` in the composer saves to Gmail drafts. The **Drafts**
  section (header link) lists them; open one to resume it, `E` deletes it, and
  sending a resumed draft cleans it up from Gmail automatically.
- **Done** — press `E` and the email fades away (archived in Gmail terms).
  The toast offers **Undo** for a few seconds, and everything you've dismissed
  lives in the **Read** section (header link), where `E` restores it to the
  inbox.
- **Colorways** — the ●/○ button in the header flips between the plain theme
  and a warm paper one; your choice is remembered.

## Keys

`↑↓` navigate · `Enter` open · `E` done · `C` compose · `R` reply · `Esc` back · `⌘Enter` send · `⌘S` save draft
