/**
 * Lossless JPEG metadata stripper. Works on the file's bytes: the image data (everything from the
 * first scan header to the end-of-image marker) is copied verbatim, so there is no re-encoding,
 * no resizing and no quality loss.
 *
 * What it does:
 *  - GPS: the GPS block inside EXIF is zeroed in place (everything else in EXIF is untouched).
 *  - Camera & settings: EXIF is rebuilt from scratch with only orientation, colour space (if there is no ICC profile), optionally
 *    Artist/Copyright, and optionally GPS. Make, model, lens, serials, exposure settings, dates,
 *    manufacturer notes and the embedded preview image are all gone.
 *  - Always (when either option is on): XMP, IPTC/Photoshop data, comments, other APPn segments and
 *    anything after the end-of-image marker are removed. XMP and IPTC can duplicate GPS and camera
 *    data, so they cannot be left behind. The colour profile (ICC), JFIF and Adobe colour segments
 *    are kept because they affect how the picture looks.
 */

export interface StripOptions {
  /** Remove GPS location. */
  gps: boolean;
  /** Remove camera make/model/lens/serials, exposure settings, dates and manufacturer data. */
  camera: boolean;
  /** When removing camera info, keep the Artist and Copyright tags. */
  keepCredit: boolean;
}

export interface Field {
  key: string;
  label: string;
  value: string;
}

export interface Summary {
  gps: boolean;
  fields: Field[];
  xmp: boolean;
  iptc: boolean;
  comment: boolean;
  /** Embedded preview image inside EXIF. */
  thumbnail: boolean;
  /** Bytes after the end-of-image marker (previews, phone gain maps, trailers). */
  trailing: boolean;
  icc: boolean;
  orientation?: number;
}

export interface StripResult {
  bytes: Uint8Array;
  before: Summary;
  after: Summary;
  /** The image data in the output is byte-for-byte identical to the input. */
  scanIdentical: boolean;
  /** Everything requested was removed and the image data is unchanged. */
  verified: boolean;
  warnings: string[];
}

export class NotJpegError extends Error {}

// ---------- byte helpers ----------

const u16 = (b: Uint8Array, o: number, le: boolean) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
const u32 = (b: Uint8Array, o: number, le: boolean) =>
  (le
    ? b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)
    : (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
function put16(b: Uint8Array, o: number, v: number, le: boolean) {
  if (le) {
    b[o] = v & 255;
    b[o + 1] = (v >> 8) & 255;
  } else {
    b[o] = (v >> 8) & 255;
    b[o + 1] = v & 255;
  }
}
function put32(b: Uint8Array, o: number, v: number, le: boolean) {
  if (le) {
    b[o] = v & 255;
    b[o + 1] = (v >> 8) & 255;
    b[o + 2] = (v >> 16) & 255;
    b[o + 3] = (v >>> 24) & 255;
  } else {
    b[o] = (v >>> 24) & 255;
    b[o + 1] = (v >> 16) & 255;
    b[o + 2] = (v >> 8) & 255;
    b[o + 3] = v & 255;
  }
}
const latin1 = (b: Uint8Array) => new TextDecoder('latin1').decode(b);
const startsWith = (b: Uint8Array, off: number, text: string) => {
  if (off + text.length > b.length) return false;
  for (let i = 0; i < text.length; i++) if (b[off + i] !== text.charCodeAt(i)) return false;
  return true;
};
const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const same = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

// ---------- JPEG structure ----------

interface Seg {
  marker: number;
  start: number; // offset of the 0xFF
  end: number; // exclusive
}
interface Parsed {
  segs: Seg[];
  scanStart: number;
  scanEnd: number;
}

/** Find the real end-of-image marker, skipping restart markers and the headers of progressive scans. */
function findScanEnd(b: Uint8Array, sos: number): number {
  let j = sos + 2 + u16(b, sos + 2, false);
  while (j < b.length - 1) {
    if (b[j] !== 0xff) {
      j++;
      continue;
    }
    const m = b[j + 1];
    if (m === 0xd9) return j + 2;
    if (m === 0xff) {
      j++;
      continue;
    }
    if (m === 0x00 || (m >= 0xd0 && m <= 0xd7)) {
      j += 2;
      continue;
    }
    if (j + 4 > b.length) break;
    j += 2 + u16(b, j + 2, false); // another header inside the data (progressive JPEG)
  }
  return b.length; // truncated file: keep everything
}

export function parseJpeg(b: Uint8Array): Parsed {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) throw new NotJpegError('Not a JPEG file');
  const segs: Seg[] = [];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) throw new Error('Damaged JPEG (bad marker)');
    while (b[i + 1] === 0xff) i++;
    const marker = b[i + 1];
    if (marker === 0xd9) break;
    if (marker === 0xda) return { segs, scanStart: i, scanEnd: findScanEnd(b, i) };
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2;
      continue;
    }
    if (i + 4 > b.length) break;
    const len = u16(b, i + 2, false);
    const end = i + 2 + len;
    if (len < 2 || end > b.length) throw new Error('Damaged JPEG (bad segment length)');
    segs.push({ marker, start: i, end });
    i = end;
  }
  throw new Error('This JPEG has no image data');
}

