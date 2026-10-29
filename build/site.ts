/*
 * The site's build plugin. Everything here is derived from @site/content, so
 * a rename or a copy change is one edit there.
 *
 *  - fills {{brand}} tokens in index.html and writes in the workflow list,
 *    the nav, the phone menu, the tour and the sections written from content
 *    (build/panels.ts), and the footer the page ends with
 *  - head metadata for every page: canonical, Open Graph, Twitter, JSON-LD
 *  - prerenders every section's address, /404.html and /workflows/<key>/ from
 *    the built index.html: the same one page, each with its own title,
 *    description and structured data, scrolled to its section (or with its
 *    film open) before the first paint
 *  - generates favicon.svg, site.webmanifest, robots.txt, sitemap.xml,
 *    llms.txt and _headers (security headers, with the hash of the one
 *    inline script)
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';
import {
  BRAND, MEDIA, PAGES, SERVICES, WORKFLOWS, filmDuration, formEndpoint, workflowPath, type PageMeta, type Workflow,
} from '../content/src/index.ts';
import {
  booking, firstLine, hasCustomers, heroProof, legalDocs, legalPage, menu, navLinks, panel, proofBand, routeFoot, tour, type PanelOptions,
} from './panels.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (p: string) => `${BRAND.url}${p.startsWith('/') ? p : `/${p}`}`;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pad2 = (n: number) => String(n).padStart(2, '0');

/* ------------------------------------------------------------ tokens */
function fillTokens(html: string): string {
  const tokens: Record<string, string> = {
    name: BRAND.name, descriptor: BRAND.descriptor, tagline: BRAND.tagline, summary: BRAND.summary,
    url: BRAND.url, email: BRAND.email, appUrl: BRAND.appUrl, legalName: BRAND.legalName,
    markPath: BRAND.markPath, year: String(new Date().getFullYear()), count: String(WORKFLOWS.length),
    firstFlow: workflowPath(WORKFLOWS[0]!.key), firstKey: WORKFLOWS[0]!.key,
  };
  return html.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in tokens ? esc(tokens[k]!) : m));
}

function workflowList(): string {
  return WORKFLOWS.map((wf) =>
    `<li><a class="seo__item" href="${workflowPath(wf.key)}" data-flow="${wf.key}">${esc(wf.title)}<span>${esc(wf.category)}</span><p>${esc(wf.lede)}</p></a></li>`,
  ).join('');
}

/* ---------------------------------------------------------- metadata */
interface Page extends PageMeta {
  image: string;
  imageSize: [number, number];
  /** what the preview image shows, for anyone who cannot see it */
  imageAlt: string;
  /** the trail from the home page, as [name, path] pairs, for search results */
  crumbs?: [string, string][];
  jsonLd: object[];
  /** set on <html>: the section this address scrolls to before the first paint (index.html), or the film it opens */
  attrs: Record<string, string>;
}

const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: BRAND.legalName,
  url: BRAND.url,
  email: BRAND.email,
  logo: abs(MEDIA.icon(512)),
  contactPoint: [{ '@type': 'ContactPoint', contactType: 'sales', email: BRAND.email, url: abs(PAGES.contact.path), availableLanguage: 'en' }],
  ...(BRAND.social.length ? { sameAs: BRAND.social.map((s) => s.url) } : {}),
};

/** a description cut to what a search result shows, at a word */
const clip = (s: string, n = 158) => (s.length <= n ? s : `${s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,;:]$/, '')}…`);

const breadcrumbs = (crumbs: [string, string][]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: abs(p) })),
});
const website = { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND.name, url: `${BRAND.url}/` };

