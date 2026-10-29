/*
 * The sections written from @site/content at build time: the workflow tour,
 * How it stays private, Customers, Company and Legal, plus the pieces the
 * page shares (the nav, the phone menu, the footer) and the proof that
 * appears in other sections. Version 2 is one page: every section is in it,
 * one after another, and each address scrolls to its own.
 *
 * Copy lives in content/src/company.ts, never here. Entries marked
 * `sample` are rendered only when `samples` is on (the dev server, or
 * SAMPLES=1 for a build to look at), each with a tag saying so; a normal
 * build leaves them out, and a page with nothing real on it (Customers,
 * until there are customers) is left out with its links.
 */
import {
  BRAND, COMPANY, DEMO_INBOX, FOOTER, LEGAL, MEDIA, PAGES, PLATFORM, PROOF, SERVICES, WORKFLOWS, bookingMode, filmDuration,
  workflowPath, type Point, type Question, type Status, type Tool,
} from '../content/src/index.ts';

export interface PanelOptions {
  /** render `sample` entries, tagged, and highlight [placeholders] */
  samples: boolean;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad2 = (n: number) => String(n).padStart(2, '0');

const shown = <T extends { status: Status }>(o: PanelOptions, items: readonly T[]): T[] =>
  items.filter((i) => i.status !== 'sample' || o.samples);

const tag = (s: Status) =>
  s === 'sample' ? '<span class="tag" title="Made up to show the design; a build leaves it out">Sample</span>' : '';

/** copy, escaped; on the dev server a [placeholder] is marked so it cannot be missed */
const text = (o: PanelOptions, s: string) => {
  const safe = esc(s);
  return o.samples ? safe.replace(/\[[^\]]+\]/g, (m) => `<mark class="ph">${m}</mark>`) : safe;
};

/* -------------------------------------------------------------- icons */
const ICONS = {
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.8" cy="9.5" r="2.5"/><path d="M15.6 14.2c2.4.2 4.2 1.8 4.9 4.8"/>',
  server: '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01M12 7.5h5M12 16.5h5"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3.5V7M14 3.5V7M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5"/>',
  cloud: '<path d="M7.5 18.5h9.2a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 6.7 9.4a4.6 4.6 0 0 0 .8 9.1z"/>',
  building: '<path d="M5 20.5v-15l7-2 7 2v15"/><path d="M3.5 20.5h17M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10.5 20.5V17h3v3.5"/>',
  shield: '<path d="M12 3.5 20 7v6c0 4.2-3.3 6.6-8 7.5-4.7-.9-8-3.3-8-7.5V7z"/><path d="m9 12 2.2 2.2L15.4 10"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.5 3.8 5.4 3.8 8.5s-1.2 6-3.8 8.5c-2.6-2.5-3.8-5.4-3.8-8.5S9.4 6 12 3.5z"/>',
  partner: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2.5 19c.5-3 2.6-4.8 5.5-4.8 1.6 0 2.9.5 4 1.5 1.1-1 2.4-1.5 4-1.5 2.9 0 5 1.8 5.5 4.8"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.4"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  arrow: '<path d="M5 19 19 5M19 5H8M19 5v11"/>',
  play: '<path d="M8 5.8v12.4a.6.6 0 0 0 .9.5l10-6.2a.6.6 0 0 0 0-1L8.9 5.3a.6.6 0 0 0-.9.5z"/>',
  off: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  prev: '<path d="M14.5 6 8.5 12l6 6"/>',
  next: '<path d="M9.5 6l6 6-6 6"/>',
  /* what each connected tool does, drawn in the page's own line rather than borrowed marks */
  pull: '<circle cx="6" cy="5.5" r="2"/><circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="18.5" r="2"/><path d="M6 7.5v9M18 16.5V9a2.5 2.5 0 0 0-2.5-2.5H11"/><path d="m13.2 4.3-2.2 2.2 2.2 2.2"/>',
  pen: '<path d="M12 20.5 5.5 11.2 8.2 4h7.6l2.7 7.2z"/><circle cx="12" cy="11.6" r="1.7"/><path d="M12 13.3v7.2"/>',
  chat: '<path d="M5.2 5h13.6c.9 0 1.7.8 1.7 1.7v8.1c0 .9-.8 1.7-1.7 1.7H10l-4.3 3.3v-3.3h-.5c-.9 0-1.7-.8-1.7-1.7V6.7C3.5 5.8 4.3 5 5.2 5z"/><path d="M8 9.5h8M8 12.5h5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.5 7"/><path d="M14 10a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.3-1.3"/>',
} as const;

