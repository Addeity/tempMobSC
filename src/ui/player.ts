/*
 * The workflow player: what a card opens.
 *
 * The screen grows out of the card that was clicked (a FLIP from the card's
 * projected rectangle), opens on that card's current frame, and carries on
 * the film from the same moment. The steps light up as the film reaches
 * them; a click on a step seeks to it.
 *
 * Motion: in, the screen leads at full opacity and the copy follows it up
 * in a stagger; out, everything goes together, faster than it came.
 */
import { MEDIA, WORKFLOWS, filmDuration } from '@site/content';
import { filmSize, mediaUrl } from '../lib/media.ts';
import { byId, fmtTime, pad2 } from '../lib/dom.ts';
import { DUR, EASE_IN, EASE_OUT, SPRING, gsap, reduceMotion } from '../lib/motion.ts';
import { store } from '../lib/store.ts';
import type { VideoAtlas } from '../scene/atlas.ts';
import type { Still } from './tour.ts';

const N = WORKFLOWS.length;
/** every part the timelines touch, so a cut-short open or close never leaves one half-faded */
const PARTS = ['.flow__top', '.flow__media', '.flow__track', '.flow__meta', '.flow__copy', '.flow__h', '.flow__lede', '.flow__steps', '.flow__steps li', '.flow__note'];

interface StepRow { t: number; end: number; li: HTMLLIElement; seg: HTMLElement; fill: HTMLElement; p: number }

/**
 * Where the player's screen (its own rectangle, `at`) must be put to show as
 * `into`: scaled whole to cover it, centred on it, and clipped to it, so a
 * frame of another shape (the tour's on a phone is upright) is matched
 * without its picture being stretched. For GSAP, from the top left.
 */
function fit(at: DOMRect, into: DOMRect, radius: number): gsap.TweenVars {
  const s = Math.max(into.width / at.width, into.height / at.height);
  const ix = (at.width - into.width / s) / 2;
  const iy = (at.height - into.height / s) / 2;
  return {
    transformOrigin: '0 0',
    x: into.left + into.width / 2 - (at.width * s) / 2 - at.left,
    y: into.top + into.height / 2 - (at.height * s) / 2 - at.top,
    scale: s,
    clipPath: `inset(${iy.toFixed(2)}px ${ix.toFixed(2)}px ${iy.toFixed(2)}px ${ix.toFixed(2)}px round ${(radius / s).toFixed(2)}px)`,
  };
}

/** draw a picture into a canvas to cover it from the middle, as the frame it came from showed it; false if there is nothing to draw yet */
function cover(g: CanvasRenderingContext2D, image: HTMLVideoElement | HTMLImageElement, w: number, h: number): boolean {
  const iw = image instanceof HTMLVideoElement ? image.videoWidth : image.naturalWidth;
  const ih = image instanceof HTMLVideoElement ? image.videoHeight : image.naturalHeight;
  if (!iw || !ih) return false;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s, sh = h / s;
  try { g.drawImage(image, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, w, h); } catch { return false; }
  return true;
}

export class Player {
  private readonly root = byId('flow');
  private readonly inner = byId('flow').querySelector<HTMLElement>('.flow__inner')!;
  private readonly surface = byId('flow').querySelector<HTMLElement>('.flow__surface')!;
  private readonly scrim = byId('flow').querySelector<HTMLElement>('.flow__scrim')!;
  private readonly screen = byId('flowScreen');
  /** where the film came from, asked again when it closes */
  private back: (() => DOMRect | null) | null = null;
  private readonly video = byId<HTMLVideoElement>('flowVideo');
  private readonly snap = byId<HTMLCanvasElement>('flowSnap');
  private readonly playBtn = byId<HTMLButtonElement>('flowPlay');
  private readonly track = byId('flowTrack');
  private readonly stepsEl = byId('flowSteps');
  private readonly timeEl = byId('flowTime');

