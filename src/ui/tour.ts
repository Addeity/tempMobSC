/*
 * The tour: where the ring's scroll ends. The twelve workflows, one at a
 * time, pinned while the tour's own stretch of the page scrolls past: the
 * scroll picks the workflow, and the film picks the step.
 *
 * Each change is one movement: the old copy lifts away the way the scroll
 * is going, the new screen wipes up into its frame and settles from a slight
 * zoom, and the new copy follows it in, the title a word at a time from
 * behind its own line. The film for the workflow on screen then plays (a
 * size down from the player's, since the frame is smaller), and its steps
 * light up as it reaches them, each with a bar filling for as long as it
 * runs: a row of segments, one per step, filling with the film, and the
 * step it is on written out under them. Where films do not play (paused
 * motion, reduced motion, before the first frame arrives) the scroll
 * through the workflow's own stretch moves through the steps instead.
 *
 * The index under it is the tour's progress and a way about it; Skip the
 * workflows is a plain link to the next section, which the router takes
 * there under the veil.
 *
 * On a phone the tour is for a thumb: a swipe sideways goes to the next
 * workflow or back (the slide follows the finger exactly, and a throw carries
 * on at its own speed into the change, which then runs sideways too); two
 * arrows and a progress line stand in for the index, and a tap on the count
 * between them opens all twelve as a list; the page settles on each workflow
 * as a scroll comes to rest there (styles/tour.css). Held upright, a phone
 * plays the films' upright cut, framed closer, so the product reads at its
 * width.
 */
import { FILM, MEDIA, WORKFLOWS, filmDuration, posterTime } from '@site/content';
import { fmtTime, pad2 } from '../lib/dom.ts';
import { filmSize, mediaUrl } from '../lib/media.ts';
import { DUR, EASE_IN, EASE_OUT, PHONE, SPRING, clamp, gsap, reduceMotion } from '../lib/motion.ts';
import { intoLines } from './lines.ts';
import { pullToClose } from './pull.ts';
import { store } from '../lib/store.ts';
import { sectionBox } from './router.ts';
import { jumping, onScroll, travelTo } from './scroll.ts';

const N = WORKFLOWS.length;

interface StepRow { li: HTMLElement; t: number; end: number; p: number; on: boolean }


export interface Tour {
  /** the workflow on screen */
  readonly current: number;
  /** what its frame shows this moment, and the moment of the film it is, for the player to open on and carry on from */
  still(): Still | null;
}

/** a picture of a film as a frame shows it, and the moment of the film it shows */
export interface Still { image: HTMLVideoElement | HTMLImageElement; at: number }

