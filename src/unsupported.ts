import { logoMark, wordmark } from './ui-utils';
import type { Support } from './support';

/** Full-page message for browsers that can't run either tool. Nothing was uploaded, and nothing broke. */
export function renderUnsupported(root: HTMLElement, support: Support) {
  root.innerHTML = `
    <div class="glow" aria-hidden="true"></div>
    <header class="nav"><a class="brand" href="." aria-label="Pixel-Lite">${logoMark}${wordmark}</a></header>
    <main>
      <section class="hero">
        <p class="eyebrow">Browser not supported</p>
        <h1>Pixel-Lite needs a<br /><em>newer browser.</em></h1>
        <p class="lede">This browser is missing a few features Pixel-Lite relies on${support.missing.length ? ` (${support.missing.join(', ')})` : ''}. Please open it in a recent version of Chrome, Edge, Firefox or Safari. Your photos never leave your device either way.</p>
      </section>
    </main>`;
}