  private index = -1;
  private rows: StepRow[] = [];
  private shownSec = -1;
  private active = -1;
  private lastFocus: HTMLElement | null = null;
  private tl: gsap.core.Timeline | null = null;
  private readonly tick = () => this.sync();

  private atlas: VideoAtlas | null = null;
  /** told the workflow showing after every open, swap and close (-1): the address follows it */
  onChange: (index: number) => void = () => {};

  constructor() {
    // a prerendered film page carries the browser's controls for anyone without scripts; here the player's own take over
    this.video.removeAttribute('controls');
    this.root.addEventListener('click', (e) => {
      const t = e.target as Element;
      if (t.closest('[data-flow-close]')) this.close();
      const go = t.closest<HTMLElement>('[data-flow-go]');
      if (go) this.open((this.index + Number(go.dataset.flowGo) + N) % N);
    });
    this.playBtn.addEventListener('click', () => (this.video.paused ? this.play() : this.video.pause()));
    this.video.addEventListener('play', () => this.setPlayState(true));
    this.video.addEventListener('pause', () => this.setPlayState(false));
    addEventListener('keydown', (e) => this.onKey(e));
  }

  get isOpen(): boolean { return this.index >= 0; }
  get current(): number { return this.index; }

  /** the scene loads after the page; from then on the player opens on the card's own frame */
  setAtlas(atlas: VideoAtlas): void { this.atlas = atlas; }

  /**
   * Open workflow i, growing out of `from` (a card's screen on the page, or
   * the tour's frame) when given. `back` says where that is when the player
   * closes, if it is still on the screen, so the film can shrink back into it.
   * `still` is what that frame shows, when it is not a card's: the screen
   * opens on that picture and the film carries on from its moment.
   */
  open(i: number, from?: DOMRect | null, back?: () => DOMRect | null, still?: Still | null): void {
    if (this.isOpen) { this.swap(i); return; }
    this.back = back ?? null;
    this.fill(i, !!from, still ?? null);
    this.lastFocus = document.activeElement as HTMLElement | null;
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-flow-open');
    store.set({ flowIndex: i });
    this.onChange(i);
    gsap.ticker.add(this.tick);
    this.inner.focus({ preventScroll: true });
    // landing on a film's own address, it has been on screen since the first paint
    if (reduceMotion || document.documentElement.hasAttribute('data-flow')) return;

    this.tl?.kill();
    gsap.set([this.scrim, this.surface, this.screen, ...PARTS], { clearProps: 'all' });
    const to = this.screen.getBoundingClientRect();
    const tl = (this.tl = gsap.timeline({ defaults: { ease: EASE_OUT } }));
    tl.fromTo(this.scrim, { opacity: 0 }, { opacity: 1, duration: DUR.panel }, 0)
      .fromTo(this.surface, { opacity: 0, scale: 0.985 }, { opacity: 1, scale: 1, duration: DUR.panel }, 0);
    if (from && to.width > 0) {
      tl.fromTo(this.screen, fit(to, from, 6), { ...fit(to, to, 14), duration: DUR.move, ease: SPRING, clearProps: 'transform,clipPath' }, 0);
    } else {
      tl.fromTo(this.screen, { y: 14, scale: 0.96, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: DUR.panel, clearProps: 'all' }, 0);
    }
    tl.from('.flow__top', { opacity: 0, y: 10 }, 0.12)
      .from(['.flow__h', '.flow__lede'], { opacity: 0, y: 12, stagger: 0.06 }, 0.2)
      .from(['.flow__track', '.flow__meta'], { opacity: 0, y: 8 }, 0.3)
      .from('.flow__steps li', { opacity: 0, y: 10, stagger: 0.055 }, 0.32)
      .from('.flow__note', { opacity: 0 }, 0.56);
  }

