import './style.css';
import { compressInWorker } from './lib/client';
import { PRESETS } from './lib/presets';

const fmt = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const app = document.getElementById('app')!;
app.innerHTML = `
  <h1>Photo Perfection</h1>
  <p class="sub">Shrink photos without making them look worse. Everything stays in your browser. Location data is removed.</p>
  <label id="drop">Drop photos here or <u>choose files</u>
    <input id="file" type="file" accept="image/*" multiple hidden />
  </label>
  <div id="results"></div>`;

const results = document.getElementById('results')!;
const input = document.getElementById('file') as HTMLInputElement;
const drop = document.getElementById('drop')!;

async function handle(files: FileList | File[]) {
  for (const file of Array.from(files).filter((f) => f.type.startsWith('image/'))) {
    const name = esc(file.name);
    const row = document.createElement('section');
    row.innerHTML = `<h2>${name}</h2><p>Working…</p>`;
    results.prepend(row);
    try {
      const r = await compressInWorker(file, PRESETS);
      const cards = r.outputs.map((o) => {
        const url = URL.createObjectURL(o.blob);
        const saved = Math.round((1 - o.blob.size / r.original.bytes) * 100);
        const base = esc(file.name.replace(/\.[^.]+$/, ''));
        return `<figure><img src="${url}" alt="" />
          <figcaption>${o.preset.label} · ${o.width}×${o.height} · ${fmt(o.blob.size)} (−${saved}%)
          <a href="${url}" download="${o.preset.id}-${base}.jpg">Download</a></figcaption></figure>`;
      });
      row.innerHTML = `<h2>${name}</h2>
        <p>Original · ${r.original.width}×${r.original.height} · ${fmt(r.original.bytes)} · metadata removed</p>
        <div class="grid">${cards.join('')}</div>`;
    } catch (e) {
      row.innerHTML = `<h2>${name}</h2><p class="err">Failed: ${esc((e as Error).message)}</p>`;
    }
  }
}

input.onchange = () => input.files && handle(input.files);
drop.ondragover = (e) => e.preventDefault();
drop.ondrop = (e) => {
  e.preventDefault();
  if (e.dataTransfer) handle(e.dataTransfer.files);
};
