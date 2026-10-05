import { zipSync } from 'fflate';
import { NotJpegError, stripMetadata, type StripOptions, type Summary } from './lib/strip';
import { esc, fmt, icon, limitBatch, batchSoon } from './ui-utils';
import { FEATURES } from './config';

interface Row {
  label: string;
  value: string;
  removed: boolean;
}

/** Everything that was in the file before, and whether it survived. Computed from the real before/after scans. */
function rowsFor(before: Summary, after: Summary): Row[] {
  const rows: Row[] = [];
  if (before.gps) rows.push({ label: 'GPS location', value: 'present', removed: !after.gps });
  for (const f of before.fields) rows.push({ label: f.label, value: f.value, removed: !after.fields.some((x) => x.key === f.key) });
  const flags: [keyof Summary, string][] = [
    ['thumbnail', 'Embedded preview image'],
    ['xmp', 'XMP data (e.g. editing history)'],
    ['iptc', 'IPTC / captions'],
    ['comment', 'Comments'],
    ['trailing', 'Extra data after the image'],
  ];
  for (const [k, label] of flags) if (before[k]) rows.push({ label, value: 'present', removed: !after[k] });
  return rows;
}

interface Rec {
  name: string;
  blob: Blob;
  url: string;
}

export function mountStrip(root: HTMLElement) {
  root.innerHTML = `
    <section class="hero">
      <p class="eyebrow">For professionals</p>
      <h1>Strip the data.<br /><em>Keep every pixel.</em></h1>
      <p class="lede">Remove GPS and camera details from your JPEGs without recompressing or resizing. The image data is left byte-for-byte untouched, so there is no quality loss at all.</p>
    </section>

    <div class="opts" role="group" aria-label="What to remove">
      <label class="opt-card"><input type="checkbox" id="st-gps" checked />
        <div><b>GPS location</b><span>Coordinates showing where the photo was taken</span></div></label>
      <label class="opt-card"><input type="checkbox" id="st-cam" checked />
        <div><b>Camera &amp; settings</b><span>Make, model, lens, serial numbers, shutter, aperture, ISO, dates, software</span></div></label>
      <label class="opt-card"><input type="checkbox" id="st-credit" checked />
        <div><b>Keep copyright &amp; credit</b><span>Leave the Artist and Copyright fields in place</span></div></label>
    </div>
    <p id="st-note" class="mode-note"></p>

    <label id="st-drop" class="drop" tabindex="0">
      <input id="st-file" type="file" accept="image/jpeg,.jpg,.jpeg" ${FEATURES.batch ? 'multiple' : ''} hidden />
      <span class="drop-icon">${icon.shield}</span>
      <span class="drop-title">Drop your JPEGs here</span>
      <span class="drop-sub">or <u>browse your files</u> · JPEG only for now</span>
      ${batchSoon}
    </label>
    <p id="st-batch-note" class="batch-note" hidden></p>

    <ul class="features">
      <li>${icon.shield}<div><b>Lossless</b><span>No re-encoding. The picture data is copied as-is.</span></div></li>
      <li>${icon.pin}<div><b>Verified</b><span>Each file is re-read to prove the data is gone.</span></div></li>
      <li>${icon.lock}<div><b>100% private</b><span>Files never leave your browser.</span></div></li>
    </ul>

    <div id="st-actions" class="actions" hidden>
      <button id="st-clear" class="ghost" type="button">Clear all</button>
      <button id="st-zip" class="zip" type="button">${icon.down}<span></span></button>
    </div>
    <div id="st-results" class="results"></div>`;

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const gpsEl = $<HTMLInputElement>('st-gps');
  const camEl = $<HTMLInputElement>('st-cam');
  const creditEl = $<HTMLInputElement>('st-credit');
  const note = $('st-note');
  const drop = $('st-drop');
  const input = $<HTMLInputElement>('st-file');
  const results = $('st-results');
  const actions = $('st-actions');
  const zipBtn = $<HTMLButtonElement>('st-zip');

  const read = (): StripOptions => ({ gps: gpsEl.checked, camera: camEl.checked, keepCredit: creditEl.checked });

  function syncNote() {
    const o = read();
    creditEl.disabled = !o.camera;
    creditEl.closest('label')!.classList.toggle('off', !o.camera);
    note.classList.toggle('warn', !o.gps && !o.camera);
    note.textContent = !o.gps && !o.camera
      ? 'Choose at least one thing to remove.'
      : (o.camera
          ? 'Camera details are removed completely. Orientation and the colour profile are kept so the photo still looks right.'
          : 'Camera settings stay in the file. Only the location is removed.') +
        ' XMP (such as Lightroom edit history), IPTC captions, comments and any data after the image are always removed.';
  }
  [gpsEl, camEl, creditEl].forEach((el) => (el.onchange = syncNote));
  syncNote();

  const records = new Map<HTMLElement, Rec>();
  function updateActions() {
    actions.hidden = !records.size || !FEATURES.batch; // ZIP-all / Clear all are batch features
    const n = records.size;
    zipBtn.querySelector('span')!.textContent = `Download all as ZIP (${n} ${n === 1 ? 'file' : 'files'})`;
  }
  function removeCard(card: HTMLElement) {
    const r = records.get(card);
    if (r) URL.revokeObjectURL(r.url);
    records.delete(card);
    card.remove();
    updateActions();
  }
  const removeBtn = `<button class="remove" type="button" aria-label="Remove this photo" title="Remove">${icon.close}</button>`;

  async function handle(files: FileList | File[]) {
    const opts = read(); // snapshot so changing a checkbox mid-batch doesn't affect queued files
    if (!opts.gps && !opts.camera) return syncNote();
    for (const file of limitBatch(Array.from(files), $('st-batch-note'))) {
      const name = esc(file.name);
      const card = document.createElement('article');
      card.className = 'card loading';
      card.innerHTML = `<div class="thumb skeleton"></div><div class="info"><h2>${name}</h2><p class="meta">Stripping…</p></div>`;
      results.prepend(card);
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const r = stripMetadata(bytes, opts);
        const blob = new Blob([r.bytes as BlobPart], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        const stem = file.name.replace(/\.[^.]+$/, '');
        const rows = rowsFor(r.before, r.after);
        const removed = rows.filter((x) => x.removed).length;
        const kept = rows.length - removed;
        const keeps = [r.after.orientation ? 'Orientation' : '', r.after.icc ? 'Colour profile' : '', r.after.fields.some((f) => f.key === 'artist' || f.key === 'copyright') ? 'Credit' : '']
          .filter(Boolean)
          .join(' · ');
        const saved = bytes.length - r.bytes.length;
        card.className = 'card strip';
        card.innerHTML = `
          <img class="thumb" src="${url}" alt="" />
          <div class="info">
            <h2>${name}</h2>
            <p class="meta">${fmt(bytes.length)} → ${fmt(r.bytes.length)}${saved > 0 ? ` (−${fmt(saved)})` : ''}
              <span class="tag ${r.verified ? '' : 'bad'}">${r.verified ? `${icon.shield} Image data unchanged · verified` : '⚠ Check this file'}</span></p>
            ${opts.gps && !r.before.gps ? '<p class="meta">No GPS location data was found in this file.</p>' : ''}
            ${r.warnings.map((w) => `<p class="meta err">${esc(w)}</p>`).join('')}
            <p class="applied"><span><b>Removed</b>${removed ? `${removed} ${removed === 1 ? 'item' : 'items'}` : 'nothing found, already clean'}</span>${keeps ? `<span><b>Kept</b>${keeps}</span>` : ''}</p>
            ${
              rows.length
                ? `<details class="detail"><summary>What was in this file <span>${removed} removed${kept ? ` · ${kept} kept` : ''}</span></summary>
              <ul class="meta-list">${rows
                .map((x) => `<li class="${x.removed ? 'gone' : 'stay'}"><span>${esc(x.label)}</span><em>${esc(x.value)}</em><b>${x.removed ? 'Removed' : 'Kept'}</b></li>`)
                .join('')}</ul></details>`
                : ''
            }
            <a class="zip dl" href="${url}" download="${esc(stem)}-clean.jpg">${icon.down}<span>Download clean file</span></a>
          </div>
          ${removeBtn}`;
        card.querySelector<HTMLElement>('.remove')!.onclick = () => removeCard(card);
        records.set(card, { name: `${stem}-clean.jpg`, blob, url });
        updateActions();
      } catch (e) {
        card.className = 'card';
        const msg = e instanceof NotJpegError ? 'Only JPEG files are supported for now (PNG and others are coming later).' : `Couldn't process this file: ${(e as Error).message}`;
        card.innerHTML = `<div class="info"><h2>${name}</h2><p class="meta err">${esc(msg)}</p></div>${removeBtn}`;
        card.querySelector<HTMLElement>('.remove')!.onclick = () => removeCard(card);
      }
    }
  }

  zipBtn.onclick = async () => {
    zipBtn.disabled = true;
    try {
      const files: Record<string, Uint8Array> = {};
      const seen = new Map<string, number>();
      for (const { name, blob } of records.values()) {
        const n = seen.get(name) ?? 0;
        seen.set(name, n + 1);
        files[n ? name.replace(/\.jpg$/, `-${n + 1}.jpg`) : name] = new Uint8Array(await blob.arrayBuffer());
      }
      const zip = zipSync(files, { level: 0 }); // JPEGs are already compressed
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
      Object.assign(document.createElement('a'), { href: url, download: 'pixel-lite-clean-photos.zip' }).click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      zipBtn.disabled = false;
    }
  };
  $<HTMLButtonElement>('st-clear').onclick = () => {
    [...records.keys()].forEach(removeCard);
    results.querySelectorAll<HTMLElement>('.card:not(.loading)').forEach((c) => c.remove());
  };

  input.onchange = () => {
    if (input.files) void handle(input.files);
    input.value = '';
  };
  drop.onkeydown = (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.click());
  ['dragenter', 'dragover'].forEach((t) =>
    drop.addEventListener(t, (e) => {
      e.preventDefault();
      drop.classList.add('over');
    }),
  );
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    if ((e as DragEvent).dataTransfer) void handle((e as DragEvent).dataTransfer!.files);
  });
}