  close(): void {
    if (!this.isOpen) return;
    this.index = -1;
    this.video.pause();
    gsap.ticker.remove(this.tick);
    document.body.classList.remove('is-flow-open');
    store.set({ flowIndex: -1 });
    this.onChange(-1);
    const done = () => {
      this.root.classList.remove('is-open');
      this.root.setAttribute('aria-hidden', 'true');
      gsap.set([this.scrim, this.surface, this.screen, this.video, ...PARTS], { clearProps: 'all' });
    };
    this.lastFocus?.focus?.({ preventScroll: true });
    if (reduceMotion) { done(); return; }
    this.tl?.kill();
    /* back into the frame it came from, when that is still on the screen;
       otherwise the player simply fades */
    const home = this.back?.() ?? null;
    const now = this.screen.getBoundingClientRect();
    const onScreen = !!home && home.width > 8 && home.bottom > 0 && home.top < innerHeight;
    this.tl = gsap.timeline({ defaults: { ease: EASE_IN }, onComplete: done })
      .to(['.flow__top', '.flow__copy'], { opacity: 0, y: -6, duration: DUR.micro }, 0);
    if (onScreen && now.width > 0) {
      gsap.set(this.screen, fit(now, now, 14));
      this.tl.to(this.screen, { ...fit(now, home!, 6), duration: DUR.panel, ease: SPRING }, 0)
        .to(this.scrim, { opacity: 0, duration: DUR.ui }, 0.04)
        .to(this.surface, { opacity: 0, duration: DUR.micro }, DUR.panel - DUR.micro);
    } else {
      this.tl.to('.flow__media', { opacity: 0, y: -6, duration: DUR.micro }, 0)
        .to([this.surface, this.scrim], { opacity: 0, duration: DUR.ui }, 0.06);
    }
    this.back = null;
  }

  private swap(i: number): void {
    const copy = ['.flow__h', '.flow__lede', '.flow__steps', '.flow__note'];
    if (reduceMotion) { this.fill(i, false); this.onChange(i); return; }
    this.tl?.kill();
    this.tl = gsap.timeline()
      .to([...copy, this.video], { opacity: 0, duration: DUR.micro, ease: EASE_IN })
      .add(() => { this.fill(i, false); this.onChange(i); })
      .fromTo(copy, { opacity: 0, y: 8 }, { opacity: 1, y: 0, stagger: 0.04, ease: EASE_OUT });
  }

