/*
 * The sections, as a phone holds them (styles/phone.css).
 *
 * Rows a thumb swipes through (the plans, where it can run, what it works
 * with): under each, a pill glides from dot to dot with the swipe itself; the
 * row's place, in cards, is written as --at every frame it moves, and the CSS
 * sets the pill there with a transform.
 *
 * The security list folds to a grid of its titles, each opening where it is
 * tapped; on a larger screen every one stays open, as it is without scripts.
 *
 * The table of what each plan includes shows one plan beside the
 * capabilities at a time, picked by the switch above it.
 */
import { DUR, PHONE, SPRING_SOFT, gsap, reduceMotion } from '../lib/motion.ts';

export function swipeRows(): void {
  document.querySelectorAll<HTMLElement>('.swipe').forEach((row) => {
    const dots = row.nextElementSibling;
    if (!(dots instanceof HTMLElement) || !dots.classList.contains('dots')) return;
    dots.style.setProperty('--count', String(dots.children.length));
    let queued = false;
    const sync = () => {
      queued = false;
      const cards = [...row.children] as HTMLElement[];
      if (!cards[1]) return;
      const step = cards[1].offsetLeft - cards[0]!.offsetLeft;
      const at = Math.min(dots.children.length - 1, Math.max(0, row.scrollLeft / Math.max(1, step)));
      dots.style.setProperty('--at', at.toFixed(3));
    };
    row.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(sync); } }, { passive: true });
  });
}

export function foldControls(): void {
  const items = [...document.querySelectorAll<HTMLDetailsElement>('.control__d')];
  if (!items.length) return;
  const phone = matchMedia(PHONE);
  const fit = () => items.forEach((d) => { d.open = !phone.matches; });
  fit();
  phone.addEventListener('change', fit);
}

export function planPick(): void {
  const pick = document.querySelector<HTMLElement>('.pick');
  const sheet = document.getElementById('planTable');
  if (!pick || !sheet) return;
  const pill = pick.querySelector<HTMLElement>('.pick__pill')!;
  const btns = [...pick.querySelectorAll<HTMLButtonElement>('button')];
  const place = (btn: HTMLElement, animate: boolean) =>
    gsap.to(pill, { x: btn.offsetLeft, width: btn.offsetWidth, duration: animate && !reduceMotion ? DUR.panel : 0, ease: SPRING_SOFT });
  pick.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!btn) return;
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    sheet.dataset.col = btn.dataset.col;
    place(btn, true);
  });
  const sync = () => { const on = btns.find((b) => b.getAttribute('aria-pressed') === 'true'); if (on && on.offsetWidth) place(on, false); };
  sync();
  document.fonts?.ready.then(sync);
  // laid out only once its section comes near (content-visibility), so measured again when it does
  new ResizeObserver(sync).observe(pick);
}
