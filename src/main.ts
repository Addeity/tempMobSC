import './styles/index.css';
// the faces themselves, declared here so they sit in the page's own stylesheet (lib/fonts.ts says why
// these four, tools/fonts.py why each comes in two parts)
import './fonts/faces.css';

/*
 * The page is readable as HTML, styled and laid out, before any script but
 * this one runs. The interface (and GSAP with it) and the grain wait until
 * the first frame is actually on screen, not merely drawn: fetched and run
 * before it, their 50 kB were part of what the first paint waited on. (The
 * web fonts are not held back: arriving after the first frame, the body
 * text reflows when they land, a shift that costs more than it saves.)
 * Paint timing says when that frame was presented.
 */
function afterFirstPaint(go: () => void): void {
  const start = () => setTimeout(go, 0);
  // a browser without paint timing (Safari before 14.1): the frame after next is as near as it can say
  if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes?.includes('paint')) { requestAnimationFrame(() => start()); return; }
  const painted = () => performance.getEntriesByName('first-contentful-paint').length > 0;
  if (painted()) { start(); return; }
  /* no timer as well: on a slow phone the first paint can take seconds, and
     a timer that gave up on it loaded the interface, GSAP and three.js in
     front of it, the very thing this waits to avoid. A tab opened in the
     background paints when it is first shown, and starts then */
  const watch = new PerformanceObserver(() => { if (painted()) { watch.disconnect(); start(); } });
  watch.observe({ type: 'paint', buffered: true });
}

afterFirstPaint(() => {
  /* the grain, which the first frame did without (styles/base.css). An
     element of its own, not a class on <html>: changing that sends the
     browser over the style of the whole page, a long task on a phone */
  const grain = document.createElement('div');
  grain.className = 'grain';
  grain.setAttribute('aria-hidden', 'true');
  document.body.append(grain);
  void import('./app.ts').then((m) => m.startApp());
});
