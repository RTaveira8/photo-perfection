import './style.css';
import { compressInWorker } from './lib/client';
import { PRESETS } from './lib/presets';

const fmt = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const icon = {
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><path d="M4 4l16 16"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z"/></svg>`,
  down: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>`,
};

const app = document.getElementById('app')!;
app.innerHTML = `
  <div class="glow" aria-hidden="true"></div>
  <header class="nav">
    <div class="brand"><span class="mark"></span>Shred</div>
    <span class="nav-note">${icon.lock} Processed on your device</span>
  </header>

  <main>
    <section class="hero">
      <p class="eyebrow">Image optimization</p>
      <h1>Smaller photos.<br /><em>Nothing lost</em> to the eye.</h1>
      <p class="lede">Cut file sizes by up to 97% with no visible difference, and strip hidden location data, all without a single upload.</p>
    </section>

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
    <div id="results" class="results"></div>
  </main>

  <footer class="foot">Shred · Your photos stay yours.</footer>`;

const results = document.getElementById('results')!;
const summary = document.getElementById('summary')!;
const input = document.getElementById('file') as HTMLInputElement;
const drop = document.getElementById('drop')!;

const totals = { files: 0, before: 0, after: 0 };

function updateSummary() {
  if (!totals.files) return;
  const saved = Math.round((1 - totals.after / totals.before) * 100);
  summary.hidden = false;
  summary.innerHTML = `
    <div><b>${totals.files}</b><span>${totals.files === 1 ? 'photo' : 'photos'}</span></div>
    <div><b>${fmt(totals.before)}</b><span>before</span></div>
    <div><b>${fmt(totals.after)}</b><span>after (Display)</span></div>
    <div class="accent"><b>−${saved}%</b><span>saved</span></div>`;
}

async function handle(files: FileList | File[]) {
  for (const file of Array.from(files).filter((f) => f.type.startsWith('image/'))) {
    const name = esc(file.name);
    const card = document.createElement('article');
    card.className = 'card loading';
    card.innerHTML = `<div class="thumb skeleton"></div><div class="info"><h2>${name}</h2><p class="meta">Optimizing…</p></div>`;
    results.prepend(card);
    try {
      const r = await compressInWorker(file, PRESETS);
      const base = esc(file.name.replace(/\.[^.]+$/, ''));
      const display = r.outputs[0];
      const previewUrl = URL.createObjectURL(display.blob);
      const rows = r.outputs
        .map((o) => {
          const url = URL.createObjectURL(o.blob);
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
      card.innerHTML = `
        <img class="thumb" src="${previewUrl}" alt="" />
        <div class="info">
          <h2>${name}</h2>
          <p class="meta">Original ${r.original.width} × ${r.original.height} · ${fmt(r.original.bytes)} <span class="tag">${icon.pin} Location data removed</span></p>
          <ul class="outputs">${rows}</ul>
        </div>`;
      totals.files++;
      totals.before += r.original.bytes;
      totals.after += display.blob.size;
      updateSummary();
    } catch (e) {
      card.className = 'card';
      card.innerHTML = `<div class="info"><h2>${name}</h2><p class="meta err">Couldn't process this file: ${esc((e as Error).message)}</p></div>`;
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
