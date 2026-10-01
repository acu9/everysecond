# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An interactive photographic archive that recreates the AFP/Gobelins "Every Second"
experience (https://www.behance.net/gallery/80083153/Every-Second) for a personal
photography portfolio. Photographs stack into an isometric ribbon running bottom-left
to top-right; the viewer scrolls along it, fans it open under the cursor, and opens a
single frame to fill the screen.

Astro + TypeScript, **no framework and no 3D library** — the ribbon is CSS 3D
transforms driven by one requestAnimationFrame loop. Laid out for the desktop; touch
carries the same gestures rather than getting a layout of its own.
Approach follows the reference repo `radishzzz/stack-gallery` (its `drafts/archive`
page is the closest prior art).

## Commands

```bash
pnpm dev        # dev server on :4321
pnpm check      # astro check — types across .astro and .ts
pnpm lint       # eslint (@antfu/eslint-config); pnpm lint:fix to autofix
pnpm build      # astro check + build; emits 400 image variants, ~25s cold
pnpm preview    # serve dist/
pnpm manifest   # regenerate src/data/photos.json from src/assets/photos/
```

There is no test suite. Verify by driving the running app in a browser.

`sharp` is a direct dependency even though Astro pulls it in transitively: under
pnpm's strict layout the build output cannot resolve it otherwise. `package.json`
also has to allowlist its build script via `pnpm.onlyBuiltDependencies`.

## Adding or changing photographs

Drop `.webp` files into `src/assets/photos/`, then `pnpm manifest`. Files must live
under `src/assets` (not `public/`) so Astro's pipeline can emit sized variants.

`scripts/generate-manifest.mjs` parses WebP headers directly for real dimensions
(no dependency) and synthesises capture time, location, EXIF and series tags seeded
off each filename — so regenerating never reshuffles the gallery. That metadata is
**placeholder**: replace the generator's synthesis step with real EXIF when actual
photographs arrive. `src/data/photos.json` is generated; edit the script, not the JSON.

## Architecture

### One geometry, three modes

`src/lib/ribbon.ts` is pure functions, no DOM. Its central claim: the packed band,
the spread browse state and the fanned-open hover are **the same isometric stack at
different spacing**, not three separate effects.

Every photo sits on one diagonal axis. Its position is a scalar distance `u` along
that axis projected onto `AXIS`; everything that moves a photo — scroll, mode change,
fan-out — just contributes to `u`. `MODE_PARAMS` holds the spacing targets per mode
and is the first place to reach for when tuning feel.

Fan-out uses `tanh`, which saturates: photos near the cursor separate while everything
beyond simply shifts by a constant, so the band parts locally instead of the
displacement accumulating along its whole length.

`MODE_PARAMS.ribbon.gap` is a *preferred density*, not the value used. The controller's
`fittedRibbonGap()` derives the real one so the overview always reads as a contained
object: it shrinks the gap to keep the whole band inside the viewport, and widens it
for small sets so a filtered series of a dozen photographs spreads out instead of
collapsing into a clump. Collection size is not fixed, so this must stay derived.
Browse and detail keep their static gaps — they intentionally run off-screen.

That gap only fits while the band hangs from its own midpoint, so `bandCentre()`
is the other half of the same claim: entering `ribbon` eases `scrollTarget` back to
the middle, and filtering snaps it there. The two must move together — sizing the
band to the viewport but anchoring it on a photograph 180 frames along leaves it
hanging off the bottom-left corner, which is what the overview exists not to do.

`MODE_PARAMS.detail.groupGap` is a floor for the same reason: `detailGroupGap()`
derives the real push from the opened photograph's rendered box. The photograph is
the one thing on screen whose size the viewport decides, so a constant split that
looked generous on a laptop had the stacks overlapping the picture outright by
1920 wide. Both axes are checked — the band arrives on a 31° diagonal and the frame
is a 3:2 box, so the stacks come in almost exactly at the photograph's corner and
neither separation reliably dominates.

It follows that there is nothing to scroll *to* in the overview, so the wheel does
not scrub the band there; it walks `focusTarget` along it instead, and the fan, the
⊕ marker and the stamp are what report where you have got to. Shoving a band that
already fits only pushes one end of it off the corner. Browse scrolls, detail steps
photograph to photograph.

### The loop owns all easing

`src/components/Ribbon.astro` holds the markup and the entire controller. A single
rAF loop eases *parameters* (gap, groupGap, fanStrength, frameScale, scroll position,
hover, per-frame open amount) toward their targets and recomputes positions each
frame. It idles out when everything settles, and `wake()` restarts it.

This is deliberate and load-bearing: **do not add CSS transitions to anything the
loop writes every frame.** Mode changes, scroll momentum and fan-out have to share
one motion model, and a transition on a loop-driven property re-triggers itself
continuously across all 200 frames.

`openFrames` is a Map rather than a single reference because stepping through photos
in detail view leaves the outgoing one mid-flight — it eases back into the band while
its replacement opens. Entries are deleted once settled, which also clears the inline
transform; a stale entry leaves a photo stranded at detail size.

### Rendering budget

Roughly 200 transformed images are on screen simultaneously. Three limits are already
being worked around and should not be undone:

- **No `will-change: transform` on slots or frames.** Hinting 200 + 200 elements
  exceeds Chrome's compositing budget, and layers it declines to promote stop being
  rasterised entirely — the far half of the band paints as blank boxes. Only the one
  open frame carries the hint.
- **Thumbnails stay at 240w.** Decoded bitmap cost tracks pixel dimensions, not file
  size. At 480w the on-screen set was ~120MB of bitmap for images drawn ~100px wide,
  which again exceeded what Chrome would rasterise. The 1400w variant is swapped in
  only when a photo opens, and swapped back out on close.
- **Per-frame work must be proportional to what changed.** `--frame-scale` is written
  only when it actually moves; never toggle classes across all slots per frame.

`requestAnimationFrame` is suspended while a tab is hidden, so a queued frame never
arrives and `running` would stay stuck on. A `visibilitychange` handler resets it —
without that the gallery is frozen for good once the viewer returns from another tab.

### The time axis

The band is a timeline, so it carries dated ticks. `timeMarkers()` in `lib/ribbon.ts` is the
whole of the decision and is pure: it walks year → month → week → day → hour and keeps the
**finest** granularity whose boundaries still fit inside the tick budget. That has to be
derived rather than configured, for the same reason `fittedRibbonGap()` does — a collection
spanning years wants year marks, a series shot over one weekend wants hours, and filtering
turns one into the other while the page is open.

`TimeAxis.astro` is deliberately empty markup. The marks depend on the *filtered* list, so the
controller builds them, and only when that list changes — the loop then just moves what is
already there. They are positioned by `positionAt` with the same fan the photographs get: a
tick that stayed put while the band parted under it would be pointing at a different
photograph, which is the one thing a date on a timeline may not do. Shown in `ribbon` only:
that is the one mode where the whole band is on screen at a fitted spacing, so a run of dates
along it reads as a scale rather than as a caption on whatever is passing.

### The pooled shadow

Two elements, not two hundred. A shadow per frame is exactly the per-element cost the
rendering budget above cannot carry, and what the reference actually shows is one soft pool
under each block of prints. So `.pool` is a gradient stretched along the axis, and the seam
between the two is the one `positionAt` already cuts at `scrollPos` — which is what makes them
part with the stacks in detail and close back into one band in the overview.

Three things keep it cheap and keep it looking right:

- **Length is clamped to the viewport.** In browse the stacks run thousands of pixels off both
  corners; stretching a gradient across all of that hands the compositor a layer the size of
  the band rather than the size of the screen. `renderPools()` only pools the ranks within a
  viewport diagonal of the centre.
- **The end fades are a mask, not the gradient.** Each pool is soft at the end that runs out
  into nothing and nearly square at the end that meets its neighbour. Fading both ends pinches
  a bright notch into the middle of the overview, where the two halves are in fact one stack.
- **Ink follows spacing.** A dense stack pools; a row of separated photographs does not. The
  opacity is derived from `params.gap`, so it thins out on the way into browse by itself.

### Saving, sharing and the collection

`lib/collection.ts` holds the viewer's saved photographs in `localStorage`. Every access is
guarded: private browsing and blocked storage *throw* rather than returning null, so the
module keeps an in-memory copy as the authority and lets the write fail — the collection then
still works for the length of the visit. `storage` events fold in edits made in another tab.

The chrome acts on **the photograph being read** — whatever the stamp is showing — not on an
opened one, which is why `setReading()` is where the stamp, the save buttons and `currentRank`
are all written together. Saving from the overview has to work: the viewer has already picked
something out by the time the stamp names it.

`?photo=<id>` is the link the share button hands out and the collection page links back to. It
is written with `replaceState`, never pushed: stepping through a hundred photographs must not
bury the page the viewer arrived from under a hundred history entries. On load it is honoured
by snapping — not easing — to that photograph, since a flight down the whole band reads as the
page having started somewhere else and changed its mind.

`pages/collection.astro` reuses the band's own 240w variant deliberately. Asking for another
width would emit two hundred more files for cells this size to draw at.

### read more

The expanded record is anchored to the photograph's lower edge, so the room for it has to come
out of the photograph rather than out of the bottom of the screen. `expand` is therefore eased
**in the loop** and subtracted from `openScale()`'s height budget: the picture shrinks at the
same rate the record grows. A CSS-only reveal would have the last rows falling off a laptop
display. The only thing the stylesheet animates is the rows' own height — never the caption's
`top`, which follows `--open-h` and would then lag a frame behind the picture.

### The `?` panel

The controller owns the keyboard, so it owns the panel. While it is up, keys go to it and
nothing else: stepping the band behind an overlay leaves the viewer somewhere else when it
closes. The wheel is handed over by *not* calling `preventDefault`, which is what lets the
sheet scroll when it outgrows a short window.

### Hit testing

`.slot` is `pointer-events: none` and the `<img>` inside takes them. A slot's box
stays an unrotated 300×200 while the visible photo is a small parallelogram in the
middle of it, so slot boxes overlap almost completely and clicks land on whichever
sits highest rather than the one under the cursor. Handing pointer events to the
image makes the browser test against the transformed geometry.

In `ribbon` mode the click target is ignored entirely — the band is too dense to hit
a single 5px sliver, so whatever the fan has brought to the front is opened instead.

The consequence to remember: a child re-enabling `pointer-events` overrides `none` on
its parent, so `pointer-events: none` on `.slot` alone never silences its image.
Anything meant to be untouchable — filtered-out photos, for one — has to turn them off
on the `img` itself, or it stays hit-testable while invisible and swallows clicks.

### Touch

A finger has neither a wheel nor arrow keys, so one drag handler covers both jobs the
pointer does on the desktop. Displacement is projected onto `AXIS` rather than being
split into horizontal and vertical rules, so the gesture obeys the band's own
geometry: dragging down-left pushes the stack that way and brings the photographs
above it into view. That makes a swipe left and a swipe down both mean *next*,
matching the wheel, whichever way the finger actually travelled.

The drag reads differently per mode, for the same reason each mode exists. `browse`
moves the band continuously and hands its last movement to `velocity` on release, so
a flick glides exactly as a wheel flick does. `detail` quantises to `SWIPE_STEP` —
a photograph filling the frame has to arrive whole, not be dragged halfway in.
`ribbon` is left alone: the band already fits the viewport, so there is nothing to
scroll to and the finger's job there is to fan.

Two things this depends on:

- `touch-action: none` on `.stack`. Without it the browser claims the gesture for
  panning or double-tap zoom and cancels the pointer stream partway through a drag.
- A drag ends in a `click` on whatever it finished over, which would open that
  photograph and undo the gesture. `dragged` suppresses that click, and is cleared on
  *every* `pointerdown` including the mouse's — a click arrives after the sequence
  that produced it, so a flag left standing by a touch drag would otherwise swallow
  the next mouse click on a hybrid device.

`pointerdown` is bound to `.stack`, but move and up are bound to `window`: the finger
regularly strays over the fixed chrome mid-drag, and losing the stream there would
strand the gesture half finished.

`SwipeHint.astro` names the gesture, because a gesture is the only one of the three
ways through the archive that a viewer cannot see. It is offered only when the
photograph was opened by a finger — `touchInput` records the pointer type, so a mouse
never raises it — and `swipeLearned` retires it permanently the moment a swipe
actually steps a photograph. A hint that reappears after it has been understood has
stopped being a hint. Failing that it withdraws on its own after `HINT_LINGER`.

### Chrome layout

Follows the reference art direction: capture date and time at the top-left as a
persistent two-line stamp, wordmark centred on the same baseline, series filter
right-aligned and anchored above the toolbar so it grows upward as series are added.
The bottom-left is left empty.

`Stamp.astro` tracks the band continuously — the photograph at the centre, or the one
under the cursor while the band is fanned — so it reads as a position in time rather
than only responding to selection.

`Caption.astro` carries place, camera and the actions, and appears in `detail` only.
It anchors to the opened photograph rather than a viewport corner: the controller
publishes the photo's rendered size as `--open-w` / `--open-h`, and since the photo is
centred, half of each locates its edges. A corner-anchored caption sat on top of the
neighbouring stacks. Date and time deliberately appear in the stamp only, never here.

The swipe hint takes the space directly above the opened photograph, anchored off
`--open-h` the way the caption is anchored below it. That band is the only part of
the frame that stays empty in `detail`, and a corner would have put it over the
neighbouring stacks — the same reason the caption is not in one.

On a phone the chrome is reflowed rather than re-tuned. Centred, the wordmark lands on the
stamp — both sit on the same baseline and there is no room between them — so it moves to the
opposite corner, keeping the top line of the interface as one row. The series list becomes a
row along the bottom that scrolls sideways: a column of nine series eats a third of the screen
and the band is behind it. The threshold is `NARROW_VIEWPORT`, restated as a media query
because a media query cannot read a custom property.

The series panel hides in `detail`, and `openScale()` caps the photo at 60% of
viewport height specifically to leave the caption room beneath it. Its width budget
is not fixed: below `NARROW_VIEWPORT` the photograph takes 92% of the width instead
of 62%. The margin exists to keep the opened photo clear of the neighbouring stacks,
and on a phone those are pushed off-screen anyway — while 62% of a phone's width
leaves a stamp-sized picture. Detail mode also
closes the neighbours back up to near-ribbon density and pushes them clear by
`detailGroupGap()`, so they read as the archive continuing either side rather than
competing with the photo in hand. The clearance is a share of the photograph rather
than a distance, which is what keeps the composition reading the same from a laptop
to a 4K display; below about 1100px wide there is no longer room for both a
comfortable gap and a visible stack, and the neighbours slide off the corners.

### Watch for

- The isometric angle `-45deg` is stated twice: the `.frame` rule in `Ribbon.astro`
  and the interpolation in `renderOpenFrames`. They must stay in sync.
- The frame box (300×200) is declared in CSS; the controller measures it from the DOM
  rather than restating it.
- Scroll position indexes the *filtered* list, so nothing may be carried across a
  filter change unrescaled. `applyFilter` sidesteps this by landing on the new
  band's middle rather than translating the old position. The same trap catches any
  rank cached to skip redundant DOM writes — `lastStamped` has to be invalidated
  when the list changes, since the same rank then means a different photograph.
  It catches anything *pinned* to a rank too: the time marks are rebuilt there for
  exactly this reason.
- `NARROW_VIEWPORT` in `Ribbon.astro` and the `720px` media queries state one
  threshold twice. The queries live in `tokens.css`, `Brandmark.astro`,
  `TagPanel.astro`, `Toolbar.astro`, `Caption.astro` and `collection.astro`; a
  media query cannot read a custom property, so they have to be moved together.
- The pool's base box (200×120) is declared in CSS and measured by the controller,
  the same way the frame box is. Its scale factors are ratios against that
  measurement, so resizing the gradient in the stylesheet stays harmless.
- `/collection` scrolls and the gallery must not — the wheel drives the band there.
  That is what `Layout.astro`'s `scrollable` prop is for; `body` is `overflow:
  hidden` by default on purpose.

## Current state

Working: ribbon rendering, hover fan, momentum scroll, browse, detail with full-res
swap, arrow stepping, Escape, series filtering, caption metadata, touch dragging,
swipe-to-step and the swipe hint that introduces it. Also the second pass over the
list this file used to carry: `read more`, saving and sharing, `?photo=` permalinks,
the collection page, the `?` panel, the graduated time marks along the band, the phone
chrome, and the pooled shadow under each stack.

Still open, and deliberate:

- The manifest's metadata is synthesised from filenames, as described above. Real
  EXIF replaces the generator's synthesis step, not the JSON.
- What reflows on a phone is the chrome. The band's own spacing is still tuned for a
  desktop viewport — `ribbon` fits itself to the screen, `browse` and `detail` run on
  fixed gaps by design, and re-deriving those for a phone is a separate decision
  about what browsing should feel like on one, not a tweak.
- The collection is per-browser. There is no account behind it, and adding one would
  mean giving a static site a backend.
