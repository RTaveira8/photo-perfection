import './style.css';
import { compressInWorker } from './lib/client';
import { BASIC, SOCIAL } from './lib/presets';
import { openCompare } from './compare';
import { zipSync } from 'fflate';
import { FILTERS } from './lib/filters';

const fmt = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const icon = {
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><path d="M4 4l16 16"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z"/></svg>`,
  compare: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14M8 10l-2 2 2 2M16 10l2 2-2 2"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  down: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>`,
};

// Finishing touches. Slider value -> effect amount via `scale`. All default to off, except
// Sharpen, which defaults to the selected preset's recommendation.
const EXTRAS = [
  { id: 'sharpen', label: 'Sharpen', min: 0, max: 100, scale: 1 / 200 },
  { id: 'clarity', label: 'Clarity', min: 0, max: 100, scale: 1 / 100 },
  { id: 'warmth', label: 'Warmth', min: -100, max: 100, scale: 1 / 100 },
  { id: 'tint', label: 'Tint', min: -100, max: 100, scale: 1 / 100 },
  { id: 'grain', label: 'Grain', min: 0, max: 100, scale: 1 / 100 },
] as const;
type ExtraId = (typeof EXTRAS)[number]['id'];

const app = document.getElementById('app')!;
app.innerHTML = `
  <div class="glow" aria-hidden="true"></div>
  <header class="nav">
    <div class="brand"><span class="mark"></span>PixelLite</div>
    <span class="nav-note">${icon.lock} Processed on your device</span>
  </header>

  <main>
    <section class="hero">
      <p class="eyebrow">Image optimization</p>
      <h1>Smaller photos.<br /><em>Nothing lost</em> to the eye.</h1>
      <p class="lede">Cut file sizes by up to 97% with no visible difference, and strip hidden location data, all without a single upload.</p>
    </section>

    <div class="modes two" role="radiogroup" aria-label="Compression type">
      <button class="mode on" role="radio" aria-checked="true" data-mode="basic"><b>Basic compression</b><span>${BASIC.blurb}</span></button>
      <button class="mode" role="radio" aria-checked="false" data-mode="social"><b>Social</b><span>Facebook, Instagram, TikTok</span></button>
    </div>
    <div id="platforms" class="modes sub" role="radiogroup" aria-label="Platform" hidden>
      ${SOCIAL.map(
        (t) => `<button class="mode" role="radio" aria-checked="false" data-target="${t.preset.id}"><b>${t.preset.label}</b><span>${t.blurb}</span></button>`,
      ).join('')}
    </div>
    <p id="mode-note" class="mode-note"></p>

    <details class="more">
      <summary><b class="more-ttl">More options</b><span id="more-state">All defaults</span></summary>
      <div class="more-body">
    <details class="tune">
      <summary><b class="ttl">Fine-tune <em class="opt">Optional</em></b><span id="tune-state">Using recommended settings</span></summary>
      <div class="tune-body">
        <div class="slider">
          <div class="srow"><label for="q">Quality</label><span id="q-rec" class="rec"></span><b id="q-val"></b></div>
          <input id="q" type="range" min="50" max="100" step="1" />
        </div>
        <div class="slider">
          <div class="srow"><label for="sz">Longest side</label><span id="sz-rec" class="rec"></span><b id="sz-val"></b></div>
          <input id="sz" type="range" min="320" max="4096" step="1" />
        </div>
        <div id="tune-foot" class="tune-foot" hidden>
          <p id="tune-hint" class="tune-hint"></p>
          <button id="tune-reset" class="link" type="button">Reset to recommended</button>
        </div>
      </div>
    </details>

    <details class="tune">
      <summary><b class="ttl">Extras <em class="opt">Optional</em></b><span id="extras-state">None applied</span></summary>
      <div class="tune-body extras">
        ${EXTRAS.map(
          (e) => `<div class="slider">
          <div class="srow"><label for="ex-${e.id}">${e.label}</label><span id="ex-${e.id}-rec" class="rec"></span><b id="ex-${e.id}-val"></b></div>
          <input id="ex-${e.id}" type="range" min="${e.min}" max="${e.max}" step="1" />
        </div>`,
        ).join('')}
        <div id="extras-foot" class="tune-foot" hidden>
          <p id="extras-hint" class="tune-hint"></p>
          <button id="extras-reset" class="link" type="button">Reset extras</button>
        </div>
      </div>
    </details>

    <details class="tune">
      <summary><b class="ttl">Filters <em class="opt">Optional</em></b><span id="filter-state">None</span></summary>
      <div class="tune-body filters">
        <div class="chips" role="radiogroup" aria-label="Filter">
          <button class="chip on" role="radio" aria-checked="true" data-filter="" type="button"><i class="sw none"></i>None</button>
          ${FILTERS.map(
            (f) => `<button class="chip" role="radio" aria-checked="false" data-filter="${f.id}" title="${f.blurb}" type="button"><i class="sw" style="background:${f.swatch}"></i>${f.name}</button>`,
          ).join('')}
        </div>
        <p id="filter-hint" class="tune-hint"></p>
        <div id="filter-amt-row" class="slider" hidden>
          <div class="srow"><label for="filter-amt">Intensity</label><b id="filter-amt-val">100</b></div>
          <input id="filter-amt" type="range" min="0" max="100" step="1" value="100" />
        </div>
      </div>
    </details>
      </div>
    </details>

    <label id="drop" class="drop" tabindex="0">
      <input id="file" type="file" accept="image/*" multiple hidden />
      <span class="drop-icon">${icon.upload}</span>
      <span class="drop-title">Drop your photos here</span>
      <span class="drop-sub">or <u>browse your files</u> · JPEG, PNG, WebP</span>
    </label>

    <ul class="features">
      <li>${icon.lock}<div><b>100% private</b><span>Photos never leave your browser.</span></div></li>
      <li>${icon.pin}<div><b>Metadata removed</b><span>GPS and camera details stripped.</span></div></li>
      <li>${icon.bolt}<div><b>Fast &amp; sharp</b><span>Multi-step resizing keeps detail crisp.</span></div></li>
    </ul>

    <div id="summary" class="summary" hidden></div>
    <div id="actions" class="actions" hidden><button id="clear" class="ghost" type="button">Clear all</button><button id="zip" class="zip">${icon.down}<span></span></button></div>
    <div id="results" class="results"></div>
  </main>

  <footer class="foot">PixelLite · Your photos stay yours.</footer>`;

