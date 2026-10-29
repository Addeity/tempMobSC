/*
 * The phone menu. Under 900px the nav's links fold into one button, which
 * opens the menu as a sheet rising from the bottom edge, where a thumb is:
 * the page dims behind it, its links come up after it in order, and it
 * closes on the button, a tap on the dimmed page, Escape, following a link,
 * or a swipe down on the sheet, which follows the finger and lets go
 * either way. The keyboard stays inside it while it is open, and it closes
 * when the window grows wide enough for the nav to come back.
 */
import { DUR, EASE_IN, EASE_OUT, SPRING, gsap, reduceMotion } from '../lib/motion.ts';
import { pullToClose } from './pull.ts';

export function phoneMenu(): void {
  const btn = document.querySelector<HTMLButtonElement>('.nav__menu');
  const menu = document.getElementById('menu');
  if (!btn || !menu) return;
  const label = btn.querySelector('.nav__menu-t');
  const links = () => [...menu.querySelectorAll<HTMLElement>('a, button')];
  const scrim = document.createElement('div');
  scrim.className = 'menu-scrim';
  scrim.setAttribute('aria-hidden', 'true');
  scrim.hidden = true;
  menu.before(scrim);
  let open = false;

  function set(on: boolean, returnFocus = true): void {
    if (on === open) return;
    open = on;
    btn!.setAttribute('aria-expanded', String(on));
    if (label) label.textContent = on ? 'Close' : 'Menu';
    document.body.classList.toggle('is-menu-open', on);
    // the page under the menu is out of reach while it is open
    document.querySelectorAll('#main, .foot').forEach((el) => el.toggleAttribute('inert', on));
    gsap.killTweensOf([menu, scrim, ...links()]);

    if (on) {
      menu!.hidden = false;
      scrim.hidden = false;
      links()[0]?.focus({ preventScroll: true });
      if (reduceMotion) return;
      gsap.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: DUR.ui, ease: EASE_OUT });
      gsap.fromTo(menu, { yPercent: 100 }, { yPercent: 0, duration: DUR.move, ease: SPRING, clearProps: 'transform' });
      gsap.fromTo(menu!.querySelectorAll('.menu__link, .menu__end, .menu__fine'), { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: DUR.panel, stagger: 0.04, delay: 0.08, ease: EASE_OUT, clearProps: 'opacity,transform' });
    } else {
      const done = () => { menu!.hidden = true; scrim.hidden = true; gsap.set([menu, scrim], { clearProps: 'all' }); };
      if (returnFocus) btn!.focus({ preventScroll: true });
      if (reduceMotion) { done(); return; }
      gsap.to(scrim, { opacity: 0, duration: DUR.ui, ease: EASE_IN });
      gsap.to(menu, { yPercent: 100, y: 0, duration: DUR.ui, ease: EASE_IN, onComplete: done });
    }
  }

  btn.addEventListener('click', () => set(!open));
  scrim.addEventListener('click', () => set(false));
  // following a link closes it; the router or the player takes it from there
  menu.addEventListener('click', (e) => { if ((e.target as Element).closest('a')) set(false, false); });
  document.addEventListener('keydown', (e) => {
    if (!open) return;
    // Escape closes the menu, and only the menu: not the film or page under it
    if (e.key === 'Escape') { e.stopPropagation(); set(false); return; }
    if (e.key !== 'Tab') return;
    // Tab and Shift+Tab go round the menu and its button, never behind them
    const ring = [btn, ...links()];
    const at = ring.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    ring[(at + (e.shiftKey ? -1 : 1) + ring.length) % ring.length]!.focus();
  }, true);

  // a swipe down closes it (src/ui/pull.ts)
  pullToClose(menu, () => set(false, false));

  matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) set(false, false); });
}
