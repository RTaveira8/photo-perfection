/**
 * Feature switches. Batch processing is built but held back as a planned Pixel-Pro feature:
 * with `batch: false` the free tool takes one photo at a time and hides the bulk actions
 * (Download all as ZIP, Clear all). Set it to `true` to turn everything back on.
 */
export const FEATURES = {
  batch: false,
};

/**
 * Shown in the footer. Bump this on every beta release: Beta 1.0.1 -> Beta 1.0.2 -> ...
 * (This is the only place the version number lives.)
 */
export const APP_VERSION = 'Beta 1.0.1';
