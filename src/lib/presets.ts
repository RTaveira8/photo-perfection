export interface Preset {
  id: string;
  label: string;
  longEdge: number;
  quality: number;
}

// Defaults proven in Clutch (see docs/handoff.md section 3).
export const PRESETS: Preset[] = [
  { id: 'display', label: 'Display', longEdge: 1440, quality: 0.82 },
  { id: 'thumb', label: 'Thumb', longEdge: 480, quality: 0.75 },
];