const isExif = (b: Uint8Array, s: Seg) => s.marker === 0xe1 && startsWith(b, s.start + 4, 'Exif\0\0');
const isXmp = (b: Uint8Array, s: Seg) =>
  s.marker === 0xe1 && (startsWith(b, s.start + 4, 'http://ns.adobe.com/xap/1.0/') || startsWith(b, s.start + 4, 'http://ns.adobe.com/xmp/extension/'));
const isIcc = (b: Uint8Array, s: Seg) => s.marker === 0xe2 && startsWith(b, s.start + 4, 'ICC_PROFILE\0');

/** Segments that change how the picture looks, or are structural, are always kept. */
function keepSegment(b: Uint8Array, s: Seg): boolean {
  if (s.marker === 0xe0) return !startsWith(b, s.start + 4, 'JFXX'); // JFIF yes, JFXX thumbnail no
  if (s.marker === 0xe2) return isIcc(b, s);
  if (s.marker === 0xee) return startsWith(b, s.start + 4, 'Adobe');
  if (s.marker >= 0xe1 && s.marker <= 0xef) return false; // EXIF handled separately; XMP, IPTC, others dropped
  return s.marker !== 0xfe; // comments dropped; DQT/SOF/DHT/DRI etc. kept
}

// ---------- TIFF / EXIF ----------

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4 };

interface Entry {
  tag: number;
  type: number;
  count: number;
  size: number;
  /** Absolute offset of the value bytes inside the TIFF block. */
  dataOff: number;
  data: Uint8Array;
}
interface Ifd {
  entries: Entry[];
  next: number;
}
interface Tiff {
  t: Uint8Array;
  le: boolean;
  ifd0: Ifd;
  exif: Ifd | null;
  gps: Ifd | null;
  gpsPtr: Entry | undefined;
}

function readIfd(t: Uint8Array, off: number, le: boolean): Ifd | null {
  if (off < 8 || off + 2 > t.length) return null;
  const n = u16(t, off, le);
  if (n > 1000 || off + 2 + n * 12 + 4 > t.length) return null;
  const entries: Entry[] = [];
  for (let i = 0; i < n; i++) {
    const e = off + 2 + i * 12;
    const type = u16(t, e + 2, le);
    const count = u32(t, e + 4, le);
    const unit = TYPE_SIZE[type];
    if (!unit || count > 0x1000000) continue;
    const size = unit * count;
    const dataOff = size <= 4 ? e + 8 : u32(t, e + 8, le);
    if (dataOff + size > t.length) continue;
    entries.push({ tag: u16(t, e, le), type, count, size, dataOff, data: t.subarray(dataOff, dataOff + size) });
  }
  return { entries, next: u32(t, off + 2 + n * 12, le) };
}

function parseTiff(t: Uint8Array): Tiff | null {
  if (t.length < 8) return null;
  const le = t[0] === 0x49 && t[1] === 0x49;
  if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return null;
  if (u16(t, 2, le) !== 42) return null;
  const ifd0 = readIfd(t, u32(t, 4, le), le);
  if (!ifd0) return null;
  const exifPtr = ifd0.entries.find((e) => e.tag === 0x8769 && e.size === 4);
  const gpsPtr = ifd0.entries.find((e) => e.tag === 0x8825 && e.size === 4);
  return {
    t,
    le,
    ifd0,
    exif: exifPtr ? readIfd(t, u32(exifPtr.data, 0, le), le) : null,
    gps: gpsPtr ? readIfd(t, u32(gpsPtr.data, 0, le), le) : null,
    gpsPtr,
  };
}

const exifOf = (b: Uint8Array, s: Seg) => b.subarray(s.start + 10, s.end);
const find = (ifd: Ifd | null, tag: number) => ifd?.entries.find((e) => e.tag === tag);

