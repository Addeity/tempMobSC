/*
 * The composition root: builds the interface, then the scene, and wires
 * them together. Nothing below here knows about anything above it.
 *
 * Version 2 is one page, read top to bottom: the ring, whose scroll has a
 * start and an end; the tour of the workflows it ends in (with a way to skip
 * it); then every section, and the footer band. The page is readable before
 * the 3D exists: everything but the ring is HTML, and three.js loads in its
 * own chunk once the ring could be seen. When it arrives the ring flies in;
 * if it cannot run (no WebGL), the list of workflows written into the page
 * stands in for it.
 */
import { WORKFLOWS } from '@site/content';
import { byId } from './lib/dom.ts';
import { fontsLoaded } from './lib/fonts.ts';
import { PHONE, clamp } from './lib/motion.ts';
import { store, type State } from './lib/store.ts';
import type { Stage, StageEvents } from './scene/stage.ts';
import { footerCounter, layoutSwitch, motionToggle, pointerChrome, splitFlap } from './ui/chrome.ts';
import { track } from './lib/analytics.ts';
import { bookingDialog } from './ui/booking.ts';
import { faq } from './ui/faq.ts';
import { handover } from './ui/handover.ts';
import { footerLiquid } from './ui/footer.ts';
import { billingToggle, contactForm } from './ui/forms.ts';
import { playIntro } from './ui/intro.ts';
import { introScroll } from './ui/introScroll.ts';
import { cutLines } from './ui/lines.ts';
import { phoneMenu } from './ui/menu.ts';
import { navAway } from './ui/nav.ts';
import { foldControls, planPick, swipeRows } from './ui/sections.ts';
import { printReady, skipLink } from './ui/print.ts';
import { Player } from './ui/player.ts';
import { sectionBox, startRouter, syncFlow } from './ui/router.ts';
import { onScroll, rescroll, startScroll } from './ui/scroll.ts';
import { spotlight } from './ui/spotlight.ts';
import { themeSwitch } from './ui/theme.ts';
import { startTour, type Tour } from './ui/tour.ts';

/** once the first frame is on screen */
const painted = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/** once the browser reports the page's first content as shown (or shortly, where it cannot say) */
const firstPaint = () => new Promise<void>((resolve) => {
  setTimeout(resolve, 1500);
  try {
    new PerformanceObserver((list, observer) => {
      if (!list.getEntriesByName('first-contentful-paint').length) return;
      observer.disconnect();
      resolve();
    }).observe({ type: 'paint', buffered: true });
  } catch { /* no paint timing: the timeout stands */ }
});

/** some of the ring is on screen, and nothing (a film, the not-found notice) is laid over it */
const ringSeen = (s: State) => s.ringInView && s.mode === 'grid';

/** once the ring would be seen */
const ringInView = () => new Promise<void>((resolve) => {
  if (ringSeen(store.get())) { resolve(); return; }
  const stop = store.subscribe((s) => { if (ringSeen(s)) { stop(); resolve(); } });
});

/**
 * Hands the main thread back to the browser for a turn: input, a frame,
 * anything waiting. Where the browser has scheduler.yield, the rest of the
 * work keeps its place at the front of the queue.
 */
const yieldToMain = () => new Promise<void>((resolve) => {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s?.yield) s.yield().then(resolve, resolve); else setTimeout(resolve, 0);
});

/** one step of the start, measured (a profile or Lighthouse's user timings show where the time went), then a turn for the browser */
async function step(name: string, work: () => void): Promise<void> {
  const start = performance.now();
  work();
  performance.measure(`start: ${name}`, { start });
  await yieldToMain();
}

/** the browser's next quiet moment, or a short while if it never has one */
const idle = () => new Promise<void>((r) =>
  'requestIdleCallback' in window ? requestIdleCallback(() => r(), { timeout: 1200 }) : setTimeout(r, 200));

/*
 * The scene's code (three.js, 130 kB over the wire) is fetched only once the
 * ring could be seen. A visit that starts at the top fetches it as soon as
 * the headline is on screen; one that lands further down (on /pricing/, say)
 * or on a film fetches it when the visitor makes for the ring: a pointer or
 * the keyboard on a way back to the top (the logo, "Back to the ring", a
 * film's close), Escape, or the scroll bringing them up into the tour. Most
 * such visits never go back, and it was 130 kB they downloaded for nothing. The ring is built once the fonts
 * are in (the card faces are drawn in them) and the browser has a quiet
 * moment, so no input ever waits on WebGL.
 */
let stageCode: Promise<typeof import('./scene/stage.ts')> | null = null;
const fetchStage = () => (stageCode ??= import('./scene/stage.ts'));

