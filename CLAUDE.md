# Pixel-Lite

Client-side image optimizer: shrinks photos without visible quality loss, strips EXIF/GPS, no uploads.
Starting brief: `docs/handoff.md` (from the Clutch project). It is a guide to refine, not a spec.
Repo: github.com/RTaveira8/pixel-lite (public; renamed from photo-perfection, GitHub redirects the old URL). The product name is "Pixel-Lite" (renamed from "Shred", then "PixelLite"). The local folder is still named Photo-Perfection.
Planned: a paid "Pixel-Pro" tier (subscription) later. Pixel-Lite is the free tier, so keep features that should stay free fully client-side and avoid decisions that block adding accounts/paywalled features later.

## Stack
Vite + TypeScript (vanilla, no framework). Compression runs in a Web Worker via OffscreenCanvas. ZIP via `fflate`.

## Layout
- `src/main.ts`: all UI (markup, mode/platform picker, Fine-tune/Extras/Filters panels, result cards, ZIP, remove/clear)
- `src/strip-ui.ts`: the Metadata stripper screen (second tool, `#strip` in the URL; header tabs switch tools)
- `src/lib/strip.ts`: lossless JPEG metadata stripper (byte-level, no re-encode). Unit-tested in `strip.test.ts`
- `src/boot.ts` (the real entry, loaded by `index.html`): runs the browser check in `src/support.ts`, then dynamically imports `main.ts`.
  Browser too old for both tools: full-page message (`unsupported.ts`). Too old only for the compressor (older Safari, no OffscreenCanvas):
  banner + disabled dropzone, Metadata Stripper still works. QA: add `?forceUnsupported=compress` or `=all` to the URL.
- `src/theme.ts`: light/dark toggle (header button). No saved choice = follow the system; a click saves `pixel-lite-theme` in localStorage
  and sets `data-theme` on `<html>`; an inline script in `index.html` applies it before first paint. Theme colours are CSS variables
  in `style.css` (the dark set appears twice: `[data-theme='dark']` and the system media query, because CSS can't share them).
- `src/ui-utils.ts`: shared `fmt`, `esc`, `icon`
- `src/compare.ts`: full-screen before/after viewer (Slider and Flip modes)
- `src/lib/compress.ts`: decode once, step down, apply effects, encode JPEG
- `src/lib/effects.ts`: pixel effects (filter, white balance, clarity, sharpen, grain), applied in that order
- `src/lib/filters.ts`: the 11 filters (Reel, Neon, Sunburst, Glacier, Thunder, Smolder, Dusk, Haze, Ghost, Mercury, Obsidian)
- `src/lib/presets.ts`: Basic and Social (Facebook, Instagram, TikTok Gallery) settings
- `src/lib/worker.ts`, `client.ts`: worker and its promise wrapper
- `test-assets/` is git-ignored: local test photos only. Never commit photos (repo is public).

## Branding
- Logo mark: a 3x3 pixel grid fading toward the bottom-right (`logoMark` in `src/ui-utils.ts`, inherits colour from `--accent`).
- Wordmark: "Pixel" (Inter 600) + "-Lite" (Fraunces italic, accent teal), echoing the italic in the hero headline. The favicon is
  the same grid as an inline SVG in `index.html`. Pro tier would be "Pixel-Pro" (same mark; swap the italic word).

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
- **Fine-tune / Extras / Filters** panels live inside a collapsed "More options" section (its header shows which are active) and are each marked OPTIONAL. Defaults: Fine-tune = recommended for the
  selected target, Extras = none applied (all sliders 0), Filters = None. The Sharpen slider is *extra* on top
  of a Social preset's built-in sharpening. Filter choice persists across mode changes; Fine-tune/Extras reset
  when the target changes.
- Settings are snapshotted when photos are dropped and only affect photos added next.
- Finished cards show tags for anything changed from defaults (Fine-tune / Extras / Filter).

## Metadata stripper (for professionals; likely the base of the future Pixel-Pro tier)
- Separate tool from the compressor. It never decodes or re-encodes pixels: the scan data (first SOS to the real EOI) is
  copied byte-for-byte, and each result re-reads the output to verify (shows "Image data unchanged · verified").
- Options: GPS location, Camera & settings, Keep copyright & credit. GPS-only zeroes the GPS block in place (every other
  EXIF offset stays valid). Camera removal rebuilds a minimal EXIF (orientation, Artist/Copyright if kept, GPS if kept,
  colour space only when there is no ICC profile).
- Always removed when either option is on: XMP (Lightroom edit history), IPTC, comments, other APPn segments, data after EOI
  (this also drops phone gain maps / previews). Always kept: image data, ICC profile, JFIF, Adobe segment, orientation.
- JPEG only. PNG/WebP/HEIC are not supported yet; the UI says so. Unreadable EXIF is removed entirely with a warning.
- Each card lists everything found in the file and whether it was removed or kept.

## Batch processing is a planned Pixel-Pro feature (held back, not removed)
- `src/config.ts` has `FEATURES.batch = false`. While false, both tools take one photo at a time: the file picker is
  single-select, a multi-file drop processes only the first file and shows a "coming soon with Pixel-Pro" note, and the
  bulk actions (Download all as ZIP, Clear all) are hidden. A "PRO · Batch processing, coming soon" pill sits under each dropzone.
- All batch code (queueing, ZIP, Clear all) is still in place. Set `batch: true` to re-enable everything.
- Photos can still be added one after another; results accumulate and each has its own download and remove button.

## Save to Photos (phones and tablets)
- `src/lib/share.ts`: on touch devices whose browser can share files (`navigator.canShare({files})`), result cards get a button that opens the
  share sheet. iPhone label is "Save to Photos" (the sheet's "Save Image" goes into Photos; a plain download lands in Files); Android is "Share / Save".
  Cancelling does nothing; a real failure falls back to a normal download. Desktop (mouse pointer) never shows it and keeps the Download button.
- Verified with unit tests, a faked share sheet and Chrome's mobile emulation. NOT yet tried on a real iPhone or Android phone: check the share sheet wording and that
  photos land in the Photos library / gallery.

## Versioning
- The footer shows a beta badge ("Beta 1.0.1"). The only place the number lives is `APP_VERSION` in `src/config.ts`.
  Bump it with each release the user pushes: Beta 1.0.1 -> Beta 1.0.2 -> Beta 1.0.3 ...  Do it before the commit, and mention the new number in the commit message.

## Temporary test site
- `index.html` has `<meta name="robots" content="noindex, nofollow">` and `public/robots.txt` disallows everything, so the test deployment stays out of search.
  REMOVE BOTH at public launch. Hosting plan: static host (Netlify/Vercel/Cloudflare Pages) building `npm run build` -> `dist`. Hash routing (`#strip`) needs no
  server rewrites. Avoid GitHub Pages unless `base` is set in a Vite config (it serves under `/pixel-lite/`).

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