const results = document.getElementById('results')!;
const summary = document.getElementById('summary')!;
const input = document.getElementById('file') as HTMLInputElement;
const drop = document.getElementById('drop')!;

let target = BASIC;
const modeNote = document.getElementById('mode-note')!;
const platforms = document.getElementById('platforms')!;
const typeBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-mode]'));
const platformBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-target]'));
const mark = (btns: HTMLButtonElement[], on: (b: HTMLButtonElement) => boolean) =>
  btns.forEach((b) => {
    b.classList.toggle('on', on(b));
    b.setAttribute('aria-checked', String(on(b)));
  });
function setTarget(t: typeof BASIC) {
  target = t;
  const social = t !== BASIC;
  mark(typeBtns, (b) => (b.dataset.mode === 'social') === social);
  platforms.hidden = !social;
  mark(platformBtns, (b) => social && b.dataset.target === t.preset.id);
  modeNote.textContent = t.note + ' Applies to photos you add next. Photos are never cropped.';
  resetTune();
  resetExtras();
}

// Fine-tune sliders. Defaults are always the selected target's recommendation.
const qEl = document.getElementById('q') as HTMLInputElement;
const szEl = document.getElementById('sz') as HTMLInputElement;
const tuneState = document.getElementById('tune-state')!;
const tuneHint = document.getElementById('tune-hint')!;
const isCustom = () => +qEl.value !== Math.round(target.preset.quality * 100) || +szEl.value !== target.preset.longEdge;

// Summary on the collapsed "More options" header, so changes are visible without opening it.
function syncMore() {
  const active = [isCustom() && 'Fine-tune', exChanged() && 'Extras', filterId && 'Filter'].filter(Boolean);
  const state = document.getElementById('more-state')!;
  state.textContent = active.length ? active.join(' · ') : 'All defaults';
  state.classList.toggle('custom', active.length > 0);
}

