/*
 * Motion settings shared by the scene and the interface. GSAP owns the DOM
 * choreography; the scene's per-frame maths uses the same curves so a card
 * landing and a heading landing feel like one hand did both.
 *
 * The system is four durations, two curves and two springs, the same as the
 * tokens in styles/tokens.css; nothing else gets invented. What follows a
 * finger or the scroll has no duration of its own: it goes where it is put.
 */
import gsap from 'gsap';

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const coarsePointer = matchMedia('(hover: none)').matches;
/** a phone, upright or on its side: the page's design for a thumb (styles/phone.css says the same) */
export const PHONE = '(max-width: 767.98px), (orientation: landscape) and (max-height: 500px) and (hover: none)';

/** every duration the interface uses (--t-1 to --t-4) */
export const DUR = {
  micro: 0.12, // a press, a hover, a pointer followed
  ui: 0.24,    // a state change, a fade in or out, anything leaving
  panel: 0.42, // a panel: a sheet's contents, a list item, a pill sliding
  move: 0.7,   // a move: a heading or a picture arriving, a sheet, a screen growing
} as const;

/** --e-out, cubic-bezier(.16,1,.3,1): arriving and settling, fast out and a long settle */
export const EASE_OUT = 'expo.out';
/** --e-in: leaving, a short accelerate, never a long one */
export const EASE_IN = 'power2.in';

/*
 * The springs, as easing curves over a tween's duration (--spring and
 * --spring-soft are the same curves sampled for CSS). SPRING is critically
 * damped: a sheet or a card moving into place, at rest without a bounce.
 * SPRING_SOFT overshoots by 2% and comes back: something pressed or switched.
 */
const critical = (t: number) => 1 - (1 + 9 * t) * Math.exp(-9 * t);
const SOFT_Z = 0.78;
const SOFT_W = 7.7;
const SOFT_D = SOFT_W * Math.sqrt(1 - SOFT_Z * SOFT_Z);
const underdamped = (t: number) =>
  1 - Math.exp(-SOFT_Z * SOFT_W * t) * (Math.cos(SOFT_D * t) + (SOFT_Z / Math.sqrt(1 - SOFT_Z * SOFT_Z)) * Math.sin(SOFT_D * t));
const CRITICAL_END = critical(1);
const UNDERDAMPED_END = underdamped(1);
export const SPRING = (t: number) => (t >= 1 ? 1 : critical(t) / CRITICAL_END);
export const SPRING_SOFT = (t: number) => (t >= 1 ? 1 : underdamped(t) / UNDERDAMPED_END);

/** the page's own glide to somewhere near (Lenis): travel, not an interface change */
export const GLIDE = 1.1;

gsap.defaults({ ease: EASE_OUT, duration: DUR.panel });

export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export { gsap };
