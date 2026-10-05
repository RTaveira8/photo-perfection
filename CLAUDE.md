# Shred

Client-side image optimizer: shrinks photos without visible quality loss, strips EXIF/GPS, no uploads.
Starting brief: `docs/handoff.md` (from the Clutch project). It is a guide to refine, not a spec.
Repo: github.com/RTaveira8/photo-perfection (public). The product name is "Shred"; the repo/folder/package keep the old name.

## Stack
Vite + TypeScript (vanilla, no framework). Compression runs in a Web Worker via OffscreenCanvas. ZIP via `fflate`.

## Layout
- `src/main.ts`: all UI (markup, mode/platform picker, Fine-tune/Extras/Filters panels, result cards, ZIP, remove/clear)
- `src/compare.ts`: full-screen before/after viewer (Slider and Flip modes)
- `src/lib/compress.ts`: decode once, step down, apply effects, encode JPEG
- `src/lib/effects.ts`: pixel effects (filter, white balance, clarity, sharpen, grain), applied in that order
- `src/lib/filters.ts`: the 11 filters (Reel, Neon, Sunburst, Glacier, Thunder, Smolder, Dusk, Haze, Ghost, Mercury, Obsidian)
- `src/lib/presets.ts`: Basic and Social (Facebook, Instagram, TikTok Gallery) settings
- `src/lib/worker.ts`, `client.ts`: worker and its promise wrapper
- `test-assets/` is git-ignored: local test photos only. Never commit photos (repo is public).

## Core rules
- Size by long edge only; never upscale, never crop (aspect ratio is always kept).
- Decode once, then step down by halving. Always re-encode through canvas (that is what strips EXIF/XMP).
- Respect orientation: `imageOrientation: 'from-image'`.
- Effects run on a copy of the final-size canvas so they never compound through the step-down chain.
- Each photo gets ONE output (the selected target), not Display + Thumb.

## Modes and defaults
- **Basic compression**: 1440 px, quality 0.82 (the handoff's proven Display setting). Default mode.
- **Social**: pick Facebook (2048 px), Instagram (1350 px) or TikTok Gallery (1920 px), quality 0.92-0.93.
  Social presets include built-in light sharpening (0.12). Platform sizes are commonly published figures and
  have not been verified against current platform docs. Platforms re-compress everything; do not claim we
  reduce their compression, only that we give them less to damage.
- **Fine-tune / Extras / Filters** panels are all marked OPTIONAL. Defaults: Fine-tune = recommended for the
  selected target, Extras = none applied (all sliders 0), Filters = None. The Sharpen slider is *extra* on top
  of a Social preset's built-in sharpening. Filter choice persists across mode changes; Fine-tune/Extras reset
  when the target changes.
- Settings are snapshotted when photos are dropped and only affect photos added next.
- Finished cards show tags for anything changed from defaults (Fine-tune / Extras / Filter).

## Gotchas
- Grain (Extras slider and the Reel filter) makes files much larger; the UI warns about this.
- Below ~75% quality, smooth gradients can band (from the handoff).
- Shell heredocs/`node -e` mangle template literals with backticks; use the Edit/Write tools for TS files.
- Windows: git warns about LF to CRLF; harmless.

## Commands
`npm run dev` · `npm run build` · `npm test` (unit tests cover `fitLongEdge` only; effects/UI are checked by hand in the browser)

## Open decisions
Audience, HEIC support, WebP/AVIF via WASM, batch limits and memory on phones (not yet measured), business model
(handoff section 7). Not built yet: custom preset saving, batch rename, PWA/offline, phone-width visual QA.
