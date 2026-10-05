import { describe, expect, it, vi } from 'vitest';
import { isIOS, saveToDevice, shareFiles, shareLabel, shareSupported } from './share';

const photo = [new File([new Uint8Array(4)], 'a.jpg', { type: 'image/jpeg' })];
const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });

describe('shareSupported', () => {
  const nav = { share: vi.fn(), canShare: vi.fn(() => true) };
  it('is on for a touch device whose share sheet accepts files', () => {
    expect(shareSupported(photo, nav, true)).toBe(true);
  });
  it('stays off on desktop (mouse/trackpad) so the normal Download button is used', () => {
    expect(shareSupported(photo, nav, false)).toBe(false);
  });
  it('is off when the browser has no share, or will not share files', () => {
    expect(shareSupported(photo, {}, true)).toBe(false);
    expect(shareSupported(photo, { share: vi.fn(), canShare: () => false }, true)).toBe(false);
    expect(shareSupported(photo, { share: vi.fn(), canShare: () => { throw new Error('x'); } }, true)).toBe(false);
  });
});

describe('labels', () => {
  it('says Save to Photos on iPhone, iPad and iPadOS-as-Mac', () => {
    expect(isIOS({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })).toBe(true);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(shareLabel({ userAgent: 'Mozilla/5.0 (iPhone)' })).toBe('Save to Photos');
  });
  it('says Share / Save on Android and desktop', () => {
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' })).toBe(false);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(shareLabel({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' })).toBe('Share / Save');
  });
});

describe('shareFiles / saveToDevice', () => {
  it('hands the files to the share sheet', async () => {
    const share = vi.fn(() => Promise.resolve());
    const nav = { share, canShare: () => true };
    await expect(shareFiles(photo, nav)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: photo });
  });

  it('treats closing the sheet as a cancel, with no fallback download', async () => {
    const download = vi.fn();
    const nav = { share: () => Promise.reject(abort), canShare: () => true };
    await expect(saveToDevice(photo, nav, download)).resolves.toBe('cancelled');
    expect(download).not.toHaveBeenCalled();
  });

  it('falls back to a normal download if sharing really fails', async () => {
    const download = vi.fn();
    const nav = { share: () => Promise.reject(new Error('NotAllowedError')), canShare: () => true };
    await expect(saveToDevice(photo, nav, download)).resolves.toBe('failed');
    expect(download).toHaveBeenCalledWith(photo);
  });

  it('falls back when the browser says it cannot share these files', async () => {
    const download = vi.fn();
    await saveToDevice(photo, { share: vi.fn(), canShare: () => false }, download);
    expect(download).toHaveBeenCalledOnce();
  });
});
