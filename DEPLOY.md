# Running Slip in production

Slip is a static SPA — `npm run build` produces `dist/`, host it anywhere
(Vercel / Netlify / Cloudflare Pages). Point `www.slip.email` at it.

## 1. Google Cloud (one time)

1. [console.cloud.google.com](https://console.cloud.google.com) → create a project.
2. **APIs & Services → Library** → enable **Gmail API**.
3. **APIs & Services → OAuth consent screen** → External → app name + support
   email. While the app is in **Testing**, only the test users you list
   (max 100) can sign in — add yourself and your beta users there.
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - **Authorized JavaScript origins**: `https://www.slip.email` and
     `http://localhost:5173` (dev). Scheme + host only — no path, no trailing
     slash.
   - **Authorized redirect URIs**: leave empty. Slip uses the Google Identity
     Services *token* (popup) flow, which never redirects.
5. Copy the Client ID.

## 2. Build & deploy

```sh
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com npm run build
```

Setting the client ID at build time makes visitors skip the paste-a-client-ID
screen (a locally saved ID still overrides it). Deploy `dist/` and set the same
env var in your host's build settings so every deploy gets it.

`/privacy` and `/tos` are client-side routes — configure the host to rewrite
every path to `index.html` (Netlify: `_redirects` with `/* /index.html 200`;
Vercel: a catch-all rewrite in `vercel.json`; Cloudflare Pages: automatic for
single-page apps).

## 3. Going public

The Gmail scopes Slip uses (`gmail.modify`, `gmail.send`) are **restricted
scopes**. Publishing the consent screen to Production — required for anyone
beyond your test users — triggers Google's app verification: privacy policy,
domain verification, and a paid third-party (CASA) security assessment. Until
then, Testing mode with listed test users is the way to run it.

## 4. Time-based features (planned)

Snooze, follow-up nudges, and scheduled send need a small backend (Cloudflare
Worker + D1). The full build plan lives at
`docs/superpowers/plans/2026-07-09-backend-time-features.md`; deploy steps for
the Worker are in that plan's final task.
