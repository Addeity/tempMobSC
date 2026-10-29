import type { Workflow } from './types.ts';
import { WORKFLOWS } from './workflows.ts';

export type { Mask, Rect, Step, Workflow } from './types.ts';
export { BRAND, type Brand } from './brand.ts';
export { PAGES, workflowPath, type PageMeta } from './pages.ts';
export { WORKFLOWS, type WorkflowKey } from './workflows.ts';
export {
  COMPANY, FOOTER, LEGAL, PLATFORM, PROOF,
  type Comparison, type Fact, type LegalSection, type Logo, type Node, type Person, type Point,
  type Question, type Quote, type Requirement, type Status, type Story, type Tool,
} from './company.ts';
export {
  DEMO_API, DEMO_INBOX, SERVICES, bookingMode, formEndpoint, type Analytics, type Services,
} from './services.ts';

/** The source recording and the crop that drops its browser chrome, landing on exact 16:9. */
export const SOURCE = {
  file: 'Video.mov',
  crop: { x: 20, y: 96, width: 2984, height: 1678 },
} as const;

/** The full-quality film each workflow plays in the player. */
export const FILM = { width: 1920, height: 1080, fps: 30 } as const;

/**
 * The card atlas: every workflow in one video, a grid of cells in WORKFLOWS
 * order, each clip time-scaled to the same loop so the ring decodes a
 * single stream however many cards are on screen.
 */
export const ATLAS = { cols: 4, rows: 3, cellWidth: 640, cellHeight: 360, fps: 24, loop: 12 } as const;

/** a film's three sizes: 1080p, 720p (about 1.1 Mbps) and 480p (about half that, for slow connections) */
export type FilmSize = 'full' | '720' | '480' | 'phone';

/**
 * The phone's cut of each film: upright, 4:5, for the tour's frame on a phone
 * held upright. The same recording, with the camera closer on each step, so
 * the product can be read at a phone's width.
 */
export const FILM_PHONE = { width: 720, height: 900, maxZoom: 2.6 } as const;

/**
 * Where the rendered media lives, relative to the site's root. Which size a
 * visitor gets is decided by the site from their screen and their measured
 * connection (src/lib/media.ts).
 */
export const MEDIA = {
  atlas: (small = false) => (small ? 'video/atlas.small.mp4' : 'video/atlas.mp4'),
  /** the atlas's first frame at half size: the cards show it until the video plays, and in its place on a slow connection */
  atlasStill: 'video/atlas.still.webp',
  film: (key: string, size: FilmSize = 'full') => (size === 'full' ? `video/films/${key}.mp4` : `video/films/${size}/${key}.mp4`),
  /** a film's first look, as a JPEG: for link previews and the video's structured data, which want one */
  poster: (key: string) => `video/posters/${key}.jpg`,
  /** the same, as the player shows it: a WebP a third the size, the largest thing on a film's page */
  posterWeb: (key: string) => `video/posters/${key}.webp`,
  /** the phone cut's first look, for the tour's frame on a phone */
  posterPhone: (key: string) => `video/posters/phone/${key}.webp`,
  social: 'social/card.jpg',
  icon: (size: 192 | 512) => `icons/icon-${size}.png`,
  appleTouchIcon: 'icons/apple-touch-icon.png',
} as const;

export const workflowList: readonly Workflow[] = WORKFLOWS;

/** Seconds of master footage once the flashes are cut, before any speed-up. */
export function masterDuration(wf: Workflow): number {
  const cut = wf.source.cuts.reduce((sum, [a, b]) => sum + (b - a), 0);
  return wf.source.end - wf.source.start - cut;
}

/** Length of the finished film in seconds. */
export function filmDuration(wf: Workflow): number {
  return masterDuration(wf) / wf.speed;
}

/** the moment of a film its posters are taken from: the first moment a step's caption is fully in and holding, after the window has settled */
export function posterTime(wf: Workflow): number {
  const dur = filmDuration(wf);
  for (let i = 0; i < wf.steps.length; i++) {
    const t = Math.max(wf.steps[i]!.t + 0.8, 0.9);
    const end = wf.steps[i + 1]?.t ?? dur;
    if (end - 0.35 - t > 0.1) return t;
  }
  return Math.min(1.4, dur / 2);
}