function head(page: Page): string {
  // the not-found page is never a result, and is the canonical copy of nothing
  const missing = page.path === '/404.html';
  const url = abs(missing ? '/' : page.path);
  const x = BRAND.social.find((s) => s.handle);
  const tags = [
    missing ? `<meta name="robots" content="noindex" />` : `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="en_GB" />`,
    `<meta property="og:site_name" content="${esc(BRAND.name)}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${abs(page.image)}" />`,
    `<meta property="og:image:width" content="${page.imageSize[0]}" />`,
    `<meta property="og:image:height" content="${page.imageSize[1]}" />`,
    `<meta property="og:image:alt" content="${esc(page.imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    ...(x?.handle ? [`<meta name="twitter:site" content="${esc(x.handle)}" />`] : []),
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${abs(page.image)}" />`,
    `<meta name="twitter:image:alt" content="${esc(page.imageAlt)}" />`,
    ...[...page.jsonLd, ...(page.crumbs ? [breadcrumbs(page.crumbs)] : [])].map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`),
  ];
  return `<!--page-meta:start-->\n${tags.join('\n')}\n<!--page-meta:end-->`;
}

function applyPage(html: string, page: Page): string {
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(page.description)}" />`)
    .replace(/<!--page-meta:start-->[\s\S]*?<!--page-meta:end-->|<!--page-meta-->/, head(page));
  const attrs = Object.entries(page.attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  return out.replace(/<html lang="en"[^>]*>/, `<html lang="en"${attrs}>`);
}

const social: Pick<Page, 'image' | 'imageSize' | 'imageAlt'> = {
  image: MEDIA.social, imageSize: [1200, 630], imageAlt: `${BRAND.name}: ${BRAND.tagline}`,
};

const homePage: Page = {
  ...PAGES.home, ...social, attrs: {},
  jsonLd: [organization, website, {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: BRAND.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Self-hosted',
    description: BRAND.summary,
    url: `${BRAND.url}/`,
  }],
};

/** a section's questions, read back out of the page so the two never disagree */
function faq(html: string, route: string): object {
  const sec = html.match(new RegExp(`<section[^>]*id="${route}"[\\s\\S]*?</section>`))?.[0] ?? '';
  const items = [...sec.matchAll(/<summary class="qa__q">[\s\S]*?<\/span>([\s\S]*?)<span class="qa__x"[\s\S]*?<div class="qa__b"><p>([\s\S]*?)<\/p>/g)];
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(([, q, a]) => ({
      '@type': 'Question',
      name: q!.trim(),
      acceptedAnswer: { '@type': 'Answer', text: a!.trim() },
    })),
  };
}

function workflowPage(wf: Workflow, built: string): Page {
  const iso = `PT${Math.round(filmDuration(wf))}S`;
  return {
    path: workflowPath(wf.key),
    name: wf.title,
    title: `${wf.title} · ${BRAND.name}`,
    description: clip(wf.lede),
    image: MEDIA.poster(wf.key),
    imageSize: [1280, 720],
    imageAlt: `${wf.title}: a screen from ${BRAND.name}, ${wf.category.toLowerCase()}`,
    crumbs: [[BRAND.name, '/'], [wf.title, workflowPath(wf.key)]],
    attrs: { 'data-flow': wf.key },
    jsonLd: [organization, {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: wf.title,
      description: wf.lede,
      thumbnailUrl: [abs(MEDIA.poster(wf.key))],
      contentUrl: abs(MEDIA.film(wf.key)),
      duration: iso,
      uploadDate: built,
    }],
  };
}

