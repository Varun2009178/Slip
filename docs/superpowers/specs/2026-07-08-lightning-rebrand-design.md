# Lightning rebrand + sign-in transition

Date: 2026-07-08

> **Superseded same day:** after seeing the bolt, the user chose to keep the
> original envelope logo and its animations. The bolt rebrand (sections on
> favicon/BoltMark/BoltAnimation) was reverted; what shipped is the envelope
> brand everywhere plus the **sign-in → interface transition** below, with the
> overlay playing the envelope slip animation instead of a bolt. The unused
> `public/icons.svg` sprite stayed deleted and the production OAuth docs stayed.

## Goal

Three changes requested together:

1. The brand logo becomes a **purple lightning bolt**, kept in `public/favicon.svg`.
   Every other brand mark (envelope favicon, envelope `SlipMark` in the sidebar,
   envelope-and-slip animation on the front page, unused `public/icons.svg` social
   sprite) is replaced by or removed in favor of the bolt.
2. After a successful **Connect Gmail**, an animation (same spirit as the front-page
   logo animation) transitions the user into the main interface instead of an
   instant swap.
3. Document what Google Cloud OAuth settings are needed for a production deploy
   (Authorized JavaScript origins; no redirect URIs needed for the GIS token flow).

Note: the request said "favicon.svg is the logo (purple lightning)" but the repo's
favicon.svg was still the old envelope, so the bolt artwork is created new. Purple
is `#aa3bff`, matching the accent purple already present in the old icons.svg.

## Design

### Logo assets

- `public/favicon.svg` — filled purple bolt, 96×96 viewBox, rounded joins
  (same-color stroke with `stroke-linejoin="round"`).
- `src/components/icons.tsx` — `SlipMark` is replaced by `BoltMark`: the same bolt
  path scaled to the 16×16 icon grid, filled `#aa3bff` (brand color is constant
  across themes). Sidebar import updated.
- `src/components/Connect.tsx` — `SlipAnimation` (envelope + rising slip) becomes
  `BoltAnimation`: the bolt drops in with a small overshoot bounce and a soft
  radial glow flash behind it. Existing text choreography (fade-up sentence, CTA)
  is unchanged.
- `public/icons.svg` — deleted; it is referenced nowhere.

### Sign-in transition

- `App.tsx` gains an `entering` boolean. `handleConnect` sets it after the inbox
  loads and clears it via timeout (~1s).
- While `entering`, the shell renders normally underneath a fixed, pointer-events:
  none `.enter-overlay` (background `var(--bg)`) with a large bolt centered. The
  bolt pops and zooms out while the overlay fades, revealing the interface; the
  sidebar and pane also fade-up slightly for continuity.
- Only the explicit connect path triggers it (there is no persisted token, so
  every session goes through Connect anyway).
- `prefers-reduced-motion` disables all of it (overlay hidden immediately).

### Production OAuth docs

- README gains a "Deploying" section: add the production origin (scheme + host,
  no path) to **Authorized JavaScript origins**; redirect URIs are not used by the
  GIS token (popup) flow; set `VITE_GOOGLE_CLIENT_ID` at build time; note that the
  Gmail scopes are restricted, so a public (published) consent screen requires
  Google verification — Testing mode with ≤100 test users avoids that.

## Testing

Existing unit tests must keep passing (`npm test`); `npm run build` and lint clean.
Visual behavior verified by driving the app.
