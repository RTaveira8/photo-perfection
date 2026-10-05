import { getFilter, type FilterParams } from './filters';

/** Optional finishing touches, applied to the final-size pixels just before JPEG encoding. */
export interface Effects {
  /** Filter id (see filters.ts). Applied first, as a colour grade. */
  filter?: string;
  /** 0..1. How strongly the filter is applied. Defaults to 1. */
  filterAmount?: number;
  /** 0..~0.5. 3x3 sharpen strength. */
  sharpen?: number;
  /** 0..1. Local contrast (midtone-weighted, large-radius unsharp on luminance). */
  clarity?: number;
  /** -1 (cool) .. 1 (warm). */
  warmth?: number;
  /** -1 (green) .. 1 (magenta). */
  tint?: number;
  /** 0..1. Film-style luminance grain. */
  grain?: number;
}

export const hasEffects = (fx: Effects) => !!(fx.filter || fx.sharpen || fx.clarity || fx.warmth || fx.tint || fx.grain);

/** Separable box blur with edge clamping (running sum). */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = src[row] * (r + 1);
    for (let i = 1; i <= r; i++) sum += src[row + Math.min(i, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum * norm;
      sum += src[row + Math.min(x + r + 1, w - 1)] - src[row + Math.max(x - r, 0)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = tmp[x] * (r + 1);
    for (let i = 1; i <= r; i++) sum += tmp[Math.min(i, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum * norm;
      sum += tmp[Math.min(y + r + 1, h - 1) * w + x] - tmp[Math.max(y - r, 0) * w + x];
    }
  }
  return out;
}

function applyFilter(d: Uint8ClampedArray, w: number, h: number, p: FilterParams, k: number) {
  // Scale every parameter toward neutral by k.
  const sat = 1 + ((p.sat ?? 1) - 1) * k;
  const con = 1 + ((p.contrast ?? 1) - 1) * k;
  const exp = 1 + (p.bright ?? 0) * k;
  const rg = 1 + 0.2 * (p.warmth ?? 0) * k;
  const bg = 1 - 0.2 * (p.warmth ?? 0) * k;
  const gg = 1 - 0.12 * (p.tint ?? 0) * k;
  const fade = (p.fade ?? 0) * k;
  const sh = p.shadows ?? [0, 0, 0];
  const hi = p.highlights ?? [0, 0, 0];
  const vig = (p.vignette ?? 0) * k;
  const cx = w / 2;
  const cy = h / 2;
  const inv = 1 / (cx * cx + cy * cy);
  for (let y = 0, i = 0; y < h; y++) {
    const dy2 = (y - cy) * (y - cy);
    for (let x = 0; x < w; x++, i += 4) {
      let r = d[i] * exp * rg;
      let g = d[i + 1] * exp * gg;
      let b = d[i + 2] * exp * bg;
      const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // Split-tone, weighted toward shadows or highlights.
      const ws = (1 - l) * k;
      const wh = l * k;
      r += sh[0] * ws + hi[0] * wh;
      g += sh[1] * ws + hi[1] * wh;
      b += sh[2] * ws + hi[2] * wh;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum + (r - lum) * sat;
      g = lum + (g - lum) * sat;
      b = lum + (b - lum) * sat;
      r = (r - 128) * con + 128;
      g = (g - 128) * con + 128;
      b = (b - 128) * con + 128;
      if (fade) {
        r = r * (1 - fade) + 255 * fade * 0.25;
        g = g * (1 - fade) + 255 * fade * 0.25;
        b = b * (1 - fade) + 255 * fade * 0.25;
      }
      if (vig) {
        const t = ((x - cx) * (x - cx) + dy2) * inv;
        const f = 1 - vig * t * t * 0.9;
        r *= f;
        g *= f;
        b *= f;
      }
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
  }
}

export function applyEffects(canvas: OffscreenCanvas, fx: Effects) {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;

  // 0. Filter (colour grade), scaled by intensity.
  const filter = getFilter(fx.filter);
  if (filter) applyFilter(d, w, h, filter.params, fx.filterAmount ?? 1);

  // 1. White balance: gain on red/blue for warmth, on green for tint.
  if (fx.warmth || fx.tint) {
    const rg = 1 + 0.2 * (fx.warmth ?? 0);
    const bg = 1 - 0.2 * (fx.warmth ?? 0);
    const gg = 1 - 0.12 * (fx.tint ?? 0);
    for (let i = 0; i < d.length; i += 4) {
      d[i] *= rg;
      d[i + 1] *= gg;
      d[i + 2] *= bg;
    }
  }

  // 2. Clarity: boost local contrast, strongest in the midtones to avoid halos in highlights/shadows.
  if (fx.clarity) {
    const lum = new Float32Array(n);
    for (let p = 0, i = 0; p < n; p++, i += 4) lum[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const r = Math.max(4, Math.round(Math.max(w, h) / 90));
    const blur = boxBlur(boxBlur(lum, w, h, r), w, h, r);
    const amount = fx.clarity * 0.7;
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const t = lum[p] / 127.5 - 1;
      const delta = (lum[p] - blur[p]) * amount * (1 - t * t);
      d[i] += delta;
      d[i + 1] += delta;
      d[i + 2] += delta;
    }
  }

  // 3. Sharpen (3x3). Reads from a snapshot so results don't feed back into themselves.
  if (fx.sharpen) {
    const src = d.slice();
    const stride = w * 4;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * stride + x * 4;
        for (let c = 0; c < 3; c++) {
          const k = i + c;
          d[k] = src[k] + fx.sharpen * (4 * src[k] - src[k - 4] - src[k + 4] - src[k - stride] - src[k + stride]);
        }
      }
    }
  }

  // 4. Grain last, so nothing sharpens it away. Lighter in deep shadows/highlights.
  if (fx.grain) {
    const amp = fx.grain * 34;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] + d[i + 1] + d[i + 2]) / 765;
      const noise = (Math.random() + Math.random() - 1) * amp * (1 - (2 * l - 1) ** 2 * 0.7);
      d[i] += noise;
      d[i + 1] += noise;
      d[i + 2] += noise;
    }
  }

  ctx.putImageData(img, 0, 0);
}
