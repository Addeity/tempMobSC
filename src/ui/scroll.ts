/*
 * The page's one scroll. Version 2 is a single page: the ring, the tour and
 * every section after them scroll as one document, and everything that moves
 * with the scroll (the ring turning, the tour's slides, the nav's ground)
 * reads it here, once a frame, on GSAP's ticker, the clock the scene and
 * every tween already share.
 *
 * Where there is a fine pointer, Lenis eases the wheel's notches into one
 * glide; on a phone the finger's own momentum is the scroll people expect,
 * and with reduced motion the page keeps its plain scroll. Lenis is fetched
 * after the first paint, and the page scrolls natively until it lands.
 *
 * A film or the not-found notice over the page holds the scroll still, and
 * a long jump (the nav, Skip, the back button) crosses under a veil rather
 * than racing past everything between: it fades to the ground, moves, and
 * fades back in where it was going. When the jump is to a section, the veil
 * names it as it falls, a chapter's title rising into place and leaving
 * as the page appears.
 */
import type Lenis from 'lenis';
import { DUR, EASE_IN, EASE_OUT, GLIDE, gsap, reduceMotion } from '../lib/motion.ts';
import { store } from '../lib/store.ts';

export interface ScrollFrame {
  /** the scroll position, in px */
  y: number;
  /** the viewport's height, in px */
  vh: number;
  /** px moved since the last frame */
  dy: number;
}

type Listener = (f: ScrollFrame) => void;

const listeners = new Set<Listener>();
let lenis: Lenis | null = null;
/** the legal page has a scroll of its own, eased the same way while it is open */
let panelLenis: Lenis | null = null;
const fine = () => !reduceMotion && matchMedia('(hover: hover) and (pointer: fine)').matches;
let locked = false;
let lastY = -1;
let lastVh = -1;
let dirty = true;
/** a jump is under way: listeners may skip their transitions */
export let jumping = false;

/** called every frame the scroll or the window's height changed (and once at the start) */
export function onScroll(fn: Listener): () => void {
  listeners.add(fn);
  dirty = true;
  return () => listeners.delete(fn);
}

/** ask for one more frame's worth of listeners, as after a layout change */
export const rescroll = () => { dirty = true; };

/** where an element starts on the page, in px from the top: from the layout,
    so a section stepping back under the next one on a phone (a transform,
    styles/phone.css) is not taken for having moved */
export function pageTop(el: Element): number {
  let top = 0;
  for (let node = el as HTMLElement | null; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
  return top;
}

function frame(): void {
  const y = lenis ? lenis.scroll : scrollY;
  const vh = innerHeight;
  if (!dirty && y === lastY && vh === lastVh) return;
  const f: ScrollFrame = { y, vh, dy: lastY < 0 ? 0 : y - lastY };
  lastY = y; lastVh = vh; dirty = false;
  listeners.forEach((fn) => fn(f));
}

function lock(on: boolean): void {
  if (on === locked) return;
  locked = on;
  document.documentElement.classList.toggle('is-locked', on);
  if (on) lenis?.stop(); else lenis?.start();
}

export function startScroll(): void {
  gsap.ticker.add(frame);
  addEventListener('resize', rescroll);
  store.subscribe((s) => lock(s.mode !== 'grid' || document.body.classList.contains('is-menu-open')));
  new MutationObserver(() => lock(store.get().mode !== 'grid' || document.body.classList.contains('is-menu-open')))
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });

  gsap.ticker.add((time) => panelLenis?.raf(time * 1000));
  if (!fine()) return;
  void import('lenis').then(({ default: Make }) => {
    lenis = new Make({ lerp: 0.1, autoRaf: false, allowNestedScroll: true });
    gsap.ticker.add((time) => lenis?.raf(time * 1000));
    if (locked) lenis.stop();
  });
}

/** a page laid over the site with its own scroll (legal): eased while it is open, back to its top when asked */
export function smoothPanel(el: HTMLElement | null, top = false): void {
  if (top && el) { el.scrollTop = 0; panelLenis?.scrollTo(0, { immediate: true, force: true }); }
  if (el && panelLenis) return;
  panelLenis?.destroy();
  panelLenis = null;
  if (!el || !fine()) return;
  void import('lenis').then(({ default: Make }) => {
    if (!el.classList.contains('is-open') || panelLenis) return;
    panelLenis = new Make({ wrapper: el, content: el.querySelector<HTMLElement>('.doc__wrap') ?? el, lerp: 0.1, autoRaf: false });
  });
}

