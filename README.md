# Mail

A tiny, minimal email client prototype. Mock data, real Claude rewrites.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
```

## What it does

- **Inbox** — one flat list. Unread is bold, important is pinned. Nothing else.
- **Reading** — one email at a time, threads collapsed until you ask.
- **Composer** — a big writing surface. `⌘Enter` sends (simulated). The
  Rewrite bar (Shorter / More formal / Blunter) calls Claude on your draft —
  or just the selected text. First use asks for an Anthropic API key, kept in
  localStorage.
- **Done** — press `E` and the email fades away. No archive, no folders.

## Keys

`↑↓` navigate · `Enter` open · `E` done · `C` compose · `R` reply · `Esc` back · `⌘Enter` send