export function startTour(onIndex: (i: number) => void): Tour | null {
  const root = document.getElementById('workflows');
  if (!root) return null;
  const slides = [...root.querySelectorAll<HTMLElement>('.tour__slide')];
  const ticks = [...root.querySelectorAll<HTMLElement>('.tour__tick')];
  const idxs = [...root.querySelectorAll<HTMLElement>('.tour__idx')];
  /** a phone: the changes run sideways, as the swipe does; upright, it plays the films' upright cut */
  const sideways = matchMedia(PHONE);
  const upright = matchMedia('(max-width: 767.98px)');
  const rows: StepRow[][] = slides.map((s, i) => {
    const dur = filmDuration(WORKFLOWS[i]!);
    const lis = [...s.querySelectorAll<HTMLElement>('.tour__step')];
    return lis.map((li, k) => ({ li, t: Number(li.dataset.t), end: Number(lis[k + 1]?.dataset.t ?? dur), p: -1, on: false }));
  });
  /* each title's lines, cut again every time its slide shows: a hidden slide
     has none to find, and the width may have changed since (a new cut puts
     the last one back first) */
  const linesOf = (s: HTMLElement): HTMLElement[] =>
    intoLines(s.querySelector<HTMLElement>('.tour__h')!, 'auto', false).lines as HTMLElement[];

  /* one film element for the whole tour, moved into whichever frame is showing */
  const video = document.createElement('video');
  video.className = 'tour__video';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'none';
  video.setAttribute('aria-hidden', 'true');
  video.addEventListener('playing', () => video.classList.add('is-playing'));
  // a film plays once, and the tour moves on to the next workflow: it does not start the same one again
  video.addEventListener('ended', () => { finished = true; syncSteps(); onward(); });

  let cur = 0;
  let local = 0;
  let active = false;
  /** the sheet is all the way up: until it is, the first frame holds its poster, where the ring's card is landing (src/ui/handover.ts) */
  let risen = false;
  /** the film has been put back to its poster, to start from there again */
  let rewound = false;
  /** the film on show has played to its end, and rests on its last frame */
  let finished = false;
  /** on the way to the next workflow, after a film's end */
  let moving = false;
  /** when the scroll last moved, so the tour never pulls the page while the visitor is moving it */
  let movedAt = 0;
  /* each film starts from the frame its poster was taken from (a few frames
     in), so the film coming in over the poster is no change at all */
  const startOf = (i: number) => (Math.round(posterTime(WORKFLOWS[i]!) * FILM.fps) + 0.3) / FILM.fps;
  let shownSec = -1;
  let tl: gsap.core.Timeline | null = null;
  let loaded = -1;

  function load(i: number): void {
    if (loaded === i) return;
    loaded = i;
    video.pause();
    video.classList.remove('is-playing');
    slides[i]!.querySelector('.tour__media')!.append(video);
    // the frame is smaller than the player's, so never the largest size; a phone held upright has its own cut
    const size = upright.matches ? 'phone' : filmSize();
    video.src = `${mediaUrl(MEDIA.film(WORKFLOWS[i]!.key, size === 'full' ? '720' : size))}#t=${startOf(i).toFixed(3)}`;
    rewound = false;
    finished = false;
    shownSec = -1;
  }

  function wanted(): boolean {
    const s = store.get();
    return active && risen && !s.motionPaused && !reduceMotion && s.mode === 'grid' && !document.hidden;
  }

  function syncVideo(): void {
    if (wanted()) {
      if (loaded !== cur) load(cur);
      if (rewound) { rewound = false; video.currentTime = startOf(cur); }
      if (finished) onward();
      else if (video.paused) video.play().catch(() => {});
    } else {
      if (!video.paused) video.pause();
      // the sheet going back down: the film gives way to its poster, and starts from it next time
      if (!risen && video.classList.contains('is-playing')) { video.classList.remove('is-playing'); rewound = true; }
      // out of the tour after a film has ended: coming back, it plays again from its poster
      if (finished && (!active || !risen)) { finished = false; rewound = true; }
    }
  }

  /*
   * A film that has ended moves the tour on to the next workflow, as the
   * arrows would. Not while the visitor is scrolling (they are already on
   * their way somewhere), not from under a keyboard's focus in the slide
   * (it would be left on nothing), and not past the last: that one rests on
   * its end. Held back then, it moves on when nothing holds it any more and
   * the film is wanted again (Pause motion lifted, the tab shown again).
   */
  function onward(): void {
    if (moving || !finished || !wanted() || jumping || cur >= N - 1) return;
    if (performance.now() - movedAt < 400) return;
    if (slides[cur]!.querySelector(':focus-visible')) return;
    moving = true;
    void travelTo(yOf(cur + 1)).finally(() => { moving = false; });
  }

  /** the steps and the clock: from the film while it plays, otherwise from the scroll */
  function syncSteps(): void {
    const list = rows[cur]!;
    const dur = filmDuration(WORKFLOWS[cur]!);
    // a film that has ended keeps its steps all done, rather than falling back to the scroll's
    const playing = loaded === cur && (!video.paused || finished) && video.readyState >= 2;
    const t = playing ? video.currentTime : local * dur;
    // the step the film is on: the last one it has reached (the first, before it starts)
    let at = 0;
    list.forEach((r, k) => { if (t >= r.t) at = k; });
    list.forEach((r, k) => { if ((k === at) !== r.on) { r.on = k === at; r.li.classList.toggle('is-current', r.on); } });
    for (const r of list) {
      const p = Math.round(clamp((t - r.t) / Math.max(0.01, r.end - r.t), 0, 1) * 400) / 400;
      if (p === r.p) continue;
      r.p = p;
      r.li.style.setProperty('--p', String(p));
      r.li.classList.toggle('is-done', p >= 1);
    }
    const sec = Math.floor(t);
    if (sec !== shownSec) {
      shownSec = sec;
      const clock = slides[cur]!.querySelector('.tour__clock');
      if (clock) clock.textContent = fmtTime(t);
    }
  }
  const tick = () => syncSteps();

  /* a hidden slide's poster is not fetched until the slide shows (it is
     lazy, and hidden), so a change of slide would wipe in an empty frame
     on a slow line: the posters either side of the one showing are fetched
     and decoded ahead */
  const ahead = (i: number) => {
    for (const k of [i - 1, i + 1]) {
      const p = slides[k]?.querySelector<HTMLImageElement>('.tour__poster');
      if (!p || p.loading === 'eager') continue;
      p.loading = 'eager';
      p.decode().catch(() => {});
    }
  };

  /** the parts of a slide that come in, in the order they come */
  const partsOf = (s: HTMLElement) => ({
    copy: s.querySelector<HTMLElement>('.tour__copy')!,
    media: s.querySelector<HTMLElement>('.tour__media')!,
    poster: s.querySelector<HTMLElement>('.tour__poster')!,
    cat: s.querySelector<HTMLElement>('.tour__cat')!,
    lede: s.querySelector<HTMLElement>('.tour__lede')!,
    steps: s.querySelectorAll<HTMLElement>('.tour__step'),
    open: s.querySelector<HTMLElement>('.tour__open')!,
  });

  function show(i: number, dir: number, instant: boolean): void {
    const prev = slides[cur]!;
    const next = slides[i]!;
    cur = i;
    idxs.forEach((el) => { el.textContent = pad2(i + 1); });
    onIndex(i);
    ticks.forEach((t, k) => {
      t.classList.toggle('is-on', k === i);
      t.classList.toggle('is-done', k < i);
      if (k !== i) t.style.setProperty('--p', k < i ? '1' : '0');
      if (k === i) t.setAttribute('aria-current', 'step'); else t.removeAttribute('aria-current');
    });
    rows[i]!.forEach((r) => { r.p = -1; r.on = false; r.li.classList.remove('is-current'); });
    tl?.progress(1).kill();
    tl = null;
    prev.classList.remove('is-on');
    next.classList.add('is-on');
    ahead(i);
    if (wanted()) load(i);
    syncSteps();
    if (instant || reduceMotion || prev === next) return;

    const a = partsOf(prev);
    const b = partsOf(next);
    const side = sideways.matches;
    // from below on a large screen, as the scroll goes; from the side on a phone, as the swipe goes
    const wipe = side
      ? (dir > 0 ? 'inset(0% 0% 0% 100% round 16px)' : 'inset(0% 100% 0% 0% round 16px)')
      : (dir > 0 ? 'inset(100% 0% 0% 0% round 16px)' : 'inset(0% 0% 100% 0% round 16px)');
    const away = side ? { x: -36 * dir } : { y: -26 * dir };
    const from = side ? { x: 28 * dir, y: 0 } : { x: 0, y: 18 * dir };
    prev.classList.add('is-leaving');
    /* each tween clears only what it moved: the steps carry their place in
       the row (--k) and their fill (--p) in their own style, which must stay */
    const moved = { clearProps: 'opacity,transform' };
    tl = gsap.timeline({
      defaults: { ease: EASE_OUT },
      onComplete: () => {
        prev.classList.remove('is-leaving');
        gsap.set([a.copy, a.media], moved);
      },
    })
      .to(a.copy, { opacity: 0, ...away, duration: DUR.ui, ease: EASE_IN }, 0)
      .to(a.media, { opacity: 0, scale: 0.97, duration: DUR.ui, ease: EASE_IN }, 0)
      .fromTo(b.media,
        { clipPath: wipe },
        { clipPath: 'inset(0% 0% 0% 0% round 16px)', duration: DUR.move, clearProps: 'clipPath' }, 0.1)
      .fromTo(b.poster, { scale: 1.12 }, { scale: 1, duration: DUR.move, clearProps: 'transform' }, 0.1)
      .fromTo(b.cat, { opacity: 0, ...from }, { opacity: 1, x: 0, y: 0, duration: DUR.panel, ...moved }, 0.18)
      .fromTo(linesOf(next), { yPercent: 110 }, { yPercent: 0, duration: DUR.move, stagger: 0.07, clearProps: 'transform' }, 0.2)
      .fromTo(b.lede, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: DUR.panel, ...moved }, 0.32)
      .fromTo(b.steps, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: DUR.panel, stagger: 0.04, ...moved }, 0.38)
      .fromTo(b.open, { opacity: 0 }, { opacity: 1, duration: DUR.panel, clearProps: 'opacity' }, 0.48);
  }

  /* --------------------------------------------------------- scroll */
  let enterShown = -1;
  let qShown = -1;
  const seam = root.querySelector<HTMLElement>('.tour__seam');
  const pinned = [...root.querySelector<HTMLElement>('.tour__pin')!.children] as HTMLElement[];
  const whereFill = root.querySelector<HTMLElement>('.tour__where-bar i');
  onScroll(({ y, vh, dy }) => {
    if (dy && !moving) movedAt = performance.now();
    const box = sectionBox('workflows');
    if (!box) return;
    const span = Math.max(1, box.height - vh);
    const q = clamp((y - box.top) / span, 0, 1);
    // how far the tour has risen over the ring: 0 with its top at the bottom of the screen, 1 at the top
    const enter = Math.round(clamp(1 - (box.top - y) / vh, 0, 1) * 1000) / 1000;
    /* rising, its corners straighten, its seam of light fades and its
       contents come up a little slower than it does; written straight onto
       those, since a custom property on the tour reached all of its
       hundreds of elements every frame */
    if (enter !== enterShown) {
      enterShown = enter;
      const r = ((1 - enter) * 36).toFixed(1);
      root.style.borderRadius = enter < 1 ? `${r}px ${r}px 0 0` : '';
      if (seam) seam.style.opacity = enter < 1 ? (1 - enter).toFixed(3) : '0';
      const lag = enter < 1 ? `translateY(${((1 - enter) * 90).toFixed(1)}px)` : '';
      for (const el of pinned) if (el.style.transform !== lag) el.style.transform = lag;
    }
    const qr = Math.round(q * 400) / 400;
    if (qr !== qShown) { qShown = qr; if (whereFill) whereFill.style.transform = `scaleX(${qr})`; }

    const wasActive = active;
    risen = enter >= 1;
    active = enter > 0.55 && y < box.top + box.height - vh * 0.4;
    if (active !== wasActive) {
      if (active) { gsap.ticker.add(tick); ahead(cur); } else gsap.ticker.remove(tick);
    }
    const i = Math.min(N - 1, Math.floor(q * N));
    local = clamp(q * N - i, 0, 1);
    if (i !== cur) show(i, i > cur ? 1 : -1, jumping || !active);
    ticks[cur]!.style.setProperty('--p', local.toFixed(3));
    syncVideo();
    if (!active) syncSteps();
  });
  store.subscribe((s, prev) => { if (s.motionPaused !== prev.motionPaused || s.mode !== prev.mode) syncVideo(); });
  document.addEventListener('visibilitychange', syncVideo);

  /* ----------------------------------------------------- the index */
  /** where workflow i starts in the tour's stretch of the page (a little in, so it is plainly that one) */
  const yOf = (i: number) => {
    const box = sectionBox('workflows')!;
    return box.top + ((i + 0.06) / N) * Math.max(1, box.height - innerHeight);
  };
  const list = root.querySelector<HTMLDialogElement>('#tourList');
  root.addEventListener('click', (e) => {
    const t = (e.target as Element).closest<HTMLElement>('[data-tour-go], [data-tour-step]');
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    const to = t.dataset.tourGo !== undefined ? Number(t.dataset.tourGo) : clamp(cur + Number(t.dataset.tourStep), 0, N - 1);
    if (list?.open && list.contains(t)) closeList(false);
    void travelTo(yOf(to));
  });

  /* ----------------------------------------------------- the list */
  /* the count between the arrows opens all twelve as a sheet from the
     bottom edge: the one showing marked, a tap on any going there; it
     closes on a tap outside it, Escape, or a swipe down */
  const where = root.querySelector<HTMLButtonElement>('.tour__where');
  function openList(): void {
    if (!list || list.open) return;
    list.querySelectorAll('.tlist__a').forEach((a, k) => {
      if (k === cur) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
    });
    list.classList.remove('is-closing');
    list.showModal();
    list.querySelector<HTMLElement>('[aria-current]')?.focus();
    if (!reduceMotion) gsap.fromTo(list, { yPercent: 100 }, { yPercent: 0, duration: DUR.move, ease: SPRING, clearProps: 'transform' });
  }
  function closeList(returnFocus = true): void {
    if (!list?.open || list.classList.contains('is-closing')) return;
    const done = () => {
      list.close();
      list.classList.remove('is-closing');
      gsap.set(list, { clearProps: 'transform' });
      if (returnFocus) where?.focus();
    };
    if (reduceMotion) { done(); return; }
    list.classList.add('is-closing');
    gsap.to(list, { yPercent: 100, y: 0, duration: DUR.ui, ease: EASE_IN, onComplete: done });
  }
  where?.addEventListener('click', openList);
  // a tap on the dimmed page lands on the dialog itself, outside its sheet
  list?.addEventListener('click', (e) => { if (e.target === list) closeList(); });
  list?.addEventListener('cancel', (e) => { e.preventDefault(); closeList(); });
  if (list) pullToClose(list, () => closeList());

  /* a swipe sideways on a phone: the slide follows the finger exactly
     (reluctantly at either end), and past a short distance, or thrown, it
     carries on the way it was going, at the speed it was going, while the
     next one comes in; a scroll up or down is left to the page */
  const deck = root.querySelector<HTMLElement>('.tour__slides')!;
  let sx = 0, sy = 0, dx = 0;
  let axis: 'x' | 'y' | null = null;
  /** the finger's speed over its last move, for how hard it threw */
  let lastX = 0, lastT = 0, vx = 0;
  deck.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    sx = lastX = e.clientX; sy = e.clientY; lastT = performance.now(); dx = 0; vx = 0; axis = null;
    gsap.killTweensOf(slides[cur]!);
  });
  deck.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') return;
    const mx = e.clientX - sx, my = e.clientY - sy;
    if (!axis) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.2) axis = 'x';
      else if (Math.abs(my) > 10) axis = 'y';
    }
    if (axis !== 'x') return;
    const now = performance.now();
    vx = (e.clientX - lastX) / Math.max(1, now - lastT);
    lastX = e.clientX; lastT = now;
    dx = mx;
    const end = (cur === 0 && dx > 0) || (cur === N - 1 && dx < 0);
    gsap.set(slides[cur]!, { x: end ? Math.sign(dx) * Math.sqrt(Math.abs(dx)) * 4 : dx });
  });
  const letGo = () => {
    if (axis !== 'x') { axis = null; return; }
    axis = null;
    // a finger that stopped before it let go threw nothing
    if (performance.now() - lastT > 90) vx = 0;
    const thrown = Math.abs(vx) > 0.45;
    const step = Math.abs(dx) > 64 || (thrown && Math.abs(dx) > 20) ? (dx < 0 ? 1 : -1) : 0;
    const to = clamp(cur + step, 0, N - 1);
    const slide = slides[cur]!;
    if (to === cur) {
      gsap.to(slide, { x: 0, duration: DUR.panel, ease: SPRING, clearProps: 'transform' });
      return;
    }
    // on, out of the frame, at the finger's speed (no slower than a brisk swipe), as the next one comes in
    const away = -step * innerWidth * 0.6;
    const speed = Math.max(Math.abs(vx), 1.1);
    const time = clamp(Math.abs(away - dx) / speed / 1000, 0.12, DUR.ui);
    gsap.to(slide, { x: away, opacity: 0, duration: time, ease: 'none', onComplete: () => gsap.set(slide, { clearProps: 'transform,opacity' }) });
    void travelTo(yOf(to));
  };
  deck.addEventListener('pointerup', letGo);
  deck.addEventListener('pointercancel', letGo);
  addEventListener('keydown', (e) => {
    if (store.get().section !== 'workflows' || store.get().mode !== 'grid' || e.target !== document.body) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    void travelTo(yOf(clamp(cur + (e.key === 'ArrowRight' ? 1 : -1), 0, N - 1)));
  });

  return {
    get current() { return cur; },
    still() {
      if (loaded === cur && video.classList.contains('is-playing') && video.readyState >= 2) return { image: video, at: video.currentTime };
      const poster = slides[cur]!.querySelector<HTMLImageElement>('.tour__poster');
      return poster?.complete && poster.naturalWidth ? { image: poster, at: startOf(cur) } : null;
    },
  };
}