/** glide to y over a short distance; Lenis where it runs, the browser's own smooth scroll elsewhere */
export function glideTo(y: number, done?: () => void): void {
  // Lenis keeps the page's height from when it last looked, and stops short of a section that has just grown
  if (lenis) { lenis.resize(); lenis.scrollTo(y, { duration: GLIDE, onComplete: () => done?.(), force: true }); return; }
  scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  if (done) {
    // the browser says nothing when a smooth scroll ends: watch for it to stop
    let still = 0, at = -1;
    const watch = () => { if (scrollY === at) still++; else { still = 0; at = scrollY; } if (still > 6) { gsap.ticker.remove(watch); done(); } };
    gsap.ticker.add(watch);
  }
}

/** move to y at once */
export function setScroll(y: number): void {
  if (lenis) { lenis.resize(); lenis.scrollTo(y, { immediate: true, force: true }); }
  else scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
  dirty = true;
}

/**
 * Moves the scroll by delta at once: for keeping what is on screen in place
 * while something above it changes size. Under Lenis it starts again from
 * where the page is now seen, plus the difference; a glide under way stops
 * there rather than carry on from a place that has moved.
 */
export function shiftScroll(delta: number): void {
  /* from the page's own position: the browser often keeps the place itself
     (scroll anchoring), and then the difference here is nothing, but Lenis
     has not seen that move and would put the page back where it was */
  const at = scrollY + delta;
  if (lenis) {
    if (Math.abs(at - lenis.animatedScroll) < 1) return;
    lenis.resize();
    lenis.scrollTo(at, { immediate: true, force: true });
  } else {
    if (Math.abs(delta) < 1) return;
    scrollTo({ top: at, behavior: 'instant' as ScrollBehavior });
  }
  dirty = true;
}

let veil: HTMLElement | null = null;
let veilLine: HTMLElement | null = null;

/** a section's place in the menu and its name, for the veil to say on the way there */
export interface Chapter { n: string; name: string }

/**
 * Takes the visitor to y: a glide when it is near, under the veil when it is
 * further than a couple of screens, so a long way never flashes past
 * everything in between. Resolves once they are there. `settle`, when given,
 * readies the page for the arrival and says where exactly that is now: under
 * the veil it runs once the veil is up, so its work (laying out what is in
 * between) never holds up the veil's first frame.
 */
export function travelTo(y: number, chapter?: Chapter | null, settle?: () => number): Promise<void> {
  const from = lenis ? lenis.scroll : scrollY;
  const far = Math.abs(y - from) > innerHeight * 2.2;
  if (!far || reduceMotion) {
    const to = settle ? settle() : y;
    if (reduceMotion) { setScroll(to); return Promise.resolve(); }
    return new Promise((r) => glideTo(to, r));
  }
  if (!veil) {
    veil = document.createElement('div');
    veil.className = 'veil';
    veil.setAttribute('aria-hidden', 'true');
    veil.innerHTML = '<p class="veil__card"><span class="veil__line"><span class="veil__n"></span><span class="veil__t"></span></span></p>';
    veilLine = veil.querySelector<HTMLElement>('.veil__line');
    document.body.append(veil);
  }
  const v = veil;
  const line = veilLine!;
  line.hidden = !chapter;
  if (chapter) {
    line.querySelector('.veil__n')!.textContent = chapter.n;
    line.querySelector('.veil__t')!.textContent = chapter.name;
  }
  return new Promise((resolve) => {
    jumping = true;
    gsap.killTweensOf([v, line]);
    const tl = gsap.timeline();
    tl.to(v, { opacity: 1, duration: DUR.ui, ease: EASE_OUT }, 0);
    if (chapter) tl.fromTo(line, { yPercent: 110 }, { yPercent: 0, duration: DUR.panel, ease: EASE_OUT }, 0.04);
    tl.add(() => {
      setScroll(settle ? settle() : y);
      // two frames on the far side, so whatever is there is laid out and painted before the veil lifts
      requestAnimationFrame(() => requestAnimationFrame(() => {
        jumping = false;
        resolve();
        if (chapter) gsap.to(line, { yPercent: -110, duration: DUR.ui, ease: EASE_IN });
        // it lifts on a softer curve than the rest: a whole screen fading on expo is all but gone in its first frames, and reads as a cut
        gsap.to(v, { opacity: 0, duration: DUR.panel, ease: 'power2.out', delay: chapter ? DUR.micro : 0 });
      }));
    }, chapter ? DUR.panel + 0.06 : DUR.ui);
  });
}
