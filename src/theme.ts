/**
 * Light / dark theme. With no saved choice the app follows the system setting. Clicking the toggle
 * saves an explicit choice, which is applied before first paint by the inline script in index.html.
 */
const KEY = 'pixel-lite-theme';
const media = matchMedia('(prefers-color-scheme: dark)');

const effective = (): 'light' | 'dark' => {
  const set = document.documentElement.dataset.theme;
  return set === 'light' || set === 'dark' ? set : media.matches ? 'dark' : 'light';
};

export function initTheme(button: HTMLButtonElement) {
  const sync = () => {
    const now = effective();
    button.dataset.mode = now;
    const next = now === 'dark' ? 'light' : 'dark';
    button.setAttribute('aria-label', `Switch to ${next} mode`);
    button.title = `Switch to ${next} mode`;
  };
  button.onclick = () => {
    const next = effective() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* private mode or blocked storage: the choice just won't persist */
    }
    sync();
  };
  media.addEventListener('change', sync); // keeps the icon right while following the system
  sync();
}
