/*
 * The intro's scroll, as styles. What is laid over the ring and moves with
 * the scroll (the headline leaving, the two lines coming and going, the rail
 * filling, the scroll cue fading) is written here, once a frame, straight
 * onto the dozen elements that move, and only where a value changed.
 *
 * It used to be one custom property on the intro, read by calc() in the CSS.
 * That reached every element inside, and each worked its formulas out afresh
 * every frame: two milliseconds a frame on a fast desktop, the better part of
 * a frame on a phone. The numbers are the ones styles/hero.css and
 * styles/intro.css describe; the resting states are there too, for the first
 * paint and for a page without scripts.
 */
import { PHONE, clamp, reduceMotion } from '../lib/motion.ts';

/** a style written only when it changes */
function put(el: HTMLElement, prop: 'transform' | 'clipPath' | 'opacity', value: string): void {
  if (el.style[prop] !== value) el.style[prop] = value;
}

interface Part { el: HTMLElement; start: number; over: number; h: number }
interface Say { el: HTMLElement; kicker: HTMLElement | null; text: HTMLElement | null; from: number; to: number; pool: string }

/* the headline's parts leave in turn, the kicker first; each takes 1/22 of the intro */
const LEAVE = 22;
const STARTS: Record<string, number> = { hero__kicker: 0, hero__h: 0.008, hero__p: 0.02, hero__cta: 0.03, hero__proof: 0.036 };
/* the two lines: when each comes in and starts to go, as in styles/intro.css; a line takes 1/22, the next follows 0.012 later */
const SAYS = [[0.12, 0.34], [0.4, 0.62]] as const;
const LINE = 22;
const STAGGER = 0.012;

export function introScroll(): (p: number) => void {
  const hero = document.getElementById('hero');
  const parts: Part[] = hero
    ? [...hero.children].map((el) => {
      const cls = [...el.classList].find((c) => c in STARTS) ?? '';
      return { el: el as HTMLElement, start: STARTS[cls] ?? 0, over: cls === 'hero__kicker' ? 32 : 14, h: 0 };
    })
    : [];
  const says: Say[] = [...document.querySelectorAll<HTMLElement>('.intro__say')].map((el, i) => ({
    el, kicker: el.querySelector('.intro__say-k'), text: el.querySelector('.intro__say-t'),
    from: SAYS[i]?.[0] ?? 1, to: SAYS[i]?.[1] ?? 1, pool: '',
  }));
  const rail = document.querySelector<HTMLElement>('.rail');
  const fill = document.querySelector<HTMLElement>('.rail__fill');
  const cue = document.querySelector<HTMLElement>('.intro__cue');
  const vigs = [...document.querySelectorAll<HTMLElement>('.vig')];
  const across = matchMedia(PHONE);
  let heroPool = '';
  let last = -1;

  // the parts' heights, for how far each has to go to be past its edge
  const measure = () => { for (const pt of parts) pt.h = pt.el.offsetHeight; last = -1; };
  measure();
  addEventListener('resize', measure);
  void document.fonts?.ready.then(measure);
  // the lines are cut again when the fonts land or the width changes: the new ones get their place on the next frame
  const recut = new MutationObserver(() => { last = -1; });
  says.forEach((s) => s.text && recut.observe(s.text, { childList: true }));

  return (p: number) => {
    if (p === last) return;
    last = p;

    /* the headline: each part rises out through the top of its own box;
       with reduced motion the whole fades instead */
    if (hero) {
      if (reduceMotion) {
        hero.style.setProperty('--fade', String(clamp(1 - p * 12, 0, 1)));
      } else {
        for (const pt of parts) {
          const k = clamp((p - pt.start) * LEAVE, 0, 1);
          const go = k * (pt.h + pt.over + 6);
          put(pt.el, 'transform', go ? `translateY(${(-go).toFixed(1)}px)` : '');
          put(pt.el, 'clipPath', go ? `inset(${(go - pt.over).toFixed(1)}px -60px ${-10 - pt.over}px -60px)` : '');
        }
      }
      const pool = clamp(1 - p * 12, 0, 1).toFixed(3);
      if (pool !== heroPool) { heroPool = pool; hero.style.setProperty('--pool', pool); }
    }

    /* the two lines: each line rises in from behind its lower edge, and later
       leaves up through its upper one; the kicker above them is line 0 */
    for (const s of says) {
      const pool = clamp(Math.min((p - s.from) * 14, (s.to + 0.07 - p) * 14), 0, 1).toFixed(3);
      if (pool !== s.pool) { s.pool = pool; s.el.style.setProperty('--pool', pool); }
      if (reduceMotion) { put(s.el, 'opacity', pool); continue; }
      // well before or after its window nothing moves: skip the lines once they are put away
      const at = (line: number) => {
        const e = clamp((p - s.from - line * STAGGER) * LINE, 0, 1);
        const x = clamp((p - s.to - line * STAGGER) * LINE, 0, 1);
        return [e, x] as const;
      };
      if (s.kicker) {
        const [e, x] = at(0);
        put(s.kicker, 'transform', `translateY(${((1 - e - x) * 120).toFixed(2)}%)`);
        put(s.kicker, 'clipPath', `inset(${(x * 120).toFixed(2)}% -40px ${((1 - e) * 120).toFixed(2)}% -40px)`);
      }
      s.el.querySelectorAll<HTMLElement>('.ln').forEach((ln, i) => {
        const [e, x] = at(i + 1);
        put(ln, 'transform', `translateY(${((1 - e - x) * 120).toFixed(2)}%)`);
      });
    }

    /* the rail fills from Start to End (across the top on a phone, down the side otherwise), and fades out at the end */
    if (rail) put(rail, 'opacity', clamp(1 - (p - 0.6) * 5, 0, 1).toFixed(3));
    if (fill) put(fill, 'transform', across.matches ? `scaleX(${p})` : `scaleY(${p})`);
    if (cue) put(cue, 'opacity', clamp(1 - p * 16, 0, 1).toFixed(3));
    /* the fades at the ring's cut edges go as it opens (src/scene/stage.ts,
       0.7 to 0.8): the card coming forward is handed to the page's copy of
       it, which nothing lies over, so nothing may lie over the card either */
    if (!reduceMotion) {
      const v = clamp(1 - (p - 0.68) / 0.1, 0, 1).toFixed(3);
      for (const el of vigs) put(el, 'opacity', v === '1.000' ? '' : v);
    }
  };
}