/** further down the page: fetch the ring's code the moment the visitor makes for it, so it is there when they arrive */
function fetchOnTheWayBack(): void {
  const ways = 'a[href="/"], [data-flow-close]';
  const near = (e: Event) => { if ((e.target as Element | null)?.closest?.(ways)) go(); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') go(); };
  const stop = store.subscribe((s) => { if (s.mode === 'grid' && (s.section === 'home' || s.section === 'workflows')) go(); });
  function go(): void {
    fetchStage();
    stop();
    removeEventListener('pointerover', near);
    removeEventListener('focusin', near);
    removeEventListener('keydown', key);
  }
  addEventListener('pointerover', near, { passive: true });
  addEventListener('focusin', near);
  addEventListener('keydown', key);
}

async function loadStage(events: StageEvents, fonts: Promise<void>): Promise<Stage | null> {
  // a browser without WebGL2 was told so by the page's first script, and is already showing the list
  if (document.documentElement.classList.contains('no-webgl')) return null;
  try {
    await firstPaint();
    await painted();   // the scroll has been read at least once by now (ringScroll)
    if (ringSeen(store.get())) fetchStage(); else fetchOnTheWayBack();
    await fonts;
    await ringInView();
    const mod = fetchStage();   // in view at last: fetched now if nothing on the way did it
    await idle();
    const { Stage } = await mod;
    return await Stage.create(byId<HTMLCanvasElement>('scene'), events);
  } catch (err) {
    // the page carries on with the list of workflows; the reason goes to the console for whoever debugs it
    console.error('The 3D ring could not start:', err);
    document.documentElement.classList.add('no-webgl');
    return null;
  }
}

/* whatever sits behind a film or the not-found notice is out of reach, for
   the keyboard and for screen readers alike, not just covered */
function inertBehind(): void {
  const { mode } = store.get();
  const set = (sel: string, on: boolean) => document.querySelectorAll(sel).forEach((el) => el.toggleAttribute('inert', on));
  set('main, .foot', mode !== 'grid');
  // the legal page covers the nav too (it has its own way back); the not-found notice leaves it in reach
  set('.nav, .skip', mode === 'focus' || store.get().doc !== null);
}

/* the page's chrome follows where the reader is: the ring's own controls
   leave once it has opened, the nav takes a ground of its own over the
   sections, and the ring's bar (its counter and pause) stays only as far as
   the tour */
function chromeState(): void {
  const { section } = store.get();
  document.body.classList.toggle('is-past-ring', section !== 'home');
  document.body.classList.toggle('is-paged', section !== 'home' && section !== 'workflows');
}

/**
 * The intro's scroll, read once a frame: its progress (0 at the top, 1 where
 * the tour has covered it) goes to the ring and, as --p, to the copy laid
 * over it; how far the tour has risen goes to the stage as --enter, which
 * sinks it back a little as the tour's sheet comes over.
 */
function ringScroll(stage: () => Stage | null): void {
  const stageEl = byId('stage');
  const body = document.body;
  const paint = introScroll();
  let shownP = -1, shownE = -1;
  /* on a phone there is no switch: the ring turns into the spiral by itself
     a little way into the scroll, and back again on the way up */
  const phone = matchMedia(PHONE);
  let spiral = false;
  onScroll(({ y, vh }) => {
    const box = sectionBox('home');
    const tour = sectionBox('workflows');
    if (!box) return;
    // the intro's pinned stretch ends where the tour has fully risen over it
    const end = tour ? tour.top : box.height - vh;
    const p = Math.round(clamp(y / Math.max(1, end), 0, 1) * 1000) / 1000;
    const enter = tour ? Math.round(clamp(1 - (tour.top - y) / vh, 0, 1) * 1000) / 1000 : 0;
    if (p !== shownP) {
      shownP = p;
      paint(p);
      body.classList.toggle('is-ring-done', p > 0.62);
    }
    // under the rising tour the stage sinks back a little and dims, its corners rounding
    if (enter !== shownE) {
      shownE = enter;
      stageEl.style.transform = enter ? `scale(${(1 - enter * 0.05).toFixed(4)})` : '';
      stageEl.style.opacity = enter ? (1 - enter * 0.55).toFixed(3) : '';
      stageEl.style.borderRadius = enter ? `${(enter * 28).toFixed(1)}px` : '';
      // once covered it is not drawn at all: a section stepping back would show it through, and it costs a layer every frame
      stageEl.style.visibility = enter >= 1 ? 'hidden' : '';
    }
    const inView = enter < 1;
    if (inView !== store.get().ringInView) store.set({ ringInView: inView });
    const s = stage();
    s?.setScroll(p);
    const want = phone.matches && p > 0.3;
    if (s && want !== spiral) { spiral = want; s.setSpiral(want); }
    s?.setVisible(inView);
  });
}

export async function startApp(): Promise<void> {
  /* The start is a run of small steps with a turn for the browser between
     each, not one long task: run back to back, they kept the page from
     answering a tap for a fifth of a second on a mid-range phone. First what
     can be reached at once (the scroll, the nav, the ring's own controls,
     the player and the address bar), then the controls further down. The
     first turn comes before any of it: the module's own evaluation is a
     task of its own. */
  await yieldToMain();
  const chrome = pointerChrome();
  const player = new Player();
  let stage: Stage | null = null;
  let tour: Tour | null = null;
  await yieldToMain();

  /* a workflow opens from what is showing it: the nearest card on the ring, or the tour's frame */
  const openNear = (i: number) => {
    const { section } = store.get();
    const card = section === 'home' ? stage?.frontCard(i) : null;
    if (card) { player.open(i, stage!.cardRect(card), () => stage?.cardRect(card) ?? null); return; }
    const el = section === 'workflows' && tour?.current === i
      ? document.querySelector<HTMLElement>(`.tour__slide[data-i="${i}"] .tour__media`)
      : null;
    player.open(i, el?.getBoundingClientRect() ?? null, el ? () => el.getBoundingClientRect() : undefined, el ? tour?.still() : null);
  };
  // registered before the router's own link handling, so a film's link opens the film rather than an address
  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest<HTMLElement>('[data-flow]');
    if (!link) return;
    e.preventDefault();
    const i = WORKFLOWS.findIndex((w) => w.key === link.dataset.flow);
    if (i >= 0) openNear(i);
  });

  /* the address bar follows the film, and the film follows the address bar */
  player.onChange = (i) => {
    syncFlow(i >= 0 ? WORKFLOWS[i]!.key : null);
    if (i >= 0) track('Film', { workflow: WORKFLOWS[i]!.key });
  };
  store.subscribe(inertBehind);
  store.subscribe((s, prev) => { if (s.section !== prev.section) chromeState(); });
  await step('scroll', startScroll);
  await step('router', () => startRouter({
    onFlow(key) {
      if (!key) { player.close(); return; }
      const i = WORKFLOWS.findIndex((w) => w.key === key);
      if (i >= 0 && player.current !== i) openNear(i);
    },
  }));
  await step('ring scroll', () => { ringScroll(() => stage); chromeState(); cutLines(); });
  await step('tour', () => { tour = startTour((i) => footerCounter(i)); handover(() => stage); });
  await step('nav', () => { splitFlap(); phoneMenu(); navAway(); skipLink(); });
  await step('theme', () => themeSwitch(() => stage?.setTheme(store.get().theme)));
  await step('ring controls', () => { layoutSwitch((spiral) => stage?.setSpiral(spiral)); motionToggle(); });
  await step('pricing', () => { billingToggle(); swipeRows(); planPick(); foldControls(); });
  await step('contact', () => { contactForm(); bookingDialog(); });
  await step('questions', faq);
  await step('finish', () => { spotlight(); printReady(); });
  await step('footer', footerLiquid);

  const fonts = fontsLoaded(1200);
  const stageReady = loadStage({
    onHover(card) {
      const wf = card ? WORKFLOWS[card.userData.wfIndex]! : null;
      document.body.classList.toggle('is-hovering', !!card);
      chrome.show(wf?.title ?? null, wf?.category);
      if (card && store.get().mode === 'grid') footerCounter(card.userData.wfIndex);
    },
    onOpen(index, card) { player.open(index, stage!.cardRect(card), () => stage?.cardRect(card) ?? null); },
    onMoving(moving) { document.body.classList.toggle('is-moving', moving); },
  }, fonts);

  // the entrance starts on the frame after the fonts land, once their layout has been done
  await fonts;
  await painted();
  playIntro();

  stage = await stageReady;
  if (!stage) return;
  player.setAtlas(stage.atlas);
  if (store.get().theme !== 'dark') stage.setTheme(store.get().theme);
  stage.start();
  rescroll();   // the ring takes up wherever the scroll already is

  /* the atlas plays only while someone could be watching it: not under the
     player, not under the tour, not in a background tab */
  const atlas = stage.atlas;
  const sync = () => {
    const s = store.get();
    atlas.setPlaying(!s.motionPaused && s.mode === 'grid' && s.ringInView && !document.hidden);
  };
  store.subscribe(sync);
  document.addEventListener('visibilitychange', sync);
  sync();

  let t = 0;
  addEventListener('resize', () => { clearTimeout(t); t = window.setTimeout(() => stage!.resize(), 140); });

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__site = { ...stage.debug(), open: openNear, close: () => player.close(), store };
  }
}
