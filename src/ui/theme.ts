/*
 * Dark and light. The page starts in the visitor's last choice, or their
 * system's (index.html sets it before the first paint, so nothing flashes);
 * the switch in the nav changes it and remembers it. Until they choose, the
 * page follows the system as it changes, as at dusk.
 *
 * Where the browser has view transitions, the new theme spreads out from the
 * switch in a circle over the old one; elsewhere the colours cross-fade.
 * The ring is told first and redraws before the new look is captured, so it
 * changes inside the circle with everything else.
 */
import { byId, prefs } from '../lib/dom.ts';
import { DUR, reduceMotion } from '../lib/motion.ts';
import { store, type Theme } from '../lib/store.ts';

const GROUND: Record<Theme, string> = { dark: '#05070c', light: '#f2f3f6' };

type Transitioning = Document & { startViewTransition?: (update: () => void) => { ready: Promise<void> } };

export function themeSwitch(redraw: () => void): void {
  const html = document.documentElement;
  const btn = byId<HTMLButtonElement>('themeToggle');
  const meta = document.querySelector('meta[name="theme-color"]');

  const apply = (t: Theme) => {
    html.dataset.theme = t;
    meta?.setAttribute('content', GROUND[t]);
    btn.setAttribute('aria-pressed', String(t === 'light'));
    store.set({ theme: t });
    redraw();
  };

  const change = (t: Theme, from?: HTMLElement) => {
    if (t === store.get().theme) return;
    const doc = document as Transitioning;
    if (!doc.startViewTransition || reduceMotion) {
      html.classList.add('is-theming');
      apply(t);
      setTimeout(() => html.classList.remove('is-theming'), 450);
      return;
    }
    const r = (from ?? btn).getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = doc.startViewTransition(() => apply(t));
    /* the circle eases in and out, unlike the rest of the page's motion: on
       an expo curve it has covered most of the screen in its first frames,
       and the sweep across it is never seen */
    vt.ready.then(() => {
      html.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: DUR.move * 1000, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' },
      );
    }, () => {});
  };

  btn.setAttribute('aria-pressed', String(store.get().theme === 'light'));
  btn.addEventListener('click', () => {
    const next: Theme = store.get().theme === 'light' ? 'dark' : 'light';
    prefs.set('theme', next);
    change(next, btn);
  });

  // until the visitor picks one, the page keeps to the system's
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', (m) => {
    const chosen = prefs.get('theme');
    if (chosen !== 'light' && chosen !== 'dark') change(m.matches ? 'light' : 'dark');
  });
}
