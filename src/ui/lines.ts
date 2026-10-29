/*
 * Lines that come and go behind their own edge. A block of text is cut into
 * its lines as the browser has laid them out (GSAP's SplitText, which cuts
 * again whenever the block's width or its font changes), each line in a box
 * that clips it and carrying its place as --line, from 1. The CSS moves
 * them: the two lines over the ring read the scroll (styles/intro.css), and
 * headings rise in as they arrive (styles/routes.css).
 *
 * A heading is cut a screen before it comes into view, not at the start:
 * cutting means laying it out, and a section off the screen is not laid out
 * until it is near (content-visibility). One that is already showing when
 * the page starts is left whole; with reduced motion none is cut, and each
 * simply fades in.
 */
import { SplitText } from 'gsap/SplitText';
import { gsap, reduceMotion } from '../lib/motion.ts';

gsap.registerPlugin(SplitText);

/**
 * Cut el into masked lines; `aria: 'none'` where the text is already hidden
 * from screen readers. `auto` cuts it again when its width or font changes;
 * off for text that is hidden and shown (a hidden block has no width to cut
 * by), which is cut again each time it shows instead.
 */
export function intoLines(el: HTMLElement, aria: 'auto' | 'none' = 'auto', auto = true): SplitText {
  return SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'ln', propIndex: true, autoSplit: auto, aria });
}

/** the two lines over the ring, and the headings further down */
export function cutLines(): void {
  document.querySelectorAll<HTMLElement>('.intro__say').forEach((say) => {
    const t = say.querySelector<HTMLElement>('.intro__say-t');
    if (t) intoLines(t, 'none');
    say.classList.add('is-split');
  });

  const heads = [...document.querySelectorAll<HTMLElement>('.rv--lines')];
  const done = (el: HTMLElement) => el.classList.add('is-cut');
  if (reduceMotion || !('IntersectionObserver' in window)) { heads.forEach(done); return; }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const el = en.target as HTMLElement;
      io.unobserve(el);
      if (!el.classList.contains('is-shown')) intoLines(el);
      done(el);
    }
  }, { rootMargin: '0px 0px 100% 0px' });
  heads.forEach((el) => (el.classList.contains('is-shown') ? done(el) : io.observe(el)));
}
