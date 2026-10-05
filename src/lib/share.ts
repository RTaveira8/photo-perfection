/**
 * "Save to Photos": on phones and tablets, hand the finished photo to the system share sheet.
 * On iPhone that sheet offers "Save Image", which puts the photo in the Photos library (a plain download
 * link saves to the Files app instead). On Android the sheet varies by device. Desktop keeps the normal
 * Download button, so the button only appears where the share sheet can take files and the main pointer is touch.
 *
 * Everything takes `nav` / `coarse` as parameters so it can be unit-tested without a browser.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Nav = any;

export function isIOS(nav: Nav = navigator): boolean {
  const ua: string = nav.userAgent ?? '';
  // iPadOS reports itself as a Mac, but has a touch screen.
  return /iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
}

export const shareLabel = (nav: Nav = navigator) => (isIOS(nav) ? 'Save to Photos' : 'Share / Save');

export function shareSupported(files: File[], nav: Nav = navigator, coarse: boolean = matchMedia('(pointer: coarse)').matches): boolean {
  try {
    if (!coarse || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
    return !!nav.canShare({ files });
  } catch {
    return false;
  }
}

export type ShareResult = 'shared' | 'cancelled' | 'failed';

export async function shareFiles(files: File[], nav: Nav = navigator): Promise<ShareResult> {
  try {
    if (!nav.canShare?.({ files })) return 'failed';
    await nav.share({ files });
    return 'shared';
  } catch (e) {
    return (e as { name?: string })?.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}

/** Plain download, used when the share sheet is unavailable or errors. */
export function downloadFiles(files: File[]) {
  for (const f of files) {
    const url = URL.createObjectURL(f);
    Object.assign(document.createElement('a'), { href: url, download: f.name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Share sheet first; if it fails (not if the person simply cancels), fall back to a normal download. */
export async function saveToDevice(files: File[], nav: Nav = navigator, download: (f: File[]) => void = downloadFiles): Promise<ShareResult> {
  const result = await shareFiles(files, nav);
  if (result === 'failed') download(files);
  return result;
}
