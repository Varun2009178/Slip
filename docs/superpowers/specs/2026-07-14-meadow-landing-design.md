# Meadow landing page — design

**Date:** 2026-07-14
**Status:** direction approved by Varun (palette: paper & ink + one accent; video: card below hero)

## Goal

Replace the current landing hero with a "plains field" scene — grass, flowers,
trees — that works as a serious SaaS homepage. No logo in the hero. Vibe
references: make.design-style beautiful background, cursor/linear simplicity.

## Visual language

- **Paper & ink:** the entire scene is drawn in Slip's existing brand style —
  white fills, `#1d1c1a` ink strokes (~2.5px), on the paper background — the
  same language as the envelope `SlipAnimation`.
- **One accent:** wildflower heads only, muted poppy `#d4553f` (two lighter/
  darker siblings allowed for variety). Nothing else gets color.
- **Composition:** clear sky (plain paper, a few outlined drifting clouds)
  occupies the top ~60% of the viewport; layered line-art hills fill the
  bottom, with tree silhouettes on the horizon, grass tufts along hill edges,
  and many scattered flowers (the user asked for "a lot").
- **Motion:** slow cloud drift; gentle sway on flowers/grass (long-duration
  CSS transforms, origin at stem base). All motion disabled under
  `prefers-reduced-motion`.

## Layout

- **Nav:** unchanged structurally (slip wordmark, features / what's coming /
  github, sign in), transparent over the sky.
- **Hero:** copy centered in the sky area — headline "a super fast cold email
  inbox." + sub "send personalized batches from your own gmail. track and
  reply — without switching tabs." + the existing waitlist form (or the
  Connect Gmail button for the connect gate). No SlipAnimation, no logo.
  The stale "email at the speed of thought / most minimal email" copy in
  `Waitlist.tsx` is replaced by this positioning.
- **Demo video:** moves out of the hero row onto a floating card below —
  ink-stroke border, soft shadow — overlapping the meadow's top edge like a
  billboard standing in the field. Scrolls into view.
- **Below:** Showcase and Roadmap sections unchanged, on the normal paper
  background.

## Implementation shape

- New component `src/components/FrontScene.tsx`: one inline SVG (viewBox-based,
  `preserveAspectRatio="xMidYMax slice"`) rendering hills, trees, grass,
  flowers, clouds; deterministic hand-placed elements (no runtime randomness,
  so it never shifts between visits). Positioned absolutely behind the hero.
- CSS appended to `src/styles.css` (`.front-scene`, `.hero-sky`, `.video-card`,
  sway/drift keyframes, reduced-motion guard).
- `App.tsx` front-page block: scene mounts behind the hero for both gates
  (waitlist + connect); video element moves from `Waitlist.tsx` into the
  shared front layout so both gates show it.
- No new dependencies, no external assets. Works from 360px phones (scene
  crops from the sides via `slice`; copy stays centered) to wide desktops.

## Out of scope

- The in-app UI (post-connect) is untouched.
- Showcase/Roadmap redesign.
- Dark mode.

## Acceptance

Screenshot review by Varun at desktop and phone widths; copy legible over the
scene at both; lint/tests/build stay green.
