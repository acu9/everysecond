# Every Second

**English** · [简体中文](README.zh-CN.md)

An interactive photographic archive for a personal photography portfolio, recreating the
AFP × Gobelins [Every Second](https://www.behance.net/gallery/80083153/Every-Second)
experience.

Photographs stack into an isometric ribbon running from bottom-left to top-right. You scroll
along it, fan it open under the cursor, and open a single frame to fill the screen.

## Features

- **Three modes, one geometry** — the packed overview (ribbon), the spread-out browse state
  and the single opened photograph (detail) are the same isometric stack at different
  spacing, and ease continuously into one another.
- **No framework, no 3D library** — the ribbon is plain CSS 3D transforms, with all easing
  owned by a single `requestAnimationFrame` loop.
- **Hover fan-out** — photographs near the cursor part locally while the rest of the band
  simply shifts, so it never stretches along its whole length.
- **Momentum scrolling**, arrow-key stepping and filtering by series.
- **Time marks along the band** — the ribbon is a timeline, so it carries dated ticks. The
  granularity is derived, not fixed: years, months, weeks, days or hours, whichever fits the
  span of the photographs currently on the band.
- **Saving and sharing** — keep a photograph in your collection (held in the browser), or copy
  a link that opens the archive on that one frame.
- **A collection page** — the whole archive as a contact sheet, filterable by series and by
  what you have kept.
- **A `?` panel** — every way through the archive, written down in one place.
- **Touch support** — drags are projected onto the band's own axis; flicks glide in browse,
  and swipes step between photographs in detail.
- **A phone layout** — the stamp and the wordmark take opposite corners, and the series list
  becomes a row along the bottom.
- **A pooled shadow under each stack** — two gradients stretched along the axis rather than a
  shadow on each of two hundred frames, which is the cost the rendering budget cannot carry.
- **Resolution on demand** — the band uses 240w thumbnails; the 1400w variant is swapped in
  only when a photograph is opened.

## Controls

| Input | Overview | Browse | Detail |
| --- | --- | --- | --- |
| Move the mouse | Fan the band open under the cursor | — | — |
| Wheel | Move the focus along the band | Scroll the band | Previous / next photograph |
| Click | Browse from the photograph the fan brought forward | Select a photograph; click again to open | Click the open photo to close; click a neighbour to switch |
| Click empty space | — | Back to the overview | Back to the overview |
| `←` `↓` / `→` `↑` | Previous / next | Previous / next | Previous / next |
| `Space` | Enter browse | Open the photograph | Close the photograph |
| `Esc` | — | Back to the overview | Back to browse |
| `s` | Save the photograph you are reading | Same | Same |
| `?` | Open the shortcuts panel | Same | Same |
| Touch drag | Fan | Drag the band, flick to glide | Swipe to step |

In the toolbar, bottom right: `collection` opens the contact sheet, the bookmark keeps the
photograph you are reading, and share copies a link to it — or hands it to the phone's own
share sheet. In detail, `read more` opens the rest of the record beneath the photograph and
`save this picture` is the same bookmark in words.

## Tech stack

- [Astro](https://astro.build) 5 + TypeScript
- [sharp](https://sharp.pixelplumbing.com), used by Astro's image pipeline for sized variants
- ESLint (`@antfu/eslint-config`)
- pnpm

## Getting started

Requires Node.js and pnpm (see the `packageManager` field in `package.json`).

```bash
pnpm install
pnpm dev        # dev server at http://localhost:4321
```

## Commands

```bash
pnpm dev        # dev server on :4321
pnpm check      # astro check — types across .astro and .ts
pnpm lint       # eslint; pnpm lint:fix to autofix
pnpm build      # astro check + build; emits ~400 image variants, ~25s cold
pnpm preview    # serve dist/
pnpm manifest   # regenerate src/data/photos.json from src/assets/photos/
```

There is no test suite — verify changes by driving the running app in a browser.

## Adding or changing photographs

1. Drop `.webp` files into `src/assets/photos/`.
   They must live under `src/assets` (not `public/`) so Astro can emit sized variants.
2. Run `pnpm manifest` to regenerate the manifest.

`scripts/generate-manifest.mjs` parses WebP headers directly for real dimensions, and
synthesises capture time, location, EXIF and series tags seeded off each filename — so
regenerating never reshuffles the gallery.

> **Note:** that metadata is **placeholder**. Replace the generator's synthesis step with real
> EXIF once actual photographs arrive. `src/data/photos.json` is generated — edit the script,
> not the JSON.

## Project structure

```
scripts/
  generate-manifest.mjs   photo manifest generator
src/
  assets/photos/          source photographs (.webp)
  components/
    Ribbon.astro          ribbon markup and the entire interaction controller
    Stamp.astro           capture date and time, top-left
    Caption.astro         place, camera, the full record and the actions in detail
    TagPanel.astro        series filter
    TimeAxis.astro        dated ticks along the band (filled in by the controller)
    SwipeHint.astro       touch swipe hint
    Shortcuts.astro       the `?` panel
    Brandmark.astro       centred wordmark
    Toolbar.astro         toolbar
  data/                   photo manifest and types
  layouts/                page layout
  lib/
    ribbon.ts             ribbon geometry and time marks (pure functions, no DOM)
    collection.ts         saved photographs (localStorage, synced across tabs)
  pages/
    index.astro           the gallery
    collection.astro      contact sheet and saved frames
  styles/                 reset and design tokens
```

For the architecture in depth — and the rendering limits the implementation works around —
see [CLAUDE.md](CLAUDE.md).

## Status

**Working:** ribbon rendering, hover fan, momentum scroll, browse, detail with full-resolution
swap, arrow stepping, Escape, series filtering, caption metadata, touch dragging,
swipe-to-step and its hint — and, since the first pass: `read more`, saving, sharing and
permalinks, the collection page, the `?` panel, the time marks along the band, the phone
layout, and the pooled shadow under each stack.

**Still open:**

- The manifest's capture times, locations, EXIF and series are **synthesised from filenames**.
  Replace the synthesis step in `scripts/generate-manifest.mjs` with real EXIF when real
  photographs arrive (see *Adding or changing photographs* above).
- What reflows on a phone is the chrome. The band's own spacing is still tuned for a desktop
  viewport: the overview fits itself to the screen, but browse and detail use fixed gaps.
- A saved collection lives in the browser's own storage. There is no account behind it, so it
  does not follow the viewer to another device.

## Credits

- Art direction and interaction after AFP × Gobelins'
  [Every Second](https://www.behance.net/gallery/80083153/Every-Second)
- Implementation approach follows
  [radishzzz/stack-gallery](https://github.com/radishzzz/stack-gallery)
