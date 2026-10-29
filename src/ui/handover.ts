/*
 * The ring hands its last card to the tour. As the ring opens, the card of
 * the tour's first workflow turns to face the viewer and comes forward
 * (src/scene/stage.ts), its screen filling presentRect(). As the tour's sheet
 * rises over the ring, the last screen of the ring's scroll, a copy of that
 * screen on the page takes over from the card where it is (the card's
 * screen has already turned to the same still on its way forward, and the
 * copy is whole before the card fades under it, so nothing shows through),
 * and rises with
 * the scroll to where the tour's first frame will be, while the sheet comes
 * up under it and catches it there. When the sheet is up the copy lies
 * exactly over the frame and gives way to it, and the film is already
 * playing there. Scrolled back, the same in reverse: all of
 * it is read from the scroll, so it can stop anywhere.
 *
 * The copy moves by transform alone. Its box is the frame's size; it is
 * scaled to cover the rectangle it is passing through and clipped to it, so
 * it can change shape on the way (the card's screen is 16:9, a phone's frame
 * is taller) without its picture being stretched. Where the frame is is read
 * once as each rise begins, and worked out from the scroll after that, so no
 * frame of the rise waits on a layout.
 */
import { clamp, easeInOutCubic, reduceMotion } from '../lib/motion.ts';
import { presentRect } from '../lib/present.ts';
import { sectionBox } from './router.ts';
import { jumping, onScroll } from './scroll.ts';

/** how much of the sheet's rise the change from card to copy takes, at its start, and from copy to frame, at its end */
const TAKE = 0.08;
const GIVE = 0.05;
/** how far the tour's contents lag behind its sheet while it rises (styles/tour.css, .tour__pin > *) */
const LAG = 90;

export function handover(stage: () => { setHandoff(f: number): void; setPoster(img: HTMLImageElement): void } | null): void {
  const tour = document.getElementById('workflows');
  const frame = tour?.querySelector<HTMLElement>('.tour__slide[data-i="0"] .tour__media');
  const poster = frame?.querySelector<HTMLImageElement>('.tour__poster');
  if (reduceMotion || !tour || !frame || !poster) return;

  const copy = document.createElement('div');
  copy.className = 'handover';
  copy.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  copy.append(img);
  document.body.append(copy);

  /* the still is the frame's own poster, wanted on the card well before the
     frame comes near enough to load it lazily: asked for once the page is
     idle. A screen turned past the phone's width picks the other cut, which
     loads anew and is handed over again. */
  let given = false;
  poster.addEventListener('load', () => { given = false; });
  const fetch = () => { poster.loading = 'eager'; };
  if ('requestIdleCallback' in window) requestIdleCallback(fetch, { timeout: 4000 }); else setTimeout(fetch, 2000);

  let on = false;
  let size = '';
  let corner = 16;
  /** where the frame rests once the sheet is up, read at the start of each rise */
  let home: { left: number; top: number; width: number; height: number } | null = null;
  addEventListener('resize', () => { home = null; });
  const show = (yes: boolean) => {
    if (yes === on) return;
    on = yes;
    copy.classList.toggle('is-on', yes);
    if (yes && !img.getAttribute('src')) img.src = poster.currentSrc || poster.src;
    if (yes) corner = parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 16;
    if (!yes) { frame.style.removeProperty('opacity'); home = null; }
  };

  onScroll(({ y, vh }) => {
    const s = stage();
    const box = sectionBox('workflows');
    if (!s || !box) { show(false); return; }
    if (!given && poster.complete && poster.naturalWidth) { given = true; s.setPoster(poster); }
    // how far the tour's sheet has risen over the ring: 0 at the bottom of the screen, 1 at the top
    const enter = clamp(1 - (box.top - y) / vh, 0, 1);
    /* the copy comes in over the card and is whole by half way through the
       change; only then does the card fade out from under it */
    s.setHandoff(clamp((enter - TAKE * 0.35) / (TAKE * 0.65), 0, 1));
    if (jumping || enter <= 0 || enter >= 1) { show(false); return; }
    show(true);

    /* how far the frame still has to rise: the sheet's way to the top, and
       the little its contents lag behind it */
    const rest = (box.top - y) + (1 - enter) * LAG;
    if (!home) {
      const r = frame.getBoundingClientRect();
      if (!r.width) return;
      home = { left: r.left, top: r.top - rest, width: r.width, height: r.height };
    }
    /* the copy heads for where the frame will rest, and over the last moments
       meets the frame itself as it arrives */
    const give = clamp((enter - (1 - GIVE)) / GIVE, 0, 1);
    const to = { left: home.left, top: home.top + rest * give, width: home.width, height: home.height };
    const key = `${Math.round(to.width)}x${Math.round(to.height)}`;
    if (key !== size) { size = key; copy.style.width = `${to.width}px`; copy.style.height = `${to.height}px`; }
    const from = presentRect(innerWidth, vh);
    const t = easeInOutCubic(clamp((enter - TAKE) / (1 - TAKE - GIVE), 0, 1));
    const w = from.w + (to.width - from.w) * t;
    const h = from.h + (to.height - from.h) * t;
    const cx = from.x + from.w / 2 + (to.left + to.width / 2 - (from.x + from.w / 2)) * t;
    const cy = from.y + from.h / 2 + (to.top + to.height / 2 - (from.y + from.h / 2)) * t;
    // cover the passing rectangle, centred on it, and clip off the rest (in the box's own, unscaled px)
    const sc = Math.max(w / to.width, h / to.height);
    const ix = (to.width - w / sc) / 2, iy = (to.height - h / sc) / 2;
    const radius = corner / sc;
    copy.style.transform = `translate(${(cx - (to.width * sc) / 2).toFixed(2)}px, ${(cy - (to.height * sc) / 2).toFixed(2)}px) scale(${sc.toFixed(4)})`;
    copy.style.clipPath = `inset(${iy.toFixed(2)}px ${ix.toFixed(2)}px round ${radius.toFixed(2)}px)`;
    // in from the card at the start, out into the frame at the end
    copy.style.opacity = String(Math.min(clamp(enter / (TAKE * 0.5), 0, 1), 1 - give));
    frame.style.opacity = String(give);
  });
}
