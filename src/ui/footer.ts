/*
 * When the footer band's liquid runs, and whether the band is pinned. The
 * page ends in the band; where it fits under the nav it is pinned to the
 * bottom under the last section, so being "on screen" is not enough: it
 * runs only while some of it is uncovered, which is the stretch between the
 * bottom of that section and the bottom of the window. The shader
 * (src/scene/liquid.ts) loads the first time that happens; until then, and
 * wherever WebGL2 is missing, the band is plain black.
 */
import { store } from '../lib/store.ts';
import type { Liquid } from '../scene/liquid.ts';
import { onScroll } from './scroll.ts';

export function footerLiquid(): void {
  const foot = document.querySelector<HTMLElement>('.rfoot');
  const above = foot?.parentElement?.querySelector<HTMLElement>('.sec');
  if (!foot || !above) return;
  /* undefined: not loaded yet; null: cannot run here */
  let liquid: Liquid | null | undefined;
  let loading = false;
  /** whether the band's fit needs measuring again: the window changed size */
  let measure = true;

  /* the band is pinned under the page only where all of it fits under the
     nav; taller (a small phone, a phone on its side, a short window), its top
     links could never be uncovered, so it scrolls in with the page instead */
  function fit(): void {
    const nav = document.querySelector<HTMLElement>('.nav');
    foot!.classList.toggle('is-tall', foot!.offsetHeight > innerHeight - (nav?.offsetHeight ?? 0));
  }

  function check(): void {
    if (measure) { measure = false; fit(); }
    // only near the end of the page is there anything to look at
    const near = store.get().section === 'contact' || store.get().section === 'company';
    if (!near || document.hidden) { liquid?.run(false); return; }
    const f = foot!.getBoundingClientRect();
    const uncovered = Math.min(f.bottom, innerHeight) - Math.max(f.top, above!.getBoundingClientRect().bottom);
    if (uncovered <= 0) { liquid?.run(false); return; }

    if (liquid === undefined) {
      if (!loading) {
        loading = true;
        import('../scene/liquid.ts').then(({ Liquid }) => { liquid = Liquid.create(); check(); }, () => { liquid = null; });
      }
      return;
    }
    if (!liquid) return;
    liquid.attach(foot!);
    liquid.run(true);
  }

  onScroll(check);
  addEventListener('resize', () => { measure = true; });
  document.addEventListener('visibilitychange', check);
}