function syncTune() {
  const rec = target.preset;
  document.getElementById('q-val')!.textContent = `${qEl.value}%`;
  document.getElementById('sz-val')!.textContent = `${szEl.value} px`;
  document.getElementById('q-rec')!.textContent = `recommended ${Math.round(rec.quality * 100)}%`;
  document.getElementById('sz-rec')!.textContent = `recommended ${rec.longEdge} px`;
  tuneState.textContent = isCustom() ? 'Custom settings' : 'Using recommended settings';
  tuneState.classList.toggle('custom', isCustom());
  const hints: string[] = [];
  if (+qEl.value < 75) hints.push('Below about 75% quality, smooth gradients (sky, paint) can start to show banding.');
  if (+qEl.value > 95) hints.push('Above 95% gives larger files with little visible gain.');
  if (+szEl.value > 2048 && target !== BASIC) hints.push('Social platforms will shrink anything larger than this themselves.');
  tuneHint.textContent = hints.join(' ');
  document.getElementById('tune-foot')!.hidden = !isCustom() && !hints.length;
  document.getElementById('tune-reset')!.hidden = !isCustom();
  syncMore();
}
function resetTune() {
  qEl.value = String(Math.round(target.preset.quality * 100));
  szEl.value = String(target.preset.longEdge);
  syncTune();
}
qEl.oninput = szEl.oninput = syncTune;
document.getElementById('tune-reset')!.onclick = resetTune;

// Extras sliders
const exEl = (id: ExtraId) => document.getElementById(`ex-${id}`) as HTMLInputElement;
// Extras always start with nothing applied. Social presets add their own light sharpening on top (see currentPreset).
const exRec = (_id: ExtraId) => 0;
const exChanged = () => EXTRAS.some((e) => +exEl(e.id).value !== exRec(e.id));
const signed = (v: number, e: (typeof EXTRAS)[number]) => (e.min < 0 && v > 0 ? `+${v}` : String(v));

function syncExtras() {
  for (const e of EXTRAS) {
    const v = +exEl(e.id).value;
    document.getElementById(`ex-${e.id}-val`)!.textContent = signed(v, e);
    const rec = exRec(e.id);
    document.getElementById(`ex-${e.id}-rec`)!.textContent = rec ? `recommended ${rec}` : e.id === 'sharpen' && target !== BASIC ? 'already includes light sharpening' : '';
  }
  const changed = EXTRAS.filter((e) => +exEl(e.id).value !== exRec(e.id)).length;
  const active = EXTRAS.filter((e) => +exEl(e.id).value).length;
  const state = document.getElementById('extras-state')!;
  state.textContent = changed ? `${changed} adjusted` : active ? 'Using recommended settings' : 'None applied';
  state.classList.toggle('custom', !!changed);
  const hints: string[] = [];
  if (+exEl('grain').value) hints.push('Grain adds texture but makes files larger.');
  if (+exEl('sharpen').value > 60 || +exEl('clarity').value > 70) hints.push('Strong sharpening or clarity can look harsh and exaggerate JPEG artifacts.');
  document.getElementById('extras-hint')!.textContent = hints.join(' ');
  document.getElementById('extras-foot')!.hidden = !changed && !hints.length;
  document.getElementById('extras-reset')!.hidden = !changed;
  syncMore();
}
function resetExtras() {
  for (const e of EXTRAS) exEl(e.id).value = String(exRec(e.id));
  syncExtras();
}
EXTRAS.forEach((e) => (exEl(e.id).oninput = syncExtras));
document.getElementById('extras-reset')!.onclick = resetExtras;

// Filters. A creative choice, so it persists when the mode changes.
let filterId = '';
const filterBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-filter]'));
const amtEl = document.getElementById('filter-amt') as HTMLInputElement;
function syncFilter() {
  const f = FILTERS.find((x) => x.id === filterId);
  filterBtns.forEach((b) => {
    const on = b.dataset.filter === filterId;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  });
  const state = document.getElementById('filter-state')!;
  state.textContent = f ? `${f.name} · ${amtEl.value}%` : 'None';
  state.classList.toggle('custom', !!f);
  document.getElementById('filter-amt-row')!.hidden = !f;
  document.getElementById('filter-hint')!.textContent = f?.params.grain ? 'Includes fine grain, which makes files larger.' : '';
  document.getElementById('filter-amt-val')!.textContent = `${amtEl.value}%`;
  syncMore();
}
filterBtns.forEach((b) => (b.onclick = () => ((filterId = b.dataset.filter!), syncFilter())));
amtEl.oninput = syncFilter;

