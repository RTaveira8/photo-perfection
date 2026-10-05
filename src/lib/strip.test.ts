import { describe, expect, it } from 'vitest';
import { NotJpegError, parseJpeg, stripMetadata, summarize } from './strip';

// ---- fixture builders (independent of strip.ts's writer) ----

const enc = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const cat = (...p: Uint8Array[]) => {
  const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of p) (out.set(x, o), (o += x.length));
  return out;
};
const be16 = (v: number) => Uint8Array.of(v >> 8, v & 255);

interface E {
  tag: number;
  type: number;
  count: number;
  data: Uint8Array;
}

/** Hand-roll a TIFF with IFD0 (+ ExifIFD, GPS IFD, and a thumbnail IFD1) in the given byte order. */
function tiff(le: boolean, ifd0: E[], exif: E[], gps: E[], thumb = false): Uint8Array {
  const w16 = (v: number) => (le ? Uint8Array.of(v & 255, v >> 8) : be16(v));
  const w32 = (v: number) => (le ? Uint8Array.of(v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24) : Uint8Array.of(v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255));
  const all0 = [...ifd0];
  if (exif.length) all0.push({ tag: 0x8769, type: 4, count: 1, data: w32(0) });
  if (gps.length) all0.push({ tag: 0x8825, type: 4, count: 1, data: w32(0) });
  all0.sort((a, b) => a.tag - b.tag);
  const size = (n: number) => 2 + n * 12 + 4;
  const exifOff = 8 + size(all0.length);
  const gpsOff = exifOff + (exif.length ? size(exif.length) : 0);
  const ifd1Off = gpsOff + (gps.length ? size(gps.length) : 0);
  let cur = ifd1Off + (thumb ? size(0) : 0);
  const lists = [all0, [...exif].sort((a, b) => a.tag - b.tag), [...gps].sort((a, b) => a.tag - b.tag)];
  const area: number[] = [];
  const header = [...(le ? enc('II') : enc('MM')), ...w16(42), ...w32(8)];
  const body: Uint8Array[] = [];
  lists.forEach((l, li) => {
    if (!l.length) return;
    const parts: number[] = [...w16(l.length)];
    for (const e of l) {
      let field: number[];
      if (e.tag === 0x8769 && li === 0) field = [...w32(exifOff)];
      else if (e.tag === 0x8825 && li === 0) field = [...w32(gpsOff)];
      else if (e.data.length <= 4) field = [...e.data, ...new Array(4 - e.data.length).fill(0)];
      else {
        field = [...w32(cur + area.length)];
        area.push(...e.data, ...(e.data.length & 1 ? [0] : []));
      }
      parts.push(...w16(e.tag), ...w16(e.type), ...w32(e.count), ...field);
    }
    parts.push(...w32(li === 0 && thumb ? ifd1Off : 0));
    body.push(Uint8Array.from(parts));
  });
  if (thumb) body.push(Uint8Array.from([...w16(0), ...w32(0)]));
  return cat(Uint8Array.from(header), ...body, Uint8Array.from(area));
}

const ascii = (tag: number, s: string): E => ({ tag, type: 2, count: s.length + 1, data: enc(s + '\0') });
const short = (le: boolean, tag: number, v: number): E => ({ tag, type: 3, count: 1, data: le ? Uint8Array.of(v & 255, v >> 8) : be16(v) });
const rational = (le: boolean, tag: number, n: number, d: number): E => {
  const w32 = (v: number) => (le ? Uint8Array.of(v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24) : Uint8Array.of(v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255));
  return { tag, type: 5, count: 1, data: cat(w32(n), w32(d)) };
};
const seg = (marker: number, payload: Uint8Array) => cat(Uint8Array.of(0xff, marker), be16(payload.length + 2), payload);

const SCAN = Uint8Array.of(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0x00, 0x78); // data with stuffing + restart marker

