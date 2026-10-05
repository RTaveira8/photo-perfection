export interface CompareOptions {
  name: string;
  originalUrl: string;
  outputUrl: string;
  originalSize: string;
  outputSize: string;
  outputLabel: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Full-screen before/after slider. A transparent range input drives the divider. */
export function openCompare(o: CompareOptions) {
  const opener = document.activeElement as HTMLElement | null;
  const dlg = document.createElement('div');
  dlg.className = 'modal';
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  dlg.setAttribute('aria-label', `Compare ${o.name}`);
  dlg.innerHTML = `
    <div class="modal-bar">
      <b>${esc(o.name)}</b>
      <button class="close" aria-label="Close">✕</button>
    </div>
    <div class="stage" style="--pos:50">
      <img class="after" src="${o.outputUrl}" alt="${esc(o.outputLabel)} version" draggable="false" />
      <img class="before" src="${o.originalUrl}" alt="Original version" draggable="false" />
      <span class="label l">Original · ${o.originalSize}</span>
      <span class="label r">${esc(o.outputLabel)} · ${o.outputSize}</span>
      <div class="divider"><span class="knob">‹ ›</span></div>
      <input class="range" type="range" min="0" max="100" step="0.1" value="50" aria-label="Comparison position" />
    </div>
    <p class="modal-hint">Drag, or use the arrow keys, to compare. Zoom in your browser to inspect fine detail.</p>`;

  const stage = dlg.querySelector<HTMLElement>('.stage')!;
  const range = dlg.querySelector<HTMLInputElement>('.range')!;
  range.oninput = () => stage.style.setProperty('--pos', range.value);

  const close = () => {
    document.removeEventListener('keydown', onKey);
    dlg.remove();
    document.body.classList.remove('modal-open');
    opener?.focus();
  };
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  dlg.querySelector<HTMLElement>('.close')!.onclick = close;
  dlg.addEventListener('click', (e) => e.target === dlg && close());

  document.body.classList.add('modal-open');
  document.body.append(dlg);
  range.focus();
}
