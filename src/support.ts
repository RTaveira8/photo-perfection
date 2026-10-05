/**
 * Browser capability check, run once at startup.
 *  - `strip`: what the Metadata Stripper needs (plain file and byte handling). Almost every current browser.
 *  - `compress`: what the compressor additionally needs (OffscreenCanvas with a 2D context and convertToBlob,
 *    createImageBitmap, Web Workers). Missing in older Safari (before 16.4) and some old browsers.
 * QA hook: add `?forceUnsupported=compress` or `?forceUnsupported=all` to the URL to see the fallback screens.
 */
export interface Support {
  compress: boolean;
  strip: boolean;
  /** Human-readable names of the missing features, for the message. */
  missing: string[];
  forced: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function detect(g: any = globalThis): Support {
  const missing: string[] = [];
  const need = (ok: boolean, name: string) => {
    if (!ok) missing.push(name);
    return ok;
  };
  const offscreen2d = () => {
    try {
      return !!new g.OffscreenCanvas(1, 1).getContext('2d');
    } catch {
      return false;
    }
  };

  const strip = [
    need(typeof g.File === 'function' && typeof g.Blob === 'function' && !!g.Blob.prototype?.arrayBuffer, 'file reading'),
    need(typeof g.TextDecoder === 'function', 'text decoding'),
    need(typeof g.URL?.createObjectURL === 'function', 'file downloads'),
  ].every(Boolean);

  const compress = [
    need(typeof g.OffscreenCanvas === 'function' && !!g.OffscreenCanvas.prototype?.convertToBlob && offscreen2d(), 'off-screen image drawing'),
    need(typeof g.createImageBitmap === 'function', 'image decoding'),
    need(typeof g.Worker === 'function', 'background processing'),
  ].every(Boolean);

  const force = new URLSearchParams(g.location?.search ?? '').get('forceUnsupported');
  if (force === 'all') return { compress: false, strip: false, missing: ['(forced for testing)'], forced: true };
  if (force === 'compress') return { compress: false, strip, missing: [...missing, '(forced for testing)'], forced: true };
  return { compress: strip && compress, strip, missing, forced: false };
}

export const support = detect();
