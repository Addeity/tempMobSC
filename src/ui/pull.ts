/*
 * A sheet a finger pulls down to close: the menu, the tour's list, Legal on a
 * phone. From anywhere on it while its own scroll is at the top, it follows
 * the finger, downwards only (upwards is its scroll); on letting go it closes
 * if it went a quarter of its height or was flicked, and springs back
 * otherwise. The closing itself is the sheet's own, from wherever the finger
 * left it.
 */
import { DUR, SPRING, gsap } from '../lib/motion.ts';

export function pullToClose(sheet: HTMLElement, close: () => void, scroller: HTMLElement = sheet): void {
  let from: { y: number; t: number } | null = null;
  let pull = 0;
  sheet.addEventListener('touchstart', (e) => {
    if (scroller.scrollTop > 0 || !e.touches[0]) return;
    from = { y: e.touches[0].clientY, t: performance.now() };
    pull = 0;
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (!from || !e.touches[0]) return;
    pull = e.touches[0].clientY - from.y;
    if (pull <= 0) { from = null; gsap.set(sheet, { y: 0 }); return; }
    e.preventDefault();
    gsap.set(sheet, { y: pull });
  }, { passive: false });
  const release = () => {
    if (!from) return;
    const speed = pull / Math.max(1, performance.now() - from.t);
    from = null;
    if (pull > sheet.offsetHeight * 0.25 || (pull > 30 && speed > 0.6)) close();
    else if (pull > 0) gsap.to(sheet, { y: 0, duration: DUR.panel, ease: SPRING });
  };
  sheet.addEventListener('touchend', release);
  sheet.addEventListener('touchcancel', release);
}