  /* --------------------------------------------------------- content */
  private fill(i: number, continueFromCard: boolean, still: Still | null = null): void {
    const wf = WORKFLOWS[i]!;
    const dur = filmDuration(wf);
    this.index = i;
    byId('flowIndex').textContent = pad2(i + 1);
    byId('flowOf').textContent = `/ ${pad2(N)}`;
    byId('flowCat').textContent = wf.category;
    byId('flowTitle').textContent = wf.title;
    byId('flowLede').textContent = wf.lede;
    byId('flowNote').textContent = wf.note;
    byId('flowDur').textContent = fmtTime(dur);
    byId('footSel').textContent = `${pad2(i + 1)} / ${pad2(N)}`;
    this.timeEl.textContent = '0:00';
    this.shownSec = -1;
    this.active = -1;

    this.stepsEl.textContent = '';
    this.track.textContent = '';
    this.rows = wf.steps.map((step, k) => {
      const end = wf.steps[k + 1]?.t ?? dur;
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'flow__step';
      // named by what it shows (time, title, words), so a voice command can say what is on screen (WCAG 2.5.3)
      btn.innerHTML = '<span class="flow__n"></span><span class="flow__b"><span class="flow__st"></span><span class="flow__sd"></span></span>';
      btn.querySelector('.flow__n')!.textContent = fmtTime(step.t);
      btn.querySelector('.flow__st')!.textContent = step.title;
      btn.querySelector('.flow__sd')!.textContent = step.body;
      btn.addEventListener('click', () => this.seek(step.t));
      li.appendChild(btn);
      this.stepsEl.appendChild(li);

      const seg = document.createElement('span');
      seg.className = 'flow__seg';
      seg.style.setProperty('--w', Math.max(0.4, end - step.t).toFixed(2));
      const fill = document.createElement('i');
      seg.appendChild(fill);
      this.track.appendChild(seg);
      return { t: step.t, end, li, seg, fill, p: -1 };
    });

    // open on the frame it came from (the card's, or the tour's), so the screen is never empty while the film loads
    const g = this.snap.getContext('2d')!;
    g.fillStyle = '#0b0f18';
    g.fillRect(0, 0, this.snap.width, this.snap.height);
    const snapped = still ? cover(g, still.image, this.snap.width, this.snap.height) : (this.atlas?.drawCell(i, g, this.snap.width, this.snap.height) ?? false);
    if (snapped) this.video.removeAttribute('poster');
    else this.video.poster = mediaUrl(MEDIA.posterWeb(wf.key));
    /* the film dissolves in over the card's frame once it is actually
       playing, rather than cutting from the bare page to the framed window */
    gsap.killTweensOf(this.video);
    gsap.set(this.video, { opacity: snapped ? 0 : 1 });
    if (snapped) {
      this.video.addEventListener('playing', () => {
        if (this.index === i) gsap.to(this.video, { opacity: 1, duration: reduceMotion ? 0 : DUR.panel, ease: EASE_OUT });
      }, { once: true });
    }

    // the size is chosen now, from the connection as measured so far (src/lib/media.ts)
    this.video.src = mediaUrl(MEDIA.film(wf.key, filmSize()));
    this.video.load();
    /* the card's atlas cell and the film hold the same footage, the cell
       scaled to the loop: carrying on from the card's moment is one
       proportion. The tour's frame plays the film itself: its own moment */
    const at = still && snapped ? still.at : continueFromCard && snapped && this.atlas ? this.atlas.loopProgress * dur : -1;
    if (at >= 0) {
      this.video.addEventListener('loadedmetadata', () => {
        if (this.index === i && at > 0.4 && at < dur - 0.4) this.video.currentTime = at;
      }, { once: true });
    }
    if (reduceMotion) this.setPlayState(false);
    else this.play();
  }

  private play(): void {
    this.video.play().catch(() => this.setPlayState(false));
  }

  private setPlayState(playing: boolean): void {
    this.playBtn.dataset.state = playing ? 'playing' : 'paused';
    this.playBtn.setAttribute('aria-label', playing ? 'Pause film' : 'Play film');
  }

  private seek(t: number): void {
    this.video.currentTime = t + 0.02;
    if (this.video.paused) this.play();
  }

  /** on GSAP's ticker while open: the time, the track, the lit step */
  private sync(): void {
    if (!this.rows.length) return;
    const t = this.video.currentTime || 0;
    const sec = Math.floor(t);
    if (sec !== this.shownSec) { this.timeEl.textContent = fmtTime(t); this.shownSec = sec; }
    let active = 0;
    this.rows.forEach((r, k) => {
      if (t >= r.t) active = k;
      const p = Math.round(Math.min(1, Math.max(0, (t - r.t) / Math.max(0.01, r.end - r.t))) * 500) / 500;
      if (p !== r.p) { r.fill.style.setProperty('--p', String(p)); r.p = p; }
    });
    if (active !== this.active) {
      this.rows.forEach((r, k) => {
        r.li.classList.toggle('is-active', k === active);
        r.li.classList.toggle('is-done', k < active);
        r.seg.classList.toggle('is-active', k === active);
      });
      this.active = active;
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.isOpen) return;
    if (e.key === 'Escape') { this.close(); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      this.open((this.index + (e.key === 'ArrowRight' ? 1 : -1) + N) % N);
    } else if (e.key === ' ' && !(e.target instanceof Element && e.target.closest('button, a'))) {
      e.preventDefault();
      this.playBtn.click();
    } else if (e.key === 'Tab') {
      // keep focus inside the dialog
      const focusable = [...this.inner.querySelectorAll<HTMLElement>('button, [href]')].filter((el) => el.offsetParent !== null);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === this.inner)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
}
