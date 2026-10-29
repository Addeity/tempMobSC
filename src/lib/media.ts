/*
 * How much video this visitor can take, decided from their screen and from
 * what their connection has actually done, not from what the browser claims.
 *
 * The browser's hint (navigator.connection) does not exist in Safari or
 * Firefox, and does not change under DevTools throttling, so the speed is
 * measured: by the time any video is chosen, the page has fetched its fonts
 * and scripts (three.js alone is about 130 kB), and how fast those bytes
 * arrived is the connection's rate. It reads low, about half the line
 * speed (small files never reach full speed), which errs the safe way; the
 * thresholds below are in what it reads, with the line speed they match:
 *
 *   card atlas   full (3.1 Mbps) from 3 on a large screen (a ~6 Mbps line);
 *                half size (0.7 Mbps) from 0.5 (~1 Mbps: Fast 3G plays it);
 *                below that the cards keep their still screens and the
 *                atlas is never fetched
 *   films        1080p (up to 4.2 Mbps) from 4 on a large screen (~8 Mbps);
 *                720p (1.1 Mbps) from 1.6 (~2.5 Mbps; by the time a film
 *                opens, the atlas has usually been measured too, and a big
 *                file reads nearer the line speed); 480p (0.5 Mbps) below
 *
 * Save-Data or a 2g hint means the smallest of each, whatever was measured.
 */
import type { FilmSize } from '@site/content';
import { coarsePointer } from './motion.ts';

type Connection = { saveData?: boolean; effectiveType?: string };
const conn = (navigator as Navigator & { connection?: Connection }).connection;

/** a phone or tablet: fewer pixels to fill, whatever the connection. Asked
    of a media query, not innerWidth: this runs as the module loads, before
    the first paint, and reading innerWidth then makes the browser lay out
    the whole page early just to answer */
export const smallScreen = matchMedia('(max-width: 899.98px)').matches || coarsePointer;

/**
 * Megabits per second the connection has delivered so far: every byte that
 * came over the network (cache hits carry none), over the time spent
 * receiving them. Downloads that overlapped share the pipe, so their time
 * is counted once; the wait before each response starts is latency, not
 * speed, and is left out. Null until there is enough to go on.
 */
export function measuredMbps(): number | null {
  const entries = [
    ...performance.getEntriesByType('navigation'),
    ...performance.getEntriesByType('resource'),
  ] as PerformanceResourceTiming[];
  const spans = entries
    .filter((e) => e.transferSize > 1000 && e.responseEnd > e.responseStart)
    .map((e) => [e.responseStart, e.responseEnd, e.transferSize] as const)
    .sort((a, b) => a[0] - b[0]);
  let bytes = 0, busy = 0, until = -Infinity;
  for (const [start, end, size] of spans) {
    bytes += size;
    busy += Math.max(0, end - Math.max(start, until));
    until = Math.max(until, end);
  }
  if (bytes < 60_000 || busy < 30) return null;
  return (bytes * 8) / (busy * 1000);
}

const thrifty = () => !!conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '');
/* nothing measured (everything came from the cache): the browser's hint, where it has one */
const hintedSlow = () => conn?.effectiveType === '3g';

/** which card atlas to fetch, decided when the ring is built */
export function atlasSize(): 'full' | 'small' | 'still' {
  const mbps = measuredMbps();
  if (thrifty() || (mbps !== null && mbps < 0.5)) return 'still';
  if (smallScreen || (mbps !== null ? mbps < 3 : hintedSlow())) return 'small';
  return 'full';
}

/** which film to play, decided as it opens, from the connection as measured by then */
export function filmSize(): FilmSize {
  const mbps = measuredMbps();
  if (thrifty() || (mbps !== null && mbps < 1.6)) return '480';
  if (smallScreen || (mbps !== null ? mbps < 4 : hintedSlow())) return '720';
  return 'full';
}

/** a path from @site/content's MEDIA, as a URL under the site's base */
export const mediaUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;