function summarizeTiff(p: Tiff): Pick<Summary, 'gps' | 'fields' | 'thumbnail' | 'orientation'> {
  const { le } = p;
  const text = (e?: Entry) => (e ? latin1(e.data).replace(/\0+$/, '').trim() : '');
  const rat = (e: Entry | undefined, i = 0) => {
    if (!e || e.type !== 5 || e.size < (i + 1) * 8) return NaN;
    const d = u32(e.data, i * 8 + 4, le);
    return d ? u32(e.data, i * 8, le) / d : NaN;
  };
  const num = (e?: Entry) => (e && (e.type === 3 ? u16(e.data, 0, le) : e.type === 4 ? u32(e.data, 0, le) : NaN));
  const out: Field[] = [];
  const add = (key: string, label: string, value: string | undefined | false | number) => {
    if (value === undefined || value === false || value === '' || (typeof value === 'number' && Number.isNaN(value))) return;
    out.push({ key, label, value: String(value) });
  };
  const i0 = p.ifd0;
  const ex = p.exif;
  add('make', 'Camera make', text(find(i0, 0x010f)));
  add('model', 'Camera model', text(find(i0, 0x0110)));
  add('lens', 'Lens', text(find(ex, 0xa434)));
  add('bodySerial', 'Camera serial number', text(find(ex, 0xa431)));
  add('lensSerial', 'Lens serial number', text(find(ex, 0xa435)));
  add('owner', 'Owner name', text(find(ex, 0xa430)));
  const et = rat(find(ex, 0x829a));
  add('shutter', 'Shutter speed', Number.isFinite(et) && et > 0 && (et < 1 ? `1/${Math.round(1 / et)} s` : `${et} s`));
  const fn = rat(find(ex, 0x829d));
  add('aperture', 'Aperture', Number.isFinite(fn) && `f/${fn.toFixed(1)}`);
  const iso = num(find(ex, 0x8827));
  add('iso', 'ISO', typeof iso === 'number' && iso);
  const fl = rat(find(ex, 0x920a));
  add('focal', 'Focal length', Number.isFinite(fl) && `${Math.round(fl)} mm`);
  add('dateTaken', 'Date taken', text(find(ex, 0x9003)));
  add('dateModified', 'Date modified', text(find(i0, 0x0132)));
  add('software', 'Software', text(find(i0, 0x0131)));
  add('makernote', 'Manufacturer data', find(ex, 0x927c) && 'present');
  add('artist', 'Artist', text(find(i0, 0x013b)));
  add('copyright', 'Copyright', text(find(i0, 0x8298)));
  const o = find(i0, 0x0112);
  return {
    gps: !!p.gps && p.gps.entries.length > 0,
    fields: out,
    thumbnail: i0.next !== 0,
    orientation: o && o.type === 3 ? u16(o.data, 0, le) : undefined,
  };
}

export function summarize(b: Uint8Array): Summary {
  const { segs, scanEnd } = parseJpeg(b);
  const exifSeg = segs.find((s) => isExif(b, s));
  const tiff = exifSeg ? parseTiff(exifOf(b, exifSeg)) : null;
  return {
    gps: false,
    fields: [],
    thumbnail: false,
    ...(tiff ? summarizeTiff(tiff) : {}),
    xmp: segs.some((s) => isXmp(b, s)),
    iptc: segs.some((s) => s.marker === 0xed),
    comment: segs.some((s) => s.marker === 0xfe),
    trailing: b.length > scanEnd,
    icc: segs.some((s) => isIcc(b, s)),
  };
}

// ---------- EXIF editing ----------

interface OutEntry {
  tag: number;
  type: number;
  count: number;
  data: Uint8Array;
}

/** Write a fresh, minimal TIFF block (same byte order as the source, so raw values copy over as-is). */
function buildTiff(le: boolean, ifd0: OutEntry[], exif: OutEntry[], gps: OutEntry[]): Uint8Array {
  const ifdSize = (n: number) => 2 + n * 12 + 4;
  const ifd0All = [...ifd0];
  if (exif.length) ifd0All.push({ tag: 0x8769, type: 4, count: 1, data: new Uint8Array(4) });
  if (gps.length) ifd0All.push({ tag: 0x8825, type: 4, count: 1, data: new Uint8Array(4) });
  const sorted = (l: OutEntry[]) => [...l].sort((a, b) => a.tag - b.tag);
  const blocks = [sorted(ifd0All), sorted(exif), sorted(gps)];

  const exifOff = 8 + ifdSize(blocks[0].length);
  const gpsOff = exifOff + (exif.length ? ifdSize(exif.length) : 0);
  let cursor = gpsOff + (gps.length ? ifdSize(gps.length) : 0);
  const dataAt = new Map<OutEntry, number>();
  for (const block of blocks)
    for (const e of block)
      if (e.data.length > 4) {
        dataAt.set(e, cursor);
        cursor += e.data.length + (e.data.length & 1);
      }

  const out = new Uint8Array(cursor);
  out[0] = out[1] = le ? 0x49 : 0x4d;
  put16(out, 2, 42, le);
  put32(out, 4, 8, le);
  const starts = [8, exifOff, gpsOff];
  blocks.forEach((block, bi) => {
    if (!block.length) return;
    put16(out, starts[bi], block.length, le);
    block.forEach((e, i) => {
      const o = starts[bi] + 2 + i * 12;
      put16(out, o, e.tag, le);
      put16(out, o + 2, e.type, le);
      put32(out, o + 4, e.count, le);
      if (e.tag === 0x8769 && bi === 0) put32(out, o + 8, exifOff, le);
      else if (e.tag === 0x8825 && bi === 0) put32(out, o + 8, gpsOff, le);
      else if (e.data.length <= 4) out.set(e.data, o + 8);
      else {
        put32(out, o + 8, dataAt.get(e)!, le);
        out.set(e.data, dataAt.get(e)!);
      }
    });
  });
  return out;
}

