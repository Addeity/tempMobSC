/*
 * The product's own type, served from the site itself: no request leaves for
 * a font host, which suits a product sold on keeping things in house.
 * Four files and no more, since each is a request a slow connection waits
 * on: Newsreader cut to the one weight the site sets, with its optical sizes
 * (tools/newsreader.py); Plex Sans at 400 and 500 (nothing is set heavier);
 * Plex Mono at 500 only, which the small labels set at 400 use as well.
 * Latin only for Plex, and the browser fetches only the subsets a page uses.
 */
// the @font-face rules are imported by src/main.ts, so they stay in the page's own stylesheet

export const SERIF = '"Newsreader", Georgia, serif';
export const SANS = '"IBM Plex Sans", system-ui, sans-serif';
export const MONO = '"IBM Plex Mono", ui-monospace, monospace';

/** what the canvas card faces are drawn in, so they can wait for it */
export const FACE_FONTS = [`400 46px ${SERIF}`, `500 20px ${MONO}`];

/** wait for the faces' fonts, but never hold the page for them */
export function fontsLoaded(timeoutMs: number): Promise<void> {
  const load = Promise.all(FACE_FONTS.map((f) => document.fonts.load(f))).then(() => undefined, () => undefined);
  return Promise.race([load, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}
