export interface CompareOptions {
  name: string;
  originalUrl: string;
  outputUrl: string;
  originalSize: string;
  outputSize: string;
  outputLabel: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Full-screen before/after viewer with two modes:
 *  - Slider: a transparent range input drives a divider between the two images.
 *  - Flip: the whole image swaps between Original and Result (click, Space or arrow keys).
 */
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
      <div class="seg" role="radiogroup" aria-label="Compare mode">
        <button class="on" role="radio" aria-checked="true" data-view="slider" type="button">Slider</button>
        <button role="radio" aria-checked="false" data-view="flip" type="button">Flip</button>
      </div>
      <button class="close" aria-label="Close">✕</button>
    </div>
    <div class="stage" style="--pos:50" data-show="before">
      <img class="after" src="${o.outputUrl}" alt="${esc(o.outputLabel)} version" draggable="false" />
      <img class="before" src="${o.originalUrl}" alt="Original version" draggable="false" />
      <span class="label l">Original · ${o.originalSize}</span>
      <span class="label r">${esc(o.outputLabel)} · ${o.outputSize}</span>
      <div class="divider"><span class="knob">‹ ›</span></div>
      <input class="range" type="range" min="0" max="100" step="0.1" value="50" aria-label="Comparison position" />
    </div>
    <div class="flipbar" hidden>
      <div class="seg" role="radiogroup" aria-label="Showing">
        <button class="on" role="radio" aria-checked="true" data-show="before" type="button">Original · ${o.originalSize}</button>
        <button role="radio" aria-checked="false" data-show="after" type="button">${esc(o.outputLabel)} · ${o.outputSize}</button>
      </div>
    </div>
    <p class="modal-hint"></p>`;

  const stage = dlg.querySelector<HTMLElement>('.stage')!;
  const range = dlg.querySelector<HTMLInputElement>('.range')!;
  const flipbar = dlg.querySelector<HTMLElement>('.flipbar')!;
  const hint = dlg.querySelector<HTMLElement>('.modal-hint')!;
  const viewBtns = Array.from(dlg.querySelectorAll<HTMLButtonElement>('[data-view]'));
  const showBtns = Array.from(flipbar.querySelectorAll<HTMLButtonElement>('[data-show]'));
  let mode: 'slider' | 'flip' = 'slider';

  range.oninput = () => stage.style.setProperty('--pos', range.value);

  const mark = (btns: HTMLButtonElement[], on: (b: HTMLButtonElement) => boolean) =>
    btns.forEach((b) => {
      b.classList.toggle('on', on(b));
      b.setAttribute('aria-checked', String(on(b)));
    });

  const show = (which: 'before' | 'after') => {
    stage.dataset.show = which;
    mark(showBtns, (b) => b.dataset.show === which);
  };
  const setMode = (m: 'slider' | 'flip') => {
    mode = m;
    stage.classList.toggle('flip', m === 'flip');
    flipbar.hidden = m !== 'flip';
    mark(viewBtns, (b) => b.dataset.view === m);
    hint.textContent =
      m === 'slider'
        ? 'Drag, or use the arrow keys, to compare. Zoom in your browser to inspect fine detail.'
        : 'Click the image, press Space, or use the buttons to flip between the two. Flipping in place makes small differences easier to spot.';
    if (m === 'flip') show('before');
    else range.focus();
  };

  viewBtns.forEach((b) => (b.onclick = () => setMode(b.dataset.view as 'slider' | 'flip')));
  showBtns.forEach((b) => (b.onclick = () => show(b.dataset.show as 'before' | 'after')));
  stage.addEventListener('click', () => mode === 'flip' && show(stage.dataset.show === 'before' ? 'after' : 'before'));

  const close = () => {
    document.removeEventListener('keydown', onKey);
    dlg.remove();
    document.body.classList.remove('modal-open');
    opener?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return close();
    if (mode === 'flip' && [' ', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      if (e.key === 'ArrowLeft') show('before');
      else if (e.key === 'ArrowRight') show('after');
      else show(stage.dataset.show === 'before' ? 'after' : 'before');
    }
  };
  document.addEventListener('keydown', onKey);
  dlg.querySelector<HTMLElement>('.close')!.onclick = close;
  dlg.addEventListener('click', (e) => e.target === dlg && close());

  document.body.classList.add('modal-open');
  document.body.append(dlg);
  setMode('slider');
}