const icon = (name: keyof typeof ICONS, cls = '') =>
  `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

/* ------------------------------------------------------------- pieces */
const flowTitle = (key: string) => WORKFLOWS.find((w) => w.key === key)?.title ?? key;

function head(kicker: string, title: string, lede: string, id: string, extra = ''): string {
  return `<div class="route__head">
      <p class="route__kicker rv">${esc(kicker)}</p>
      <h2 class="route__h rv rv--lines" id="${id}">${esc(title)}</h2>
      <p class="route__lede rv">${esc(lede)}</p>${extra}
    </div>`;
}

function points(o: PanelOptions, items: readonly Point[]): string {
  return `<ol class="points">${shown(o, items).map((p, i) => `
      <li class="point rv"><span class="point__n">${pad2(i + 1)}</span>${tag(p.status)}<h3 class="point__t">${esc(p.title)}</h3><p class="point__b">${esc(p.body)}</p></li>`).join('')}
    </ol>`;
}

function questions(o: PanelOptions, items: readonly Question[]): string {
  return `<div class="qa">${shown(o, items).map((q) => `
      <details class="qa__i rv">
        <summary class="qa__q"><span class="qa__wash" aria-hidden="true"></span>${esc(q.q)}<span class="qa__x" aria-hidden="true"></span></summary>
        <div class="qa__b"><p>${esc(q.a)}</p></div>
      </details>`).join('')}
    </div>`;
}

function cta(title: string, body: string, primary: [string, string], secondary?: [string, string, string?]): string {
  const second = secondary
    ? `<a class="btn btn--ghost" href="${secondary[1]}"${secondary[2] ? ` data-flow="${secondary[2]}"` : ''}>${esc(secondary[0])}</a>`
    : '';
  return `<div class="route__cta rv rv--clip">
      <h2 class="route__cta-h">${esc(title)}</h2>
      <p class="route__cta-p">${esc(body)}</p>
      <div class="route__btns"><a class="btn btn--solid" href="${primary[1]}">${esc(primary[0])}</a>${second}</div>
    </div>`;
}

/** the dots under a row a phone swipes through, and the pill that glides along them (src/ui/sections.ts) */
const dots = (n: number) => `<div class="dots" aria-hidden="true">${'<i></i>'.repeat(n)}</div>`;

/** one section of the page: its id is its name, so /pricing/ and #pricing both land on it */
const section = (route: string, labelId: string, body: string) =>
  `<section class="sec" id="${route}" data-section="${route}" aria-labelledby="${labelId}">
  <div class="sec__inner">
    ${body}
  </div>
