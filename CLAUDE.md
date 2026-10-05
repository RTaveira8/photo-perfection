# Photo Perfection

Client-side image optimizer: shrinks photos without visible quality loss, strips EXIF/GPS, no uploads.
Starting brief: `docs/handoff.md` (from the Clutch project). It is a guide to refine, not a spec.

## Stack
Vite + TypeScript (vanilla). Compression runs in a Web Worker via OffscreenCanvas.

## Core rules (from handoff)
- Size by long edge; never upscale.
- Decode once, step down (original -> display -> thumb).
- Always re-encode (that is what strips metadata).
- Respect orientation: `imageOrientation: 'from-image'`.
- Defaults: Display 1440px @0.82, Thumb 480px @0.75 (`src/lib/presets.ts`).

## Commands
`npm run dev` · `npm run build` · `npm test`

## Open decisions
Audience, HEIC support, WebP/AVIF via WASM, batch limits, business model (handoff section 7).