/** What the user changed from the defaults, shown on each finished card so it's clear what was applied. */
function describeApplied(): { kind: string; text: string }[] {
  const out: { kind: string; text: string }[] = [];
  const parts: string[] = [];
  if (+qEl.value !== Math.round(target.preset.quality * 100)) parts.push(`Quality ${qEl.value}%`);
  if (+szEl.value !== target.preset.longEdge) parts.push(`${szEl.value} px`);
  if (parts.length) out.push({ kind: 'Fine-tune', text: parts.join(' · ') });
  const extras = EXTRAS.filter((e) => +exEl(e.id).value).map((e) => `${e.label} ${signed(+exEl(e.id).value, e)}`);
  if (extras.length) out.push({ kind: 'Extras', text: extras.join(' · ') });
  const f = FILTERS.find((x) => x.id === filterId);
  if (f) out.push({ kind: 'Filter', text: `${f.name} ${amtEl.value}%` });
  return out;
}

function currentPreset() {
  if (!isCustom() && !exChanged() && !filterId) return target.preset;
  const fx = Object.fromEntries(EXTRAS.map((e) => [e.id, +exEl(e.id).value * e.scale]));
  fx.sharpen += target.preset.sharpen ?? 0;
  return { ...target.preset, ...fx, filter: filterId || undefined, filterAmount: +amtEl.value / 100, quality: +qEl.value / 100, longEdge: +szEl.value };
}
typeBtns.forEach((b) => (b.onclick = () => setTarget(b.dataset.mode === 'social' ? SOCIAL[0] : BASIC)));
platformBtns.forEach((b) => (b.onclick = () => setTarget(SOCIAL.find((t) => t.preset.id === b.dataset.target)!)));
setTarget(BASIC);

// One record per finished card, so removing a card cleanly removes its share of the totals and the ZIP.
interface Rec { before: number; after: number; zip: { name: string; blob: Blob }[]; urls: string[] }
const records = new Map<HTMLElement, Rec>();
const zipItems = () => [...records.values()].flatMap((r) => r.zip);

function removeCard(card: HTMLElement) {
  records.get(card)?.urls.forEach((u) => URL.revokeObjectURL(u));
  records.delete(card);
  card.remove();
  updateSummary();
}
const actions = document.getElementById('actions')!;
const zipBtn = document.getElementById('zip') as HTMLButtonElement;

(document.getElementById('clear') as HTMLButtonElement).onclick = () => {
  [...records.keys()].forEach(removeCard);
  results.querySelectorAll<HTMLElement>('.card:not(.loading)').forEach((c) => c.remove());
};

zipBtn.onclick = async () => {
  zipBtn.disabled = true;
  try {
    const files: Record<string, Uint8Array> = {};
    const seen = new Map<string, number>();
    for (const { name, blob } of zipItems()) {
      const n = seen.get(name) ?? 0;
      seen.set(name, n + 1);
      const unique = n ? name.replace(/\.jpg$/, `-${n + 1}.jpg`) : name;
      files[unique] = new Uint8Array(await blob.arrayBuffer());
    }
    // JPEGs are already compressed, so store them (level 0) rather than waste time deflating.
    const zip = zipSync(files, { level: 0 });
    const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'pixellite-photos.zip' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } finally {
    zipBtn.disabled = false;
  }
};

