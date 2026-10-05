import { describe, expect, it } from 'vitest';
import { detect } from './support';

/** A fake "browser global" with everything Pixel-Lite needs; tests remove pieces from it. */
function modern(): Record<string, unknown> {
  class FakeCanvas {
    getContext = () => ({});
  }
  (FakeCanvas.prototype as unknown as Record<string, unknown>).convertToBlob = () => Promise.resolve(new Blob());
  return {
    File,
    Blob,
    TextDecoder,
    URL: { createObjectURL: () => 'blob:x' },
    OffscreenCanvas: FakeCanvas,
    createImageBitmap: () => Promise.resolve({}),
    Worker: class {},
    location: { search: '' },
  };
}

describe('detect', () => {
  it('passes on a modern browser', () => {
    expect(detect(modern())).toMatchObject({ compress: true, strip: true, missing: [] });
  });

  it('old Safari style: no OffscreenCanvas means no compressor, but the stripper still works', () => {
    const g = modern();
    delete g.OffscreenCanvas;
    const s = detect(g);
    expect(s.compress).toBe(false);
    expect(s.strip).toBe(true);
    expect(s.missing).toContain('off-screen image drawing');
  });

  it('OffscreenCanvas without a usable 2D context counts as missing', () => {
    const g = modern();
    g.OffscreenCanvas = class {
      getContext = () => null;
      convertToBlob = () => null;
    };
    expect(detect(g).compress).toBe(false);
  });

  it('missing Web Workers or createImageBitmap disables only the compressor', () => {
    const noWorker = modern();
    delete noWorker.Worker;
    expect(detect(noWorker)).toMatchObject({ compress: false, strip: true });
    const noBitmap = modern();
    delete noBitmap.createImageBitmap;
    expect(detect(noBitmap)).toMatchObject({ compress: false, strip: true });
  });

  it('a browser that cannot read files disables everything', () => {
    const g = modern();
    g.Blob = class {};
    const s = detect(g);
    expect(s.strip).toBe(false);
    expect(s.compress).toBe(false);
  });

  it('QA override via the URL', () => {
    const g = modern();
    g.location = { search: '?forceUnsupported=compress' };
    expect(detect(g)).toMatchObject({ compress: false, strip: true, forced: true });
    g.location = { search: '?forceUnsupported=all' };
    expect(detect(g)).toMatchObject({ compress: false, strip: false, forced: true });
  });
});
