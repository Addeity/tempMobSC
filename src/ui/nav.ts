/*
 * The bar at the top, on a phone. Over the ring and the tour it stays, with
 * the ring's Start and End under it. Past them, where the page is read, it
 * gets out of the way: it slides off the top while the page scrolls down and
 * comes back the moment it scrolls up, so the screen is the page's and the
 * bar is a flick away. After a jump it is there to say where the page is;
 * with the menu open, or a control in it focused, it stays.
 */
import { PHONE } from '../lib/motion.ts';
import { jumping, onScroll } from './scroll.ts';

/** how far the page has to go one way before the bar follows it, in px */
const HIDE_AFTER = 56;
const SHOW_AFTER = 18;

export function navAway(): void {
  const body = document.body;
  const phone = matchMedia(PHONE);
  let run = 0;
  let away = false;
  const set = (on: boolean) => {
    if (on === away) return;
    away = on;
    body.classList.toggle('is-nav-away', on);
  };
  onScroll(({ dy }) => {
    if (!phone.matches || jumping || !body.classList.contains('is-paged') || body.classList.contains('is-menu-open')) {
      run = 0;
      set(false);
      return;
    }
    if (!dy) return;
    // a run of scrolling one way; a turn starts a new one
    if ((dy > 0) !== (run > 0)) run = 0;
    run += dy;
    if (run > HIDE_AFTER) set(true);
    else if (run < -SHOW_AFTER) set(false);
  });
}
