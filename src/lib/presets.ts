export interface Preset {
  id: string;
  label: string;
  /** Long edge in px. Aspect ratio is always kept (no cropping); never upscaled. */
  longEdge: number;
  quality: number;
  /** 0 = none. Light sharpen applied after downscaling. */
  sharpen?: number;
}

export interface Target {
  preset: Preset;
  blurb: string;
  note: string;
}

// Basic: smallest file that still looks the same (proven in Clutch, docs/handoff.md section 3).
// Social: platforms re-compress everything, so send a size close to what they display (less for
// them to resize) at high quality, with light sharpening. Sizes are commonly published figures;
// verify against current platform guidance.
export const SOCIAL: Target[] = [
  {
    preset: { id: 'facebook', label: 'Facebook', longEdge: 2048, quality: 0.93, sharpen: 0.12 },
    blurb: '2048 px',
    note: 'Sized close to what Facebook displays, at high quality, so there is less for its compressor to damage.',
  },
  {
    preset: { id: 'instagram', label: 'Instagram', longEdge: 1350, quality: 0.93, sharpen: 0.12 },
    blurb: '1350 px',
    note: 'Instagram shows feed photos up to 1080 wide or 1350 tall. This keeps portrait photos exact and gives landscape ones a little headroom.',
  },
  {
    preset: { id: 'tiktok', label: 'TikTok Gallery', longEdge: 1920, quality: 0.92, sharpen: 0.12 },
    blurb: '1920 px',
    note: 'Sized for full-screen vertical viewing in TikTok photo posts, at high quality.',
  },
];

export const BASIC: Target = {
  preset: { id: 'basic', label: 'Basic compression', longEdge: 1440, quality: 0.82 },
  blurb: 'Smallest file, same look',
  note: 'Smallest file that still looks the same. Good for websites, email and storage.',
};