const copyOf = (e: Entry): OutEntry => ({ tag: e.tag, type: e.type, count: e.count, data: e.data.slice() });

/** New EXIF payload for "remove camera info", or null if nothing is worth keeping. */
function rebuildExif(p: Tiff, opts: StripOptions, hasIcc: boolean): Uint8Array | null {
  const keep = (ifd: Ifd | null, tags: number[]) => (ifd?.entries ?? []).filter((e) => tags.includes(e.tag)).map(copyOf);
  const ifd0 = keep(p.ifd0, opts.keepCredit ? [0x0112, 0x013b, 0x8298] : [0x0112]);
  // Colour space flag is only worth keeping when there is no ICC profile to say the same thing.
  const exif = hasIcc ? [] : keep(p.exif, [0xa001]);
  const gps = opts.gps ? [] : (p.gps?.entries ?? []).map(copyOf);
  if (!ifd0.length && !exif.length && !gps.length) return null;
  return buildTiff(p.le, ifd0, exif, gps);
}

/** Empty the GPS block without moving anything else, so every other offset in EXIF stays valid. */
function zeroGps(p: Tiff) {
  if (!p.gpsPtr || !p.gps) return;
  const off = u32(p.gpsPtr.data, 0, p.le);
  const n = u16(p.t, off, p.le);
  for (const e of p.gps.entries) if (e.size > 4) p.t.fill(0, e.dataOff, e.dataOff + e.size);
  p.t.fill(0, off, off + 2 + n * 12 + 4); // entry count becomes 0, no next IFD
}

function exifSegment(tiff: Uint8Array): Uint8Array {
  const len = 2 + 6 + tiff.length;
  const out = new Uint8Array(2 + len);
  out[0] = 0xff;
  out[1] = 0xe1;
  put16(out, 2, len, false);
  out.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4);
  out.set(tiff, 10);
  return out;
}

// ---------- main entry ----------

export function stripMetadata(input: Uint8Array, opts: StripOptions): StripResult {
  if (!opts.gps && !opts.camera) throw new Error('Choose at least one thing to remove');
  const { segs, scanStart, scanEnd } = parseJpeg(input);
  const before = summarize(input);
  const warnings: string[] = [];

  const parts: Uint8Array[] = [input.subarray(0, 2)];
  for (const s of segs) {
    if (isExif(input, s)) {
      let replacement: Uint8Array | null = null;
      try {
        const tiff = parseTiff(exifOf(input, s));
        if (!tiff) throw new Error('unreadable EXIF');
        if (opts.camera) {
          const fresh = rebuildExif(tiff, opts, segs.some((x) => isIcc(input, x)));
          replacement = fresh && exifSegment(fresh);
        } else {
          const copy = tiff.t.slice(); // GPS only: edit a copy in place
          const edited = parseTiff(copy)!;
          zeroGps(edited);
          replacement = exifSegment(copy);
        }
      } catch {
        warnings.push("This file's EXIF data couldn't be read safely, so all of it was removed instead (the photo's rotation tag may be lost).");
      }
      if (replacement) parts.push(replacement);
    } else if (keepSegment(input, s)) {
      parts.push(input.subarray(s.start, s.end));
    }
  }
  const scan = input.subarray(scanStart, scanEnd);
  parts.push(scan);
  const bytes = concat(parts);

  const after = summarize(bytes);
  const reparsed = parseJpeg(bytes);
  const scanIdentical = same(scan, bytes.subarray(reparsed.scanStart, reparsed.scanEnd));
  const credit = ['artist', 'copyright'];
  const leftovers = after.fields.filter((f) => !(opts.keepCredit && credit.includes(f.key)));
  const verified =
    scanIdentical &&
    (!opts.gps || !after.gps) &&
    (!opts.camera || leftovers.length === 0) &&
    !after.xmp &&
    !after.iptc &&
    !after.comment &&
    !after.trailing;
  return { bytes, before, after, scanIdentical, verified, warnings };
}
