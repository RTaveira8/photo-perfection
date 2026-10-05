/**
 * Colour-grade filters. Every number is "how far from neutral" so Intensity can scale
 * the whole look smoothly between the original (0) and full strength (1).
 */
export interface FilterParams {
  /** Saturation multiplier (1 = unchanged, 0 = black & white). */
  sat?: number;
  /** Contrast multiplier around mid-grey. */
  contrast?: number;
  /** Exposure change, -1..1 (0.1 = 10% brighter). */
  bright?: number;
  /** -1 cool .. 1 warm. */
  warmth?: number;
  /** -1 green .. 1 magenta. */
  tint?: number;
  /** 0..~0.15. Lifts the blacks for a matte look. */
  fade?: number;
  /** Colour pushed into the shadows / highlights, in levels (0-255) per channel. */
  shadows?: [number, number, number];
  highlights?: [number, number, number];
  /** 0..1. Darkens the corners. */
  vignette?: number;
}

export interface Filter {
  id: string;
  name: string;
  blurb: string;
  /** CSS gradient for the little swatch in the picker. */
  swatch: string;
  params: FilterParams;
}

export const FILTERS: Filter[] = [
  {
    id: 'neon',
    name: 'Neon',
    blurb: 'Punchy, saturated colour',
    swatch: 'linear-gradient(135deg,#ff2d95,#7a5cff 55%,#00e5ff)',
    params: { sat: 1.35, contrast: 1.12 },
  },
  {
    id: 'sunburst',
    name: 'Sunburst',
    blurb: 'Golden-hour warmth',
    swatch: 'linear-gradient(135deg,#ffd166,#ff8a3d 60%,#ef476f)',
    params: { sat: 1.2, contrast: 1.06, warmth: 0.55, bright: 0.04 },
  },
  {
    id: 'glacier',
    name: 'Glacier',
    blurb: 'Crisp, cool and clean',
    swatch: 'linear-gradient(135deg,#d9f4ff,#5ab8ff 55%,#2b6cb0)',
    params: { sat: 1.12, contrast: 1.08, warmth: -0.55, bright: 0.02 },
  },
  {
    id: 'thunder',
    name: 'Thunder',
    blurb: 'Heavy contrast, moody edges',
    swatch: 'linear-gradient(135deg,#8a94a6,#3b4252 55%,#14171d)',
    params: { sat: 0.88, contrast: 1.35, bright: -0.04, vignette: 0.5 },
  },
  {
    id: 'smolder',
    name: 'Smolder',
    blurb: 'Dark, warm and dramatic',
    swatch: 'linear-gradient(135deg,#f6ad55,#9c4221 55%,#2a1208)',
    params: { sat: 0.95, contrast: 1.28, warmth: 0.4, bright: -0.05, vignette: 0.4 },
  },
  {
    id: 'dusk',
    name: 'Dusk',
    blurb: 'Faded blacks, soft warm tones',
    swatch: 'linear-gradient(135deg,#fbd5c0,#d98b9a 55%,#6b5b95)',
    params: { sat: 0.9, contrast: 0.95, warmth: 0.25, tint: 0.15, fade: 0.1, highlights: [8, 0, -6], shadows: [6, 0, 14] },
  },
  {
    id: 'haze',
    name: 'Haze',
    blurb: 'Matte, airy and light',
    swatch: 'linear-gradient(135deg,#f4efe6,#cfd8d3 55%,#9fb3b1)',
    params: { sat: 0.8, contrast: 0.9, bright: 0.06, fade: 0.14 },
  },
  {
    id: 'ghost',
    name: 'Ghost',
    blurb: 'Clean black and white',
    swatch: 'linear-gradient(135deg,#f2f2f2,#8c8c8c 55%,#262626)',
    params: { sat: 0, contrast: 1.12 },
  },
  {
    id: 'mercury',
    name: 'Mercury',
    blurb: 'Silvery, slightly cool mono',
    swatch: 'linear-gradient(135deg,#eef1f5,#a3adb8 55%,#4a5561)',
    params: { sat: 0, contrast: 1.06, fade: 0.05, shadows: [0, 4, 10], highlights: [4, 4, 0] },
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    blurb: 'Deep, high-contrast noir',
    swatch: 'linear-gradient(135deg,#c9c9c9,#3a3a3a 55%,#000)',
    params: { sat: 0, contrast: 1.45, bright: -0.06, vignette: 0.55 },
  },
];

export const getFilter = (id?: string) => FILTERS.find((f) => f.id === id);