/** the player, filled in for a workflow page, so its text is in the HTML for anyone without scripts */
function prefillPlayer(html: string, wf: Workflow, index: number): string {
  const steps = wf.steps.map((s) =>
    `<li><button type="button" class="flow__step"><span class="flow__n">${fmt(s.t)}</span><span class="flow__b"><span class="flow__st">${esc(s.title)}</span><span class="flow__sd">${esc(s.body)}</span></span></button></li>`,
  ).join('');
  return html
    .replace('<span class="flow__idx" id="flowIndex">01</span>', `<span class="flow__idx" id="flowIndex">${pad2(index + 1)}</span>`)
    .replace('<span class="flow__cat" id="flowCat"></span>', `<span class="flow__cat" id="flowCat">${esc(wf.category)}</span>`)
    .replace('<h2 class="flow__h" id="flowTitle"></h2>', `<h2 class="flow__h" id="flowTitle">${esc(wf.title)}</h2>`)
    .replace('<p class="flow__lede" id="flowLede"></p>', `<p class="flow__lede" id="flowLede">${esc(wf.lede)}</p>`)
    .replace('<ol class="flow__steps" id="flowSteps"></ol>', `<ol class="flow__steps" id="flowSteps">${steps}</ol>`)
    .replace('<p class="flow__note" id="flowNote"></p>', `<p class="flow__note" id="flowNote">${esc(wf.note)}</p>`)
    .replace('<span id="flowDur">0:00</span>', `<span id="flowDur">${fmt(filmDuration(wf))}</span>`)
    .replace('<video class="flow__video" id="flowVideo" muted playsinline loop preload="none"></video>',
      `<video class="flow__video" id="flowVideo" muted playsinline loop preload="none" controls poster="/${MEDIA.posterWeb(wf.key)}" src="/${MEDIA.film(wf.key, '720')}"></video>`);
}

/* -------------------------------------------------- generated files */
function favicon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#05070c"/><path d="${BRAND.markPath}" fill="none" stroke="#f4f5f7" stroke-width="2.4"/></svg>\n`;
}

function manifest(): string {
  return `${JSON.stringify({
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.summary,
    start_url: '/',
    display: 'standalone',
    background_color: '#05070c',
    theme_color: '#05070c',
    icons: [
      { src: `/${MEDIA.icon(192)}`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: `/${MEDIA.icon(512)}`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }, null, 2)}\n`;
}

/** the panels this build has, in the order the site lists them */
const routesFor = (o: PanelOptions) =>
  ['platform', ...(hasCustomers(o) ? ['customers' as const] : []), 'pricing', 'company', 'contact', 'legal'] as const;

function sitemap(built: string, o: PanelOptions): string {
  const paths = [PAGES.home.path, ...routesFor(o).map((r) => PAGES[r].path), ...legalDocs(o).map((d) => d.path), ...WORKFLOWS.map((w) => workflowPath(w.key))];
  const urls = paths.map((p) => `  <url><loc>${abs(p)}</loc><lastmod>${built}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/* where to report a security problem (RFC 9116), refreshed with every build */
function securityTxt(built: string): string {
  return [
    `# How to report a security problem in the ${BRAND.name} website or product.`,
    '# Please describe the problem; do not send customer data.',
    `Contact: mailto:${BRAND.email}`,
    `Expires: ${new Date(Date.parse(built) + 365 * 864e5).toISOString()}`,
    'Preferred-Languages: en',
    `Canonical: ${abs('/.well-known/security.txt')}`,
    '',
  ].join('\n');
}

const robots = () => `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`;

/* the site in plain text, for language models and agents reading it (llmstxt.org) */
function llms(o: PanelOptions): string {
  const page = (name: string, p: { path: string; description: string }) => `- [${name}](${abs(p.path)}): ${p.description}`;
  return [
    `# ${BRAND.name}`,
    '',
    `> ${BRAND.summary}`,
    '',
    `${BRAND.tagline} Every workflow below is a short film recorded in the product itself, with its steps written out on its own page.`,
    '',
    '## Pages',
    '',
    page('Home', PAGES.home),
    ...routesFor(o).map((r) => page(PAGES[r].name, PAGES[r])),
    ...legalDocs(o).map((d) => page(d.title, { path: d.path, description: clip(firstLine(d.paragraphs[0] ?? '')) })),
    '',
    '## Workflows',
    '',
    ...WORKFLOWS.map((wf) => `- [${wf.title}](${abs(workflowPath(wf.key))}): ${wf.lede}`),
    '',
    `Contact: ${BRAND.email}`,
    '',
  ].join('\n');
}

/*
 * Security headers, in the _headers format Netlify and Cloudflare Pages read
 * (other hosts: copy the values into their config). Everything is served
 * from the site itself: no third-party fonts, scripts or trackers, so the
 * policy can say so. The one inline script is allowed by its hash.
 */