function fakeJpeg(exifTiff: Uint8Array | null, opts: { extras?: boolean } = { extras: true }) {
  return cat(
    Uint8Array.of(0xff, 0xd8),
    seg(0xe0, enc('JFIF\0\x01\x01\0\0\x01\0\x01\0\0')),
    exifTiff ? seg(0xe1, cat(enc('Exif\0\0'), exifTiff)) : new Uint8Array(),
    opts.extras ? seg(0xe1, cat(enc('http://ns.adobe.com/xap/1.0/\0'), enc('<x:xmpmeta>GPSLatitude</x:xmpmeta>'))) : new Uint8Array(),
    opts.extras ? seg(0xed, cat(enc('Photoshop 3.0\0'), enc('8BIM city: Berlin'))) : new Uint8Array(),
    opts.extras ? seg(0xfe, enc('shot by the client')) : new Uint8Array(),
    seg(0xdb, new Uint8Array(65)), // quant table
    seg(0xc0, Uint8Array.of(8, 0, 4, 0, 4, 1, 1, 0x11, 0)),
    seg(0xda, Uint8Array.of(1, 1, 0, 0, 0x3f, 0)),
    SCAN,
    Uint8Array.of(0xff, 0xd9),
    opts.extras ? enc('TRAILING-PREVIEW-DATA') : new Uint8Array(),
  );
}

function fullExif(le: boolean) {
  const ifd0 = [
    ascii(0x010f, 'Canon'),
    ascii(0x0110, 'Canon EOS R5'),
    short(le, 0x0112, 6),
    ascii(0x0131, 'Firmware 1.8.2'),
    ascii(0x0132, '2026:05:01 10:00:00'),
    ascii(0x013b, 'Alex Pro'),
    ascii(0x8298, '(c) Alex Pro 2026'),
  ];
  const exif = [
    rational(le, 0x829a, 1, 250),
    rational(le, 0x829d, 28, 10),
    short(le, 0x8827, 400),
    ascii(0x9003, '2026:05:01 09:59:59'),
    { tag: 0x927c, type: 7, count: 12, data: enc('MAKERNOTE123') } as E,
    short(le, 0xa001, 1),
    ascii(0xa431, 'SN-1234567'),
    ascii(0xa434, 'RF 24-70mm F2.8'),
  ];
  const gps = [
    ascii(0x0001, 'N'),
    { tag: 0x0002, type: 5, count: 3, data: cat(...[52, 31, 12].flatMap((n) => [Uint8Array.of(0, 0, 0, n), Uint8Array.of(0, 0, 0, 1)])) } as E,
    ascii(0x0003, 'E'),
    { tag: 0x0004, type: 5, count: 3, data: cat(...[13, 24, 5].flatMap((n) => [Uint8Array.of(0, 0, 0, n), Uint8Array.of(0, 0, 0, 1)])) } as E,
  ];
  return tiff(le, ifd0, exif, gps, true);
}
const keys = (s: { fields: { key: string }[] }) => s.fields.map((f) => f.key);

describe.each([
  ['little-endian', true],
  ['big-endian', false],
])('%s EXIF', (_n, le) => {
  const file = fakeJpeg(fullExif(le));

  it('reads camera info, settings and GPS', () => {
    const s = summarize(file);
    expect(s.gps).toBe(true);
    expect(s.orientation).toBe(6);
    const f = Object.fromEntries(s.fields.map((x) => [x.key, x.value]));
    expect(f).toMatchObject({
      make: 'Canon',
      model: 'Canon EOS R5',
      lens: 'RF 24-70mm F2.8',
      bodySerial: 'SN-1234567',
      shutter: '1/250 s',
      aperture: 'f/2.8',
      iso: '400',
      makernote: 'present',
      artist: 'Alex Pro',
    });
    expect(s.xmp && s.iptc && s.comment && s.thumbnail && s.trailing).toBe(true);
  });

  it('removes GPS and camera info, keeps orientation and credit, leaves pixels untouched', () => {
    const r = stripMetadata(file, { gps: true, camera: true, keepCredit: true });
    expect(r.verified).toBe(true);
    expect(r.scanIdentical).toBe(true);
    expect(r.after.gps).toBe(false);
    expect(keys(r.after).sort()).toEqual(['artist', 'copyright']);
    expect(r.after.orientation).toBe(6);
    expect(r.after.xmp || r.after.iptc || r.after.comment || r.after.thumbnail || r.after.trailing).toBe(false);
    expect(r.bytes.length).toBeLessThan(file.length);
  });

  it('removes credit too when asked', () => {
    const r = stripMetadata(file, { gps: true, camera: true, keepCredit: false });
    expect(keys(r.after)).toEqual([]);
    expect(r.after.orientation).toBe(6);
    expect(r.verified).toBe(true);
  });

  it('GPS only: camera settings are kept, GPS is gone', () => {
    const r = stripMetadata(file, { gps: true, camera: false, keepCredit: true });
    expect(r.verified).toBe(true);
    expect(r.after.gps).toBe(false);
    expect(keys(r.after)).toEqual(keys(r.before));
    expect(r.after.fields.find((f) => f.key === 'shutter')?.value).toBe('1/250 s');
    expect(r.after.thumbnail).toBe(true); // untouched EXIF structure
    // the GPS coordinates are not left behind as raw bytes either
    expect(new TextDecoder('latin1').decode(r.bytes)).not.toContain('GPSLatitude');
  });

  it('camera only: GPS is kept', () => {
    const r = stripMetadata(file, { gps: false, camera: true, keepCredit: true });
    expect(r.verified).toBe(true);
    expect(r.after.gps).toBe(true);
    expect(keys(r.after).sort()).toEqual(['artist', 'copyright']);
  });
});