function updateSummary() {
  const recs = [...records.values()];
  summary.hidden = actions.hidden = !recs.length;
  if (!recs.length) return;
  const totals = { files: recs.length, before: recs.reduce((n, r) => n + r.before, 0), after: recs.reduce((n, r) => n + r.after, 0) };
  const saved = Math.round((1 - totals.after / totals.before) * 100);
  const count = zipItems().length;
  zipBtn.querySelector('span')!.textContent = `Download all as ZIP (${count} ${count === 1 ? 'file' : 'files'})`;
  summary.innerHTML = `
    <div><b>${totals.files}</b><span>${totals.files === 1 ? 'photo' : 'photos'}</span></div>
    <div><b>${fmt(totals.before)}</b><span>before</span></div>
    <div><b>${fmt(totals.after)}</b><span>after</span></div>
    <div class="accent"><b>−${saved}%</b><span>saved</span></div>`;
}

const removeBtn = `<button class="remove" type="button" aria-label="Remove this photo" title="Remove">${icon.close}</button>`;

async function handle(files: FileList | File[]) {
  // Snapshot the settings once, so changing a slider mid-batch does not affect queued photos.
  const preset = currentPreset();
  const applied = describeApplied();
  for (const file of Array.from(files).filter((f) => f.type.startsWith('image/'))) {
    const name = esc(file.name);
    const card = document.createElement('article');
    card.className = 'card loading';
    card.innerHTML = `<div class="thumb skeleton"></div><div class="info"><h2>${name}</h2><p class="meta">Optimizing…</p></div>`;
    results.prepend(card);
    try {
      const r = await compressInWorker(file, [preset]);
      const base = esc(file.name.replace(/\.[^.]+$/, ''));
      const display = r.outputs[0];
      const previewUrl = URL.createObjectURL(display.blob);
      const urls = [previewUrl];
      const appliedHtml = applied.length
        ? `<p class="applied">${applied.map((a) => `<span><b>${a.kind}</b>${esc(a.text)}</span>`).join('')}</p>`
        : '';
      const rows = r.outputs
        .map((o) => {
          const url = URL.createObjectURL(o.blob);
          urls.push(url);
          const saved = Math.round((1 - o.blob.size / r.original.bytes) * 100);
          return `<li>
            <div class="row-main"><b>${o.preset.label}</b><span>${o.width} × ${o.height}</span></div>
            <span class="size">${fmt(o.blob.size)}</span>
            <span class="pill">−${saved}%</span>
            <a class="btn" href="${url}" download="${o.preset.id}-${base}.jpg" aria-label="Download ${o.preset.label}">${icon.down}</a>
          </li>`;
        })
        .join('');
      card.className = 'card';
      const originalUrl = URL.createObjectURL(file);
      urls.push(originalUrl);
      card.innerHTML = `
        <button class="thumb-btn" aria-label="Compare before and after">
          <img class="thumb" src="${previewUrl}" alt="" />
          <span class="thumb-cta">${icon.compare} Compare</span>
        </button>
        <div class="info">
          <h2>${name}</h2>
          <p class="meta">Original ${r.original.width} × ${r.original.height} · ${fmt(r.original.bytes)} <span class="tag">${icon.pin} Location data removed</span></p>
          ${appliedHtml}
          <ul class="outputs">${rows}</ul>
        </div>
        ${removeBtn}`;
      card.querySelector<HTMLElement>('.remove')!.onclick = () => removeCard(card);
      card.querySelector<HTMLElement>('.thumb-btn')!.onclick = () =>
        openCompare({
          name: file.name,
          originalUrl,
          outputUrl: previewUrl,
          originalSize: fmt(r.original.bytes),
          outputSize: fmt(display.blob.size),
          outputLabel: display.preset.label,
        });
      const stem = file.name.replace(/\.[^.]+$/, '');
      records.set(card, {
        before: r.original.bytes,
        after: display.blob.size,
        zip: r.outputs.map((o) => ({ name: `${stem}-${o.preset.id}.jpg`, blob: o.blob })),
        urls,
      });
      updateSummary();
    } catch (e) {
      card.className = 'card';
      card.innerHTML = `<div class="info"><h2>${name}</h2><p class="meta err">Couldn't process this file: ${esc((e as Error).message)}</p></div>${removeBtn}`;
      card.querySelector<HTMLElement>('.remove')!.onclick = () => removeCard(card);
    }
  }
}

input.onchange = () => {
  if (input.files) handle(input.files);
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
  if (e.dataTransfer) handle(e.dataTransfer.files);
});