</section>`;

/* ------------------------------------------------------------- proof */
export const hasCustomers = (o: PanelOptions) =>
  shown(o, PROOF.stories).length + shown(o, PROOF.quotes).length + shown(o, PROOF.logos).length > 0;

/** under the home view's buttons: who runs it, once there is someone to name */
export function heroProof(o: PanelOptions): string {
  const items = shown(o, PROOF.logos).slice(0, 3);   // three names keep it to one line
  if (!items.length) return '';
  return `<p class="hero__proof"><span class="hero__proof-k">Running at</span>${items.map((l) => `<span class="hero__proof-n">${esc(l.name)}</span>`).join('')}${items.some((l) => l.status === 'sample') ? tag('sample') : ''}</p>`;
}

/** one quote, set large: for pages that make a claim a customer can back up */
export function proofBand(o: PanelOptions, nth = 0): string {
  const quotes = shown(o, PROOF.quotes);
  const q = quotes[nth % Math.max(quotes.length, 1)];
  if (!q) return '';
  return `<figure class="pull rv rv--clip">${tag(q.status)}
      <blockquote class="pull__q"><p>${esc(q.text)}</p></blockquote>
      <figcaption class="pull__by"><span class="pull__n">${esc(q.name)}</span>${esc(q.role)}, ${esc(q.company)}</figcaption>
    </figure>`;
}

function logos(o: PanelOptions): string {
  const items = shown(o, PROOF.logos);
  if (!items.length) return '';
  return `<ul class="logos rv" aria-label="Some of the firms running ${esc(BRAND.name)}">${items.map((l) => `
      <li class="logos__i">${l.file ? `<img src="/logos/${esc(l.file)}" alt="${esc(l.name)}" loading="lazy" decoding="async" />` : `<span class="logos__w">${esc(l.name)}</span>`}${tag(l.status)}</li>`).join('')}
    </ul>`;
}

/* ------------------------------------------------------ the panels */
function platform(o: PanelOptions): string {
  const m = PLATFORM.map;
  const nodeIcons = ['people', 'server', 'chip'] as const;
  const map = `<figure class="map rv rv--clip">
      <div class="map__net">
        <p class="map__tag">${icon('shield')}Your network</p>
        <ol class="map__row">${m.inside.map((n, i) => `
          <li class="node${i === 1 ? ' node--core' : ''}"><span class="node__i">${icon(nodeIcons[i]!)}</span><span class="node__t">${esc(n.label)}</span><span class="node__d">${esc(n.detail)}</span></li>`).join('')}
        </ol>
      </div>
      <div class="map__out">
        <div class="node node--opt"><span class="node__i">${icon('cloud')}</span><span class="node__t">${esc(m.cloud.label)}</span><span class="node__d">${esc(m.cloud.detail)}</span></div>
        <div class="node node--off"><span class="node__i">${icon('building')}</span><span class="node__t">${esc(m.us.label)}</span><span class="node__d">${icon('off', 'node__x')}${esc(m.us.detail)}</span></div>
      </div>
      <figcaption class="map__cap">${esc(m.caption)}</figcaption>
    </figure>`;

  const controls = shown(o, PLATFORM.controls);
  const deployIcons = ['server', 'globe', 'partner'] as const;
  const kit = PLATFORM.integrations;
  const toolIcons: Record<string, keyof typeof ICONS> = { GitHub: 'pull', Figma: 'pen', Slack: 'chat' };
  const tools: Tool[] = shown(o, kit.tools);
  /* one sheet split three ways, each tool set by name with what it does, and the film that shows it where there is one */
  const strip = tools.length ? `
    <h2 class="route__sub rv rv--lines">${esc(kit.title)}</h2>
    <ul class="tools swipe rv rv--clip">${tools.map((t) => `
      <li class="tool">
        <span class="tool__i">${t.logo ? `<img src="/logos/${esc(t.logo)}" alt="" loading="lazy" decoding="async" />` : icon(toolIcons[t.name] ?? 'link')}</span>
        <h3 class="tool__n">${esc(t.name)}${tag(t.status)}</h3>
        <p class="tool__b">${esc(t.body)}</p>${t.flow ? `
        <a class="chip tool__film" href="${workflowPath(t.flow)}" data-flow="${esc(t.flow)}">${icon('play')}${esc(flowTitle(t.flow))}</a>` : ''}
      </li>`).join('')}
    </ul>
    ${dots(tools.length)}
    <p class="route__fine">${esc(kit.note)}</p>` : '';
  const reqs = shown(o, PLATFORM.requirements.rows);
  const cmp = PLATFORM.compare;

  return section('platform', 'platformTitle', `
    ${head(PLATFORM.kicker, PLATFORM.title, PLATFORM.lede, 'platformTitle')}
    ${map}
    <h2 class="sr">What it rests on</h2>
    ${points(o, PLATFORM.principles)}

    <h2 class="route__sub rv rv--lines">What your security team will ask about</h2>
    <ul class="controls">${controls.map((c) => `
      <li class="control rv"><details class="control__d" open><summary class="control__s"><span class="control__i">${icon('check')}</span><h3 class="control__t">${esc(c.title)}${tag(c.status)}</h3></summary><p class="control__b">${esc(c.body)}</p></details></li>`).join('')}
    </ul>

    <h2 class="route__sub rv rv--lines">Where it can run</h2>
    <div class="deploy swipe" tabindex="0" role="region" aria-label="Where it can run">${shown(o, PLATFORM.deploy).map((d, i) => `
      <article class="deploy__c rv"><span class="deploy__i">${icon(deployIcons[i % 3]!)}</span><h3 class="deploy__t">${esc(d.title)}</h3><p class="deploy__b">${esc(d.body)}</p></article>`).join('')}
    </div>
    ${dots(shown(o, PLATFORM.deploy).length)}
    ${reqs.length ? `<div class="sheet sheet--after rv rv--clip">
      <div class="sheet__scroll" tabindex="0" role="region" aria-label="What to run it on">
        <table class="ctable">
          <caption class="ctable__cap">What to run it on</caption>
          <thead><tr><th scope="col">Plan</th><th scope="col">Server</th><th scope="col">Model</th></tr></thead>
          <tbody>${reqs.map((r) => `<tr><th scope="row">${esc(r.plan)}${tag(r.status)}</th><td>${esc(r.server)}</td><td>${esc(r.model)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
    <p class="route__fine">${esc(PLATFORM.requirements.note)}</p>` : ''}
    ${strip}

    <h2 class="route__sub rv rv--lines">Next to a cloud assistant</h2>
    <div class="sheet rv rv--clip">
      <div class="sheet__scroll" tabindex="0" role="region" aria-label="${esc(cmp.ours)} next to ${esc(cmp.theirs.toLowerCase())}">
        <table class="ctable ctable--vs" role="table">
          <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader"><span class="sr">Question</span></th><th scope="col" role="columnheader" class="ctable__us">${esc(cmp.ours)}</th><th scope="col" role="columnheader">${esc(cmp.theirs)}</th></tr></thead>
          <tbody role="rowgroup">${shown(o, cmp.rows).map((r) => `<tr role="row"><th scope="row" role="rowheader">${esc(r.label)}</th><td role="cell" class="ctable__us" data-who="${esc(cmp.ours)}">${esc(r.ours)}</td><td role="cell" data-who="${esc(cmp.theirs)}">${esc(r.theirs)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
    <p class="route__fine">${esc(cmp.note)}</p>

    ${proofBand(o, 2)}

    <h2 class="route__sub rv rv--lines">Security questions</h2>
    ${questions(o, PLATFORM.questions)}

    ${cta('Send it to your security team', 'Ask for the data-flow document: every component, and what each one sends where. Or watch the assistant answer with its sources.',
      ['Ask for the document', PAGES.contact.path], ['Watch the assistant', workflowPath('assistant'), 'assistant'])}`);
}

function customers(o: PanelOptions): string {
  const stories = shown(o, PROOF.stories);
  const quotes = shown(o, PROOF.quotes);
  return section('customers', 'customersTitle', `
    ${head('Customers', 'Firms that kept their documents, and got the assistant.', 'What they moved in, what changed, and the films of the workflows they use most.', 'customersTitle')}
    ${logos(o)}
    <div class="stories">${stories.map((s) => `
      <article class="story rv">
        <header class="story__top"><span class="story__co">${esc(s.company)}</span><span class="story__meta">${esc(s.sector)}, ${esc(s.size)}</span>${tag(s.status)}</header>
        <h2 class="story__h">${esc(s.headline)}</h2>
        <dl class="story__nums">${s.metrics.map((mt) => `<div class="story__num"><dt>${esc(mt.label)}</dt><dd>${esc(mt.value)}</dd></div>`).join('')}</dl>
        <p class="story__p">${esc(s.summary)}</p>
        <p class="story__films"><span class="story__k">Watch what they use</span>${s.workflows.map((k) => `<a class="chip" href="${workflowPath(k)}" data-flow="${esc(k)}">${icon('play')}${esc(flowTitle(k))}</a>`).join('')}</p>
      </article>`).join('')}
    </div>
    ${quotes.length ? `<h2 class="route__sub rv rv--lines">In their words</h2>
    <div class="quotes">${quotes.map((q) => `
      <figure class="quote rv">${tag(q.status)}<blockquote><p>${esc(q.text)}</p></blockquote><figcaption><span class="quote__n">${esc(q.name)}</span>${esc(q.role)}, ${esc(q.company)}</figcaption></figure>`).join('')}
    </div>` : ''}
    ${cta('Your documents, your demo', 'Bring the files you actually work with. We will set them up in a workroom of your own and you can judge it on your material.',
      ['Book a demo', PAGES.contact.path], ['See how it stays private', PAGES.platform.path])}`);
}

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

function company(o: PanelOptions): string {
  const facts = shown(o, COMPANY.facts);
  const team = shown(o, COMPANY.team);
  return section('company', 'companyTitle', `
    ${head(COMPANY.kicker, COMPANY.title, COMPANY.lede, 'companyTitle')}
    ${facts.length ? `<dl class="facts rv">${facts.map((f) => `<div class="facts__i"><dt>${esc(f.label)}</dt><dd>${esc(f.value)}${tag(f.status)}</dd></div>`).join('')}</dl>` : ''}

    <h2 class="route__sub rv rv--lines">How we work</h2>
    ${points(o, COMPANY.values)}

    ${team.length ? `<h2 class="route__sub rv rv--lines">The people</h2>
    <ul class="team">${team.map((p) => `
      <li class="person rv"><span class="person__av" aria-hidden="true">${esc(initials(p.name))}</span>${tag(p.status)}<h3 class="person__n">${esc(p.name)}</h3><p class="person__r">${esc(p.role)}</p><p class="person__b">${esc(p.bio)}</p></li>`).join('')}
    </ul>` : ''}

    ${proofBand(o, 1)}

    ${cta('Talk to the people who build it', 'Questions about the product, a security review, or running it for your own clients: it all comes to the same small team.',
      ['Contact us', PAGES.contact.path], ['How it stays private', PAGES.platform.path])}`);
}

/* -------------------------------------------------------- legal */
/** the legal documents, each with an address of its own: /legal/privacy/ and the rest */
export const legalDocs = (o: PanelOptions) => shown(o, LEGAL.sections).map((s) => ({
  id: s.id, title: s.title, path: `${PAGES.legal.path}${s.id}/`, paragraphs: s.paragraphs,
}));

/** a document's first sentence, for its card on the overview and its description in a search result */
export const firstLine = (s: string) => (s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s);

/**
 * Legal is a page of its own, not a stretch of the one page: it opens over
 * the site with its own scroll and address, as the films do. /legal/ is an
 * overview of the five documents, and each has its own address and view;
 * tabs along the top go between them, and the way back returns to the part
 * of the site the visitor came from (src/ui/router.ts). Which view shows is
 * set on <html> (data-doc), so a document's own address shows it from the
 * first paint, with or without scripts.
 */
export function legalPage(o: PanelOptions): string {
  const docs = legalDocs(o);
  const tab = (id: string, label: string, path: string) =>
    `<a class="doc__tab" href="${path}" data-doc-tab="${id}">${esc(label)}</a>`;
  const show = [
    'html:not([data-doc]) .doc__view:not([data-doc-view=""])',
    'html[data-doc=""] .doc__view:not([data-doc-view=""])',
    ...docs.map((d) => `html[data-doc="${d.id}"] .doc__view:not([data-doc-view="${d.id}"])`),
  ].join(',\n  ');
  const current = [
    'html:not([data-doc]) .doc__tab[data-doc-tab=""]', 'html[data-doc=""] .doc__tab[data-doc-tab=""]',
    ...docs.map((d) => `html[data-doc="${d.id}"] .doc__tab[data-doc-tab="${d.id}"]`),
  ].join(',\n  ');
  return `<section class="route doc" id="legal" data-route="legal" aria-hidden="true" aria-label="${esc(LEGAL.title)}">
  <style>
  ${show} { display: none; }
  ${current} { color: var(--ink); background: var(--surface-3); }
  </style>
  <div class="doc__wrap">
    <div class="doc__bar">
      <a class="doc__back" href="/" data-doc-back>${icon('arrow', 'doc__back-i')}<span>Back to the site</span></a>
      <nav class="doc__tabs" aria-label="${esc(LEGAL.kicker)}">
        ${tab('', LEGAL.kicker, PAGES.legal.path)}${docs.map((d) => tab(d.id, d.title, d.path)).join('')}
      </nav>
    </div>

    <div class="doc__view" data-doc-view="" data-doc-title="${esc(PAGES.legal.title)}">
      <header class="doc__head">
        <p class="route__kicker doc__kicker">${esc(LEGAL.kicker)}</p>
        <h1 class="doc__h" tabindex="-1">${esc(LEGAL.title)}</h1>
        <p class="doc__lede">${esc(LEGAL.lede)}</p>
        <p class="doc__updated">Last updated ${text(o, LEGAL.updated)}</p>
      </header>
      <ol class="doc__cards">${docs.map((d, i) => `
        <li><a class="doc__card" href="${d.path}" data-doc-tab="${d.id}">
          <span class="doc__n">${pad2(i + 1)}</span>
          <span class="doc__t">${esc(d.title)}</span>
          <span class="doc__d">${text(o, firstLine(d.paragraphs[0] ?? ''))}</span>
          ${icon('arrow', 'doc__go')}
        </a></li>`).join('')}
      </ol>
    </div>
${docs.map((d, i) => {
    const prev = docs[i - 1], next = docs[i + 1];
    return `
    <article class="doc__view" data-doc-view="${d.id}" data-doc-title="${esc(d.title)} · ${esc(BRAND.name)}" aria-labelledby="doc-${d.id}">
      <header class="doc__head">
        <p class="route__kicker doc__kicker"><a href="${PAGES.legal.path}" data-doc-tab="">${esc(LEGAL.kicker)}</a><span aria-hidden="true">/</span>${pad2(i + 1)}</p>
        <h1 class="doc__h" id="doc-${d.id}" tabindex="-1">${esc(d.title)}</h1>
        <p class="doc__updated">Last updated ${text(o, LEGAL.updated)}</p>
      </header>
      <div class="doc__prose">
        ${d.paragraphs.map((p) => `<p>${text(o, p)}</p>`).join('\n        ')}
      </div>
      <nav class="doc__pager" aria-label="More of ${esc(LEGAL.kicker.toLowerCase())}">
        ${prev ? `<a class="doc__page doc__page--prev" href="${prev.path}" data-doc-tab="${prev.id}"><span class="doc__page-k">Previous</span><span class="doc__page-t">${esc(prev.title)}</span></a>` : `<a class="doc__page doc__page--prev" href="${PAGES.legal.path}" data-doc-tab=""><span class="doc__page-k">Back to</span><span class="doc__page-t">${esc(LEGAL.kicker)}</span></a>`}
        ${next ? `<a class="doc__page doc__page--next" href="${next.path}" data-doc-tab="${next.id}"><span class="doc__page-k">Next</span><span class="doc__page-t">${esc(next.title)}</span></a>` : ''}
      </nav>
    </article>`;
  }).join('')}

    <footer class="doc__foot">
      <span>&copy; ${new Date().getFullYear()} ${esc(BRAND.legalName)}</span>
      <a href="mailto:${esc(BRAND.email)}">${esc(BRAND.email)}</a>
    </footer>
  </div>
</section>`;
}

/** one section written from content, by name; Customers is an empty string until there are customers */
export function panel(o: PanelOptions, name: 'platform' | 'customers' | 'company'): string {
  if (name === 'customers') return hasCustomers(o) ? customers(o) : '';
  return { platform, company }[name](o);
}

/* -------------------------------------------------------- the tour */
const clock = (t: number) => `${Math.floor(t / 60)}:${pad2(Math.floor(t % 60))}`;

/**
 * Where the ring's scroll ends: the twelve workflows, one at a time, each
 * with its film, its steps and an index to jump about in. It is pinned while
 * its own stretch of the page scrolls past (src/ui/tour.ts), and a button
 * skips the lot. Every workflow is written in, so it reads as a list without
 * scripts, and to anything that reads the page as text.
 */
export function tour(): string {
  const n = WORKFLOWS.length;
  const slides = WORKFLOWS.map((wf, i) => `
      <article class="tour__slide${i === 0 ? ' is-on' : ''}" data-i="${i}" aria-labelledby="tour-${wf.key}">
        <figure class="tour__media">
          <picture>
            <source media="(max-width: 767px)" srcset="/${MEDIA.posterPhone(wf.key)}" width="720" height="900" />
            <img class="tour__poster" src="/${MEDIA.posterWeb(wf.key)}" width="1280" height="720" alt="${esc(wf.title)}: a screen from ${esc(BRAND.name)}" loading="lazy" decoding="async" />
          </picture>
          <figcaption class="tour__time"><span class="tour__clock">0:00</span> / ${clock(filmDuration(wf))}</figcaption>
        </figure>
        <div class="tour__copy">
          <p class="tour__cat"><span class="tour__num">${pad2(i + 1)}</span>${esc(wf.category)}</p>
          <h3 class="tour__h" id="tour-${wf.key}">${esc(wf.title)}</h3>
          <p class="tour__lede">${esc(wf.lede)}</p>
          <ol class="tour__steps" style="--steps: ${wf.steps.length}">${wf.steps.map((st, k) => `
            <li class="tour__step" style="--k: ${k}" data-t="${st.t}"><i class="tour__fill" aria-hidden="true"></i><span class="tour__say"><span class="tour__sn">${clock(st.t)}</span><span class="tour__st">${esc(st.title)}</span> <span class="tour__sd">${esc(st.body)}</span></span></li>`).join('')}
          </ol>
          <a class="chip tour__open" href="${workflowPath(wf.key)}" data-flow="${wf.key}">${icon('play')}Watch it full screen</a>
        </div>
      </article>`).join('');
  return `<section class="tour" id="workflows" data-section="workflows" aria-labelledby="tourTitle" style="--n: ${n}">
  <i class="tour__seam" aria-hidden="true"></i>
  <div class="tour__pin">
    <div class="tour__top">
      <p class="tour__kicker"><span class="tour__k">The workflows</span><span class="tour__count" aria-hidden="true"><span class="tour__idx">01</span> / ${pad2(n)}</span></p>
      <h2 class="sr" id="tourTitle">The ${n} workflows, each recorded in ${esc(BRAND.name)}</h2>
      <div class="tour__acts">
        <button class="foot__pause tour__pause" type="button" data-motion-toggle aria-pressed="false"><span class="foot__pause-i" aria-hidden="true"></span><span class="foot__pause-t">Pause motion</span></button>
        <a class="btn btn--ghost tour__skip" href="${PAGES.platform.path}" data-skip-tour>Skip the workflows${icon('arrow', 'tour__skip-i')}</a>
      </div>
    </div>
    <div class="tour__slides">${slides}
    </div>
    <div class="tour__steer">
      <button class="tour__arrow" type="button" data-tour-step="-1" aria-label="Previous workflow">${icon('prev')}</button>
      <button class="tour__where" type="button" aria-haspopup="dialog"><span class="tour__where-n"><span class="tour__idx">01</span> / ${pad2(n)}</span><span class="sr">: all ${n} workflows</span><span class="tour__where-bar" aria-hidden="true"><i></i></span></button>
      <button class="tour__arrow" type="button" data-tour-step="1" aria-label="Next workflow">${icon('next')}</button>
    </div>
    <nav class="tour__index" aria-label="Workflows">${WORKFLOWS.map((wf, i) => `
      <a class="tour__tick${i === 0 ? ' is-on' : ''}" href="${workflowPath(wf.key)}" data-tour-go="${i}"><span class="tour__tick-n">${pad2(i + 1)}</span><span class="sr">${esc(wf.title)}</span><i class="tour__tick-bar" aria-hidden="true"></i></a>`).join('')}
    </nav>
  </div>
  ${WORKFLOWS.map((_, i) => `<i class="tour__snap" style="--i: ${i}" aria-hidden="true"></i>`).join('')}
  <dialog class="tlist" id="tourList" aria-labelledby="tourListTitle">
    <span class="tlist__handle" aria-hidden="true"></span>
    <h2 class="tlist__h" id="tourListTitle">The ${n} workflows</h2>
    <ol class="tlist__items">${WORKFLOWS.map((wf, i) => `
      <li><a class="tlist__a" href="${workflowPath(wf.key)}" data-tour-go="${i}"><span class="tlist__n">${pad2(i + 1)}</span><span class="tlist__t">${esc(wf.title)}</span><span class="tlist__c">${esc(wf.category)}</span></a></li>`).join('')}
    </ol>
  </dialog>
</section>`;
}

/* ---------------------------------------------- nav, menu and footer */
interface Link { label: string; href: string; attr: string }

function links(o: PanelOptions): Link[] {
  return [
    { label: 'Workflows', href: '/#workflows', attr: 'data-nav="workflows"' },
    { label: 'Platform', href: PAGES.platform.path, attr: 'data-nav="platform"' },
    ...(hasCustomers(o) ? [{ label: 'Customers', href: PAGES.customers.path, attr: 'data-nav="customers"' }] : []),
    { label: 'Pricing', href: PAGES.pricing.path, attr: 'data-nav="pricing"' },
    { label: 'Company', href: PAGES.company.path, attr: 'data-nav="company"' },
  ];
}

export function navLinks(o: PanelOptions): string {
  return links(o).map((l) => `<a class="nav__link" href="${l.href}" ${l.attr}><span data-split>${esc(l.label)}</span></a>`).join('\n    ');
}

const legalLinks = () => legalDocs({ samples: false }).map((d) => `<a href="${d.path}">${esc(d.title)}</a>`);

/** the phone menu: the nav's links, set large, with the two actions under them */
export function menu(o: PanelOptions): string {
  return `<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Menu" hidden>
  <span class="menu__handle" aria-hidden="true"></span>
  <nav class="menu__links" aria-label="Menu">
    ${[...links(o), { label: 'Contact', href: PAGES.contact.path, attr: 'data-nav="contact"' }]
      .map((l, i) => `<a class="menu__link" href="${l.href}" ${l.attr}><span class="menu__n">${pad2(i + 1)}</span>${esc(l.label)}</a>`).join('\n    ')}
  </nav>
  <div class="menu__end">
    <a class="btn btn--solid btn--lg" href="${PAGES.contact.path}">Book a demo</a>
    <a class="btn btn--ghost btn--lg" href="${esc(BRAND.appUrl)}">Log in</a>
  </div>
  <div class="menu__fine">
    <button class="foot__pause menu__pause" type="button" data-motion-toggle aria-pressed="false"><span class="foot__pause-i" aria-hidden="true"></span><span class="foot__pause-t">Pause motion</span></button>
    <p class="menu__legal"><a href="${PAGES.legal.path}">${esc(LEGAL.kicker)}</a>${legalLinks().join('')}</p>
  </div>
</div>`;
}

/**
 * The band at the end of the page: four quiet columns of links over the
 * name set huge, on liquid metal (src/scene/liquid.ts) that parts where the
 * pointer goes. The name is sized from its own length, so a longer one after
 * the rename still fits the measure.
 */
export function routeFoot(o: PanelOptions): string {
  const col = (label: string, items: string[], end = false) =>
    `<nav class="rfoot__col${end ? ' rfoot__col--end' : ''}" aria-label="${label}">
        <h2 class="rfoot__h">${label}</h2>
        <ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>
      </nav>`;
  return `<footer class="rfoot" style="--chars: ${[...BRAND.name].length}">
    <div class="rfoot__cols">
      ${col('Product', [
        `<a href="/#workflows">Workflows</a>`,
        `<a href="${PAGES.platform.path}">How it stays private</a>`,
        `<a href="${PAGES.pricing.path}">Pricing</a>`,
        `<a href="${esc(BRAND.appUrl)}">Log in</a>`,
      ])}
      ${col('Company', [
        `<a href="${PAGES.company.path}">About</a>`,
        ...(hasCustomers(o) ? [`<a href="${PAGES.customers.path}">Customers</a>`] : []),
        `<a href="${PAGES.contact.path}">Contact</a>`,
      ])}
      ${col('Legal', legalLinks())}
      ${col('Contact', [
        `<a href="${PAGES.contact.path}">Book a demo</a>`,
        `<a href="mailto:${esc(BRAND.email)}">${esc(BRAND.email)}</a>`,
        ...BRAND.social.map((s) => `<a href="${esc(s.url)}" rel="me noopener" target="_blank">${esc(s.name)}</a>`),
      ], true)}
    </div>
    <div class="rfoot__mark">
      <p class="rfoot__word" aria-hidden="true">${esc(BRAND.name)}</p>
      <div class="rfoot__base">
        <p class="rfoot__copy">&copy; ${new Date().getFullYear()} ${esc(BRAND.legalName)} &middot; ${esc(FOOTER.line)}</p>
        <button class="foot__pause rfoot__pause" type="button" data-motion-toggle aria-pressed="false">
          <span class="foot__pause-i" aria-hidden="true"></span><span class="foot__pause-t">Pause motion</span>
        </button>
      </div>
    </div>
  </footer>`;
}

/**
 * The option to skip the form and pick a time. A real scheduling page is
 * linked; in demo mode the card opens the demo scheduler (src/ui/booking.ts),
 * whose days and times are filled in by the browser, in the visitor's own
 * time zone; with neither, the card is not there.
 */
export function booking(): string {
  const card = (attrs: string, tagHtml = '') => `<${attrs.startsWith('href') ? 'a' : 'button type="button"'} class="info__c info__c--book" ${attrs}>
          <span class="info__i" aria-hidden="true">${icon('calendar')}</span>
          <span class="info__t"><span class="info__k">Prefer to pick a time?${tagHtml}</span><span class="info__v">Choose a slot in our calendar instead of writing.</span></span>
          ${icon('arrow', 'info__go')}
        </${attrs.startsWith('href') ? 'a' : 'button'}>`;
  if (bookingMode === 'link') return card(`href="${esc(SERVICES.bookingUrl)}" target="_blank" rel="noopener"`);
  if (bookingMode === 'none') return '';
  return `${card('data-book aria-haspopup="dialog"', '<span class="tag tag--demo">Demo</span>')}
        <dialog class="book" id="book" aria-labelledby="bookTitle">
          <form class="book__form" id="bookForm" novalidate>
            <div class="book__top">
              <div>
                <p class="book__k">Demo scheduler</p>
                <h2 class="book__h" id="bookTitle">Pick a time for your demo</h2>
              </div>
              <button class="book__x" type="button" data-book-close aria-label="Close">${icon('close')}</button>
            </div>
            <p class="book__note">No calendar is connected yet: a booking goes to the local demo inbox. Times are shown in <span id="bookTz">your time zone</span>.</p>
            <fieldset class="book__set">
              <legend class="book__legend">Day</legend>
              <div class="book__days" id="bookDays"></div>
            </fieldset>
            <fieldset class="book__set">
              <legend class="book__legend">Time</legend>
              <div class="book__times" id="bookTimes"></div>
            </fieldset>
            <div class="form__row">
              <div class="field">
                <label for="b-name">Your name</label>
                <input id="b-name" name="name" type="text" autocomplete="name" required />
              </div>
              <div class="field">
                <label for="b-email">Work email</label>
                <input id="b-email" name="email" type="email" autocomplete="email" required />
              </div>
            </div>
            <button class="btn btn--solid btn--block" type="submit">Book this time</button>
            <p class="form__msg" id="bookMsg" role="status" aria-live="polite"></p>
          </form>
          <div class="book__done" id="bookDone" hidden>
            <span class="book__tick" aria-hidden="true">${icon('check')}</span>
            <h2 class="book__h" tabindex="-1" id="bookDoneTitle">You are booked.</h2>
            <p class="book__when" id="bookWhen"></p>
            <p class="book__note">Demo mode: the booking is in the <a href="${DEMO_INBOX}" target="_blank" rel="noopener">local demo inbox</a>. With a real scheduling page set, this card sends people there instead.</p>
            <button class="btn btn--ghost" type="button" data-book-close>Close</button>
          </div>
        </dialog>`;
}