describe('JPEG handling', () => {
  it('refuses non-JPEG data', () => {
    expect(() => stripMetadata(enc('GIF89a....'), { gps: true, camera: true, keepCredit: true })).toThrow(NotJpegError);
  });

  it('needs at least one thing to remove', () => {
    expect(() => stripMetadata(fakeJpeg(null), { gps: false, camera: false, keepCredit: true })).toThrow();
  });

  it('finds the real end of image despite stuffed 0xFF bytes and restart markers', () => {
    const f = fakeJpeg(null);
    const p = parseJpeg(f);
    expect(f.subarray(p.scanEnd - 2, p.scanEnd)).toEqual(Uint8Array.of(0xff, 0xd9));
    expect(f.length - p.scanEnd).toBeGreaterThan(0); // trailing junk sits after it
  });

  it('works on a file with no EXIF at all', () => {
    const r = stripMetadata(fakeJpeg(null), { gps: true, camera: true, keepCredit: true });
    expect(r.verified).toBe(true);
    expect(r.after.fields).toEqual([]);
    expect(r.after.xmp || r.after.iptc || r.after.comment).toBe(false);
  });

  it('removes unreadable EXIF entirely and warns', () => {
    const r = stripMetadata(fakeJpeg(enc('garbage-not-a-tiff-block')), { gps: true, camera: true, keepCredit: true });
    expect(r.warnings.length).toBe(1);
    expect(r.verified).toBe(true);
    expect(r.after.fields).toEqual([]);
  });

  it('leaves no EXIF block at all when nothing worth keeping remains and there is an ICC profile', () => {
    const exif = tiff(true, [ascii(0x010f, 'Sony'), ascii(0x0110, 'ILCE-6700')], [short(true, 0xa001, 1), short(true, 0x8827, 1600)], []);
    const icc = seg(0xe2, cat(enc('ICC_PROFILE '), Uint8Array.of(1, 1), new Uint8Array(20)));
    const base = fakeJpeg(exif);
    const f = cat(base.subarray(0, 2), icc, base.subarray(2));
    const r = stripMetadata(f, { gps: true, camera: true, keepCredit: true });
    expect(new TextDecoder('latin1').decode(r.bytes)).not.toContain('Exif');
    expect(r.after.icc).toBe(true);
    expect(r.verified).toBe(true);
    // without an ICC profile the sRGB flag is kept so colours stay correct
    const r2 = stripMetadata(fakeJpeg(exif), { gps: true, camera: true, keepCredit: true });
    expect(new TextDecoder('latin1').decode(r2.bytes)).toContain('Exif');
    expect(r2.after.fields).toEqual([]);
  });

  it('keeps the JFIF header and colour profile', () => {
    const icc = seg(0xe2, cat(enc('ICC_PROFILE\0'), Uint8Array.of(1, 1), new Uint8Array(20)));
    const base = fakeJpeg(null);
    const withIcc = cat(base.subarray(0, 2), icc, base.subarray(2));
    const r = stripMetadata(withIcc, { gps: true, camera: true, keepCredit: true });
    expect(r.after.icc).toBe(true);
    expect(new TextDecoder('latin1').decode(r.bytes)).toContain('JFIF');
  });
});
