/*
 * The brand, in one place.
 *
 * The company is changing its name. To rename the site:
 *   1. edit the values below
 *   2. npm run video:render -- social    (the social card and the icons carry the name)
 *   3. npm run build
 * Every page title, meta tag, structured-data block, the manifest, the
 * sitemap and the visible copy follow. The films carry no name, so they need
 * no re-render; the one place the old name appeared in the recording (the
 * assistant's sidebar header) is painted out in every render.
 */
export const BRAND = {
  /** the name as it is written in running text */
  name: 'OwnAI',
  /** what it is, in two or three words: search results, the social card, the kicker */
  descriptor: 'Private AI workroom',
  /** the one sentence the home page leads with, and the social card's headline */
  tagline: 'The workroom that stays inside your network.',
  /** the line under the name in search results and link previews */
  summary:
    'A private AI workroom for your company: documents, assistant, projects, time and clients, on hardware you control.',
  /** where the site is served, no trailing slash: canonical URLs, the sitemap, the social card */
  url: 'https://ownai.example',
  /** the address on the contact page and in structured data */
  email: 'hello@ownai.example',
  /** where "Log in" goes: the product itself */
  appUrl: 'https://app.ownai.example',
  /** the copyright line */
  legalName: 'OwnAI',
  /**
   * The mark, as an SVG path on a 24-unit grid, stroked. It is drawn in the
   * nav, the favicon, the app icons and the social card. A ring for now: the
   * shape of the page itself, and of nothing the old name owned.
   */
  markPath: 'M12 5.8a6.2 6.2 0 1 0 0 12.4a6.2 6.2 0 1 0 0-12.4z',
  /**
   * The company's profiles elsewhere, in the order the footer lists them;
   * empty until there are some. They also go into the structured data as
   * the company's other identities, and an X handle into link previews.
   * E.g. { name: 'LinkedIn', url: 'https://www.linkedin.com/company/...' },
   *      { name: 'X', url: 'https://x.com/...', handle: '@...' }
   */
  social: [] as readonly { name: string; url: string; handle?: string }[],
} as const;

export type Brand = typeof BRAND;
