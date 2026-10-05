# Handoff: Image Compressor Web App

**From:** the Clutch project (car/moto social app), October 2026
**Purpose:** a starting brief for a separate, standalone web app. It's meant to be refined in that project, not followed to the letter.

---

## 1. The idea

A simple web app that shrinks photos **without making them look worse**, for people who need small files but care about image quality (photographers, sellers, anyone posting online).

- Drop in one or many photos and get back much smaller versions that look the same at normal viewing sizes.
- **Everything happens in the browser.** Photos are never uploaded to a server. That's a privacy and cost win, and a selling point.
- Hidden metadata (EXIF: GPS location, camera serial, etc.) is removed as part of the process.

This came out of Clutch, where every photo is compressed on the phone before upload. The approach worked well enough to be its own product.

## 2. What we proved in Clutch

Two real full-size photos (Porsche studio shots from a 24 MP camera):

| Original | "Display" output | "Thumb" output | Time |
|---|---|---|---|
| 6048×4024, 11.1 MB (landscape) | 1440×958, 291 KB | 480×319, 40 KB | ~2 s |
| 4128×6192, 7.6 MB (portrait) | 960×1440, 172 KB | 320×480, 23 KB | ~2 s |

- About **97% smaller**, with no visible difference at phone or laptop viewing size. Checked by eye side by side: car paint, chrome, reflections, floor-tile gradients.
- **Metadata removed:** the originals contained EXIF and XMP data; neither output contained any (checked by scanning the output bytes for the `Exif` and XMP markers).
- Measured in a desktop browser (Chrome, dev build). Not yet measured on phones.

## 3. Settings that worked (starting point)

| Preset | Long edge | JPEG quality | Use |
|---|---|---|---|
| Display | 1440 px | 0.82 | Feeds, full-screen viewing, sharing |
| Thumb | 480 px | 0.75 | Grids, previews, avatars |

- **Size by the long edge**, so portrait and landscape are treated the same.
- **Never upscale.** A small photo keeps its size and is only re-encoded.
- **Quality 0.82** is where glossy paint, chrome and sky gradients still look clean. **Below ~0.75, banding** (visible steps in smooth gradients) starts to appear.
- 1440 px covers a phone at 3× pixel density and a ~640 px-wide desktop column at 2×.

In the new app these should probably be user-adjustable presets, with these as defaults.

## 4. Lessons learned (the useful part)

1. **Decode once, then step down.** Our first version decoded the full 24 MP original separately for each output size and took ~8 s per photo. Decoding once and making each smaller size from the previous one (original → display → thumb) cut that to ~2 s, with identical file sizes.
2. **Always re-encode, even if no resize is needed.** That's what guarantees the metadata is gone. Copying a small file through unchanged would keep its GPS data.
3. **JPEG first.** WebP and AVIF are 25–35% smaller at the same quality, but encoder support varies by browser. For a web app this is solvable with WASM encoders (see section 5), so it's worth revisiting.
4. **Store width and height with each output.** Anything that displays the result can lay out before the image loads.
5. **Judge quality by eye, not just numbers.** A side-by-side "lab" page (original vs. each output with sizes) made it quick to tune settings. Worth turning into the app's main screen.
6. **Fetching a 7–11 MB original is itself slow** (first-run timings included it). In a drop-a-file web app the file is already local, so this cost disappears.

## 5. Suggested approach for a standalone web app

Clutch used Expo's `expo-image-manipulator` because it runs on iOS, Android and web. A web-only app doesn't need that. Options, simplest first:

- **Canvas (no dependencies):** decode with `createImageBitmap(file)`, draw onto a canvas (or `OffscreenCanvas` in a Web Worker) at the target size with `imageSmoothingQuality = 'high'`, then `canvas.toBlob(..., 'image/jpeg', 0.82)`. Canvas output carries no EXIF.
  - Respect photo orientation when decoding (`createImageBitmap(file, { imageOrientation: 'from-image' })`), otherwise phone photos can come out sideways.
  - For big reductions (e.g. 6000 → 480 px), downscale in steps (halve repeatedly, then a final resize). Single-step browser downscaling can look jagged or soft.
- **WASM encoders** (e.g. the jSquash packages, ports of the encoders behind Google's Squoosh): MozJPEG gives noticeably smaller JPEGs at the same quality, and WebP/AVIF work in every browser. More bytes to load, but better results.
- **Run the work in a Web Worker** so the page stays responsive during big batches.

A rough shape for the core function (to adapt, not copy):

```ts
// fitLongEdge: scale so the long edge is at most `longEdge`, never upscale.
function fitLongEdge(w: number, h: number, longEdge: number) {
  const scale = Math.min(1, longEdge / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

// Decode once, then step down: original → display → thumb.
async function compress(file: File) {
  const source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const display = await resize(source, fitLongEdge(source.width, source.height, 1440));
  const thumb = await resize(display, fitLongEdge(display.width, display.height, 480));
  return {
    original: { width: source.width, height: source.height, bytes: file.size },
    display: await encode(display, 0.82), // canvas.toBlob → JPEG Blob + width/height
    thumb: await encode(thumb, 0.75),
  };
}
```

## 6. Possible feature list (to refine)

**Core:**
- Drag-and-drop or pick multiple photos.
- Presets (Display / Thumb / custom long edge + quality).
- Side-by-side before/after with file sizes and % saved.
- Download each file, or all of them as a ZIP.
- Metadata removed by default, with a visible "location data removed" note.

**Maybe later:**
- WebP/AVIF output.
- A slider-compare view (drag a divider across the image).
- Batch-rename rules.
- Keep only the copyright field of the metadata.
- PWA/offline support.

## 7. Open questions for the new project

1. **Who is it for?** General public, photographers, or developers (an embeddable library or API)? That decides between a polished app and a package.
2. **iPhone HEIC photos:** Safari can decode HEIC; Chrome and Firefox can't. Supporting them means a WASM HEIC decoder (adds size). Is it needed for v1?
3. **Output formats:** JPEG only for v1, or WebP/AVIF from the start (needs WASM encoders)?
4. **Limits:** max photos per batch and max file size before the browser runs low on memory (24 MP+ photos are ~100 MB each once decoded). This needs testing on phones too.
5. **Any server at all?** Fully client-side is simplest and most private. A server would only be needed for accounts, saved presets or an API.
6. **Business model:** free tool, freemium (batch/ZIP/formats paid), or a lead-in for something else?

## 8. Reference files in the Clutch repo

If the Clutch repo is available ([RTaveira8/clutch-app](https://github.com/RTaveira8/clutch-app), private):

- `src/lib/images/compress.ts`: the decode-once, step-down implementation (Expo version)
- `src/lib/images/config.ts`: the presets and the reasoning behind them
- `app/dev/compression.tsx`: the side-by-side "compression lab" page
- `docs/media.md`: measurements and the original write-up
