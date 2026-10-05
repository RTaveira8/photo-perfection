import { FEATURES } from './config';

export const fmt = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const icon: Record<string, string> = {
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><path d="M4 4l16 16"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z"/></svg>`,
  compare: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14M8 10l-2 2 2 2M16 10l2 2-2 2"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  down: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>`,
};

// Extra icons for the metadata stripper.
icon.shield = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>`;

/** Free tier takes one photo at a time. Returns the files to process and shows a "coming soon" note if some were skipped. */
export function limitBatch<T extends File>(files: T[], note: HTMLElement): T[] {
  if (FEATURES.batch || files.length <= 1) {
    note.hidden = true;
    return files;
  }
  note.hidden = false;
  note.textContent = `Batch processing is coming soon with Pixel-Pro. Only the first photo (${files[0].name}) was processed. Add the others one at a time for now.`;
  return files.slice(0, 1);
}

/** The small "PRO · coming soon" line shown under the dropzone while batch is off. */
export const batchSoon = FEATURES.batch ? '' : '<span class="drop-soon"><b>PRO</b> Batch processing, coming soon</span>';

/** Pixel-Lite logo mark: a 3x3 pixel grid dissolving toward one corner. Colour comes from the surrounding text colour. */
export const logoMark = `<svg class="logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="0" y="0" width="6" height="6" rx="1.6" fill-opacity="1"/><rect x="9" y="0" width="6" height="6" rx="1.6" fill-opacity="0.78"/><rect x="18" y="0" width="6" height="6" rx="1.6" fill-opacity="0.5"/><rect x="0" y="9" width="6" height="6" rx="1.6" fill-opacity="0.78"/><rect x="9" y="9" width="6" height="6" rx="1.6" fill-opacity="0.5"/><rect x="18" y="9" width="6" height="6" rx="1.6" fill-opacity="0.28"/><rect x="0" y="18" width="6" height="6" rx="1.6" fill-opacity="0.5"/><rect x="9" y="18" width="6" height="6" rx="1.6" fill-opacity="0.28"/><rect x="18" y="18" width="6" height="6" rx="1.6" fill-opacity="0.12"/></svg>`;

export const wordmark = `<span class="wm"><b>Pixel</b><i>-Lite</i></span>`;

icon.sun = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>`;
icon.moon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`;

icon.share = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3m0 0L8 7m4-4l4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>`;
