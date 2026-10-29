/*
 * The page's entrance, as one timeline: the chrome settles in round the
 * headline while the cards fly out (the scene runs its own intro on the same
 * clock). The headline itself is already there: it is the largest thing on
 * the first screen, and holding it back for an entrance made the page's
 * largest paint wait on scripts and fonts.
 */
import { DUR, EASE_OUT, gsap, reduceMotion } from '../lib/motion.ts';

/** past this, the CSS has already begun to bring the chrome in on its own (base.css) */
const LATE_MS = 1400;
const CHROME = '.nav, .switch, .foot, .hero__kicker, .hero__p, .hero__cta, .hero__proof, .rail, .intro__cue';

export function playIntro(): void {
  const html = document.documentElement;
  if (reduceMotion) { html.classList.add('is-ready', 'is-settled'); return; }
  /* too late to make an entrance: the chrome is coming in on its own, or
     has. Lifting the rule that holds it back would end that fade where it
     stands, so each part carries on from wherever it has got to instead */
  if (performance.now() > LATE_MS) {
    const parts = gsap.utils.toArray<HTMLElement>(CHROME);
    const from = parts.map((el) => Number(getComputedStyle(el).opacity));
    html.classList.add('is-ready', 'is-settled');
    parts.forEach((el, i) => {
      const o = from[i]!;
      if (o < 1) gsap.fromTo(el, { opacity: o }, { opacity: 1, duration: DUR.panel * (1 - o) + DUR.micro, ease: EASE_OUT, clearProps: 'opacity' });
    });
    return;
  }

  /* Every tween states both its ends, and the timeline is built before the
     rule that holds the chrome back is lifted: GSAP measures a page whose
     styles are settled, so the entrance never forces a layout of its own.
     Inline styles are cleared at the end so the state rules in CSS (hide over
     the player, dim while moving) apply again. That is set per tween, not as
     a timeline default: a fromTo's start is a tween of its own that would
     inherit it and clear itself the moment it was set. */
  const shown = { opacity: 1, clearProps: 'opacity' };
  const risen = { opacity: 1, y: 0, clearProps: 'opacity,transform' };
  const tl = gsap.timeline({
    defaults: { ease: EASE_OUT, duration: DUR.move },
    onComplete: () => html.classList.add('is-settled'),
  })
    .fromTo('.nav', { opacity: 0 }, shown, 0.35)
    .fromTo('.switch', { opacity: 0 }, shown, 0.5)
    .fromTo('.hero__kicker', { opacity: 0, y: 12 }, risen, 0.45)
    .fromTo('.hero__p', { opacity: 0, y: 14 }, risen, 0.8)
    .fromTo('.hero__cta', { opacity: 0, y: 14 }, risen, 0.9)
    .fromTo('.foot', { opacity: 0 }, shown, 0.5)
    .fromTo(['.rail', '.intro__cue'], { opacity: 0 }, shown, 1.1);
  // the customer line is there only once there are customers to name; GSAP warns about a target it cannot find
  const proof = document.querySelector('.hero__proof');
  if (proof) tl.fromTo(proof, { opacity: 0, y: 10 }, risen, 1.0);
  html.classList.add('is-ready');
}