const originOf = (url: string) => { try { return new URL(url).origin; } catch { return ''; } };

function headers(inlineScripts: string[]): string {
  const hashes = inlineScripts.map((s) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`).join(' ');
  // opened to exactly the services configured in @site/content, and no wider
  // (the demo stand-in is on the site's own origin, which 'self' already covers)
  const form = originOf(SERVICES.contactEndpoint);
  const stats = SERVICES.analytics ? originOf(SERVICES.analytics.src) : '';
  const list = (...xs: string[]) => xs.filter(Boolean).join(' ');
  const csp = [
    "default-src 'self'",
    `script-src ${list("'self'", hashes, stats)}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src ${list("'self'", form, stats)}`,
    "object-src 'none'",
    "base-uri 'self'",
    // without an endpoint the form falls back to the visitor's own email app
    `form-action ${list("'self'", form, formEndpoint ? '' : 'mailto:')}`,
    "frame-ancestors 'none'",
  ].join('; ');
  // https only, for a year (add includeSubDomains once every subdomain is on https too)
  const hsts = 'max-age=31536000';
  return [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    '  X-Content-Type-Options: nosniff',
    '  Cross-Origin-Opener-Policy: same-origin',
    `  Strict-Transport-Security: ${hsts}`,
    '  X-Frame-Options: DENY',
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/video/*',
    '  Cache-Control: public, max-age=604800',
    '',
  ].join('\n');
}

/* ------------------------------------------------------------ plugin */
/** where the contact form goes without scripts: the endpoint (or the demo stand-in), or the visitor's email app */
function formTarget(): string {
  return formEndpoint
    ? ` action="${esc(formEndpoint)}" method="post"`
    : ` action="mailto:${esc(BRAND.email)}" method="post" enctype="text/plain"`;
}

/** the analytics script, when one is configured: built pages only, so working on the site never counts */
function analyticsTag(): string {
  const a = SERVICES.analytics;
  if (!a) return '';
  const attrs = Object.entries(a.attrs ?? {}).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  return `<script defer src="${esc(a.src)}"${attrs}></script>\n`;
}

export function site(): Plugin {
  let root = '';
  let publicDir = '';
  let building = false;
  /** the dev server (or SAMPLES=1) renders sample content, tagged; a build leaves it out */
  const opts: PanelOptions = { samples: false };
  const built = new Date().toISOString().slice(0, 10);

  return {
    name: 'site',
    configResolved(config) {
      root = config.root;
      publicDir = config.publicDir;
      building = config.command === 'build';
      opts.samples = !building || process.env.SAMPLES === '1';
    },

    async buildStart() {
      const source = await readFile(path.join(root, 'index.html'), 'utf8');
      const inline = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
      await mkdir(path.join(publicDir, 'icons'), { recursive: true });
      await mkdir(path.join(publicDir, '.well-known'), { recursive: true });
      await Promise.all([
        writeFile(path.join(publicDir, 'favicon.svg'), favicon()),
        writeFile(path.join(publicDir, 'site.webmanifest'), manifest()),
        writeFile(path.join(publicDir, 'robots.txt'), robots()),
        writeFile(path.join(publicDir, 'llms.txt'), llms(opts)),
        writeFile(path.join(publicDir, 'sitemap.xml'), sitemap(built, opts)),
        writeFile(path.join(publicDir, '_headers'), headers(inline)),
        writeFile(path.join(publicDir, '.well-known', 'security.txt'), securityTxt(built)),
      ]);
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const page = html
          .replace('<!--nav-links-->', navLinks(opts))
          .replace('<!--menu-->', menu(opts))
          .replace('<!--tour-->', tour())
          .replace('<!--panel:platform-->', panel(opts, 'platform'))
          .replace('<!--panel:customers-->', panel(opts, 'customers'))
          .replace('<!--panel:company-->', panel(opts, 'company'))
          .replace('<!--panel:legal-->', legalPage(opts))
          .replace('<!--proof-band-->', proofBand(opts, 0))
          .replace('<!--booking-->', booking())
          .replace('<!--hero-proof-->', heroProof(opts))
          .replace('<!--form-target-->', '')
          .replace('id="contactForm" novalidate>', `id="contactForm" novalidate${formTarget()}>`)
          .replace('<!--route-foot-->', routeFoot(opts))
          .replace('<!--workflow-list-->', workflowList())
          .replace('</head>', `${building ? analyticsTag() : ''}</head>`);
        return applyPage(fillTokens(page), homePage);
      },
    },

    async writeBundle(options, bundle) {
      const dir = options.dir!;
      const asset = bundle['index.html'];
      if (!asset || asset.type !== 'asset') return;
      let html = String(asset.source);

      // the stylesheet is small, so it rides in the page instead of costing a
      // round trip before the first paint (its url()s are absolute, so they
      // resolve the same from every page written below)
      html = html.replace(/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/g, (tag, file: string) => {
        const css = bundle[file];
        return css?.type === 'asset' ? `<style>${String(css.source)}</style>` : tag;
      });

      /* preload the four faces' core parts (the characters the site's own text
         uses; tools/fonts.py): a face that lands after the first paint reflows
         whatever it sets, and the heavier sans and the mono, left to be found
         by the stylesheet, sometimes did, shifting the pricing cards */
      const fonts = Object.keys(bundle).filter((f) => /-core-[\w-]+\.woff2$/.test(f));
      const preload = fonts.map((f) => `<link rel="preload" href="/${f}" as="font" type="font/woff2" crossorigin />`).join('\n');
      html = html.replace('</head>', `${preload}\n</head>`);

      const write = async (rel: string, content: string) => {
        await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
        await writeFile(path.join(dir, rel), content);
      };
      await write('index.html', html);
      const routePage = (route: keyof typeof PAGES, jsonLd: object[]): Page => ({
        ...PAGES[route], ...social, attrs: { 'data-route': route }, jsonLd: [organization, ...jsonLd],
        crumbs: route === 'missing' ? undefined : [[BRAND.name, '/'], [PAGES[route].name, PAGES[route].path]],
      });
      const webPage = (route: keyof typeof PAGES, type = 'WebPage') => ({
        '@context': 'https://schema.org', '@type': type, name: PAGES[route].title,
        description: PAGES[route].description, url: abs(PAGES[route].path),
      });
      for (const route of routesFor(opts)) {
        const jsonLd = route === 'pricing' ? [faq(html, 'pricing')]
          : route === 'platform' ? [webPage('platform'), faq(html, 'platform')]
          : route === 'company' ? [{ ...webPage('company', 'AboutPage'), mainEntity: organization }]
          : [webPage(route)];
        const pg = routePage(route, jsonLd);
        // the legal page opens on its overview (index.html's landing script leaves it be: it is not a section)
        if (route === 'legal') pg.attrs['data-doc'] = '';
        await write(`${route}/index.html`, applyPage(html, pg));
      }
      /* each legal document at an address of its own, open on that document from the first paint */
      for (const d of legalDocs(opts)) {
        const description = clip(firstLine(d.paragraphs[0] ?? ''));
        await write(`legal/${d.id}/index.html`, applyPage(html, {
          path: d.path, name: d.title, title: `${d.title} · ${BRAND.name}`, description, ...social,
          attrs: { 'data-route': 'legal', 'data-doc': d.id },
          crumbs: [[BRAND.name, '/'], [PAGES.legal.name, PAGES.legal.path], [d.title, d.path]],
          jsonLd: [organization, { '@context': 'https://schema.org', '@type': 'WebPage', name: d.title, description, url: abs(d.path) }],
        }));
      }
      await write('404.html', applyPage(html, routePage('missing', [])));
      await Promise.all(WORKFLOWS.map((wf, i) =>
        write(`workflows/${wf.key}/index.html`, prefillPlayer(applyPage(html, workflowPage(wf, built)), wf, i))));
    },
  };
}
