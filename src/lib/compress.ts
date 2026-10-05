import type { Preset } from './presets';
import { sharpen } from './sharpen';

export interface Output {
  preset: Preset;
  blob: Blob;
  width: number;
  height: number;
}

export interface CompressResult {
  original: { width: number; height: number; bytes: number };
  outputs: Output[];
}

/** Scale so the long edge is at most `longEdge`; never upscale, never crop. */
export function fitLongEdge(w: number, h: number, longEdge: number) {
  const scale = Math.min(1, longEdge / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

type Source = ImageBitmap | OffscreenCanvas;

function resize(src: Source, width: number, height: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, width, height);
  return canvas;
}

/** Halve repeatedly, then a final resize, so big reductions stay sharp. */
function stepDown(src: Source, width: number, height: number): OffscreenCanvas {
  let cur: Source = src;
  let cw = src.width;
  let ch = src.height;
  while (cw / 2 >= width && ch / 2 >= height) {
    cw = Math.round(cw / 2);
    ch = Math.round(ch / 2);
    cur = resize(cur, cw, ch);
  }
  return resize(cur, width, height);
}

/**
 * Decode once, then step down largest -> smallest (each from the previous).
 * Always re-encodes through canvas, which guarantees EXIF/XMP are stripped.
 * Presets may be passed in any order.
 */
export async function compress(file: File, presets: Preset[]): Promise<CompressResult> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const original = { width: bitmap.width, height: bitmap.height, bytes: file.size };

  const sorted = [...presets].sort((a, b) => b.longEdge - a.longEdge);
  const outputs: Output[] = [];
  let prev: Source = bitmap;
  for (const preset of sorted) {
    const { width, height } = fitLongEdge(prev.width, prev.height, preset.longEdge);
    const canvas = stepDown(prev, width, height);
    let encodeFrom = canvas;
    if (preset.sharpen && (width < prev.width || height < prev.height)) {
      // Sharpen a copy so the step-down chain isn't sharpened repeatedly.
      encodeFrom = resize(canvas, width, height);
      sharpen(encodeFrom, preset.sharpen);
    }
    const blob = await encodeFrom.convertToBlob({ type: 'image/jpeg', quality: preset.quality });
    outputs.push({ preset, blob, width, height });
    prev = canvas;
  }
  bitmap.close();
  return { original, outputs };
}
