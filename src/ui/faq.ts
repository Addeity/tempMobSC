/*
 * The pricing questions. Two things CSS cannot do on its own:
 *
 * 1. The wash's origin. The row records which half of itself the pointer
 *    came in by and left through, so walking down the list the accent pours
 *    out of one row and into the next. Mouse only: a tap would leave a wash.
 * 2. The answer's height. A click mid-flight turns the tween round instead
 *    of queueing a second one.
 */
import { DUR, EASE_OUT, gsap, reduceMotion } from '../lib/motion.ts';

export function faq(): void {
  document.querySelectorAll<HTMLDetailsElement>('.qa .qa__i').forEach((row) => {
    const wash = row.querySelector<HTMLElement>('.qa__wash');
    const body = row.querySelector<HTMLElement>('.qa__b');
    const summary = row.querySelector<HTMLElement>('.qa__q');
    if (!wash || !body || !summary) return;

    const edge = (e: PointerEvent) => {
      const r = row.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2 ? 'top' : 'bottom';
    };
    row.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      wash.style.transformOrigin = edge(e);
      row.setAttribute('data-hot', '');
    });
    row.addEventListener('pointerleave', (e) => {
      wash.style.transformOrigin = edge(e);
      row.removeAttribute('data-hot');
    });

    let opening = false;
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (reduceMotion) { row.open = !row.open; return; }
      const close = gsap.isTweening(body) ? opening : row.open;
      gsap.killTweensOf(body);
      opening = !close;
      if (close) {
        gsap.to(body, { height: 0, duration: DUR.ui, ease: EASE_OUT, onComplete: () => { row.open = false; gsap.set(body, { clearProps: 'height' }); } });
      } else {
        const from = row.open ? body.offsetHeight : 0;
        row.open = true;
        gsap.fromTo(body, { height: from }, { height: 'auto', duration: DUR.panel, ease: EASE_OUT, onComplete: () => gsap.set(body, { clearProps: 'height' }) });
      }
    });
  });
}
