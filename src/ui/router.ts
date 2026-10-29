/*
 * Addresses, on one page. / is the top (the ring), /platform/, /pricing/ and
 * the rest are sections further down the same page, /workflows/<key>/ opens
 * that workflow's film over it, /legal/ and /legal/<document>/ open the legal
 * page over it (a page of its own, with its own scroll), and anything else
 * is the not-found notice.
 * The build writes every address as its own file (build/site.ts), each the
 * whole page scrolled to its section before the first paint, so a link or a
 * search result lands where it says; here they just come alive.
 *
 * Moving between them never reloads: a link scrolls to its section (under
 * the veil when it is far, src/ui/scroll.ts) and pushes the address; the
 * back button walks back through them. While the visitor scrolls, the
 * address and the title follow the section they are reading, replaced
 * rather than pushed, so a reload or a shared link lands on it too.
 */
import { BRAND, PAGES, WORKFLOWS, workflowPath } from '@site/content';
import { DUR, reduceMotion } from '../lib/motion.ts';
import { store, type Section } from '../lib/store.ts';
import { onScroll, pageTop, rescroll, shiftScroll, smoothPanel, travelTo, type Chapter, type ScrollFrame } from './scroll.ts';
import { pullToClose } from './pull.ts';

export interface Location { section: Section | null; flow: string | null; missing: boolean; hash: string; doc?: string | null }

const slash = (p: string) => (p.endsWith('/') ? p : `${p}/`);

interface Part { name: Section; el: HTMLElement; path: string; top: number; height: number }

/* every section this build has, in page order: Customers, for one, is left
   out until there is something real to put in it */
const parts: Part[] = [...document.querySelectorAll<HTMLElement>('[data-section]')].map((el) => {
  const name = el.dataset.section as Section;
  const path = name === 'home' || name === 'workflows' ? '/' : PAGES[name].path;
  return { name, el, path, top: 0, height: 0 };
});
const byName = new Map(parts.map((p) => [p.name, p]));
const LEGACY: Record<string, string> = { '#/': '/', '#/pricing': PAGES.pricing.path, '#/contact': PAGES.contact.path };
/** the legal documents this build has, each with its view on the legal page */
const DOCS = [...document.querySelectorAll<HTMLElement>('[data-doc-view]')].map((v) => v.dataset.docView!).filter(Boolean);

export function parse(pathname: string, hash = ''): Location {
  const p = slash(pathname);
  const h = decodeURIComponent(hash.replace(/^#/, ''));
  const m = p.match(/^\/workflows\/([a-z0-9-]+)\/$/);
  if (m && WORKFLOWS.some((w) => w.key === m[1])) return { section: null, flow: m[1]!, missing: false, hash: '' };
  if (p === '/') return { section: h && byName.has(h as Section) ? (h as Section) : 'home', flow: null, missing: false, hash: h };
  // the legal page: its overview, a document, or an old /legal/#privacy link
  const legal = slash(PAGES.legal.path);
  if (p === legal) return { section: null, flow: null, missing: false, hash: '', doc: DOCS.includes(h) ? h : '' };
  const doc = p.startsWith(legal) ? p.slice(legal.length, -1) : '';
  if (doc && DOCS.includes(doc)) return { section: null, flow: null, missing: false, hash: '', doc };
  const part = parts.find((x) => x.path === p && x.name !== 'home' && x.name !== 'workflows');
  if (part) return { section: part.name, flow: null, missing: false, hash: h };
  return { section: null, flow: null, missing: true, hash: '' };
}

const pathOf = (s: Section) => byName.get(s)?.path ?? '/';
/** where the way back from Legal goes: the part of the page it was opened over (the tour shares the top's address, so it is named) */
const backOf = (s: Section) => (s === 'workflows' ? '/#workflows' : pathOf(s));
const titleOf = (s: Section) => (s === 'home' || s === 'workflows' ? PAGES.home.title : PAGES[s].title);
const flowTitle = (key: string) => `${WORKFLOWS.find((w) => w.key === key)!.title} · ${BRAND.name}`;

/* --------------------------------------------------------- reveals */
/* whatever is already on screen (or above it) when the page starts is shown
   as it is; the rest comes in as the scroll brings it in, whatever came into
   view in the same frame together, in order: 40ms apart, and no more than
   six steps deep, so a long list never makes its last item wait. The
   animation itself is CSS (styles/routes.css) that .is-in starts, a delay
   apiece for the order: nothing here touches more than a class and a
   number. With reduced motion the same arrival is a brief fade. */
const STAGGER = 0.04;
const DEEPEST = 5;

function reveals(): void {
  const items = [...document.querySelectorAll<HTMLElement>('.rv')];
  if (!('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-shown')); return; }
  const pending: HTMLElement[] = [];
  let queued = false;
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      pending.push(en.target as HTMLElement);
      io.unobserve(en.target);
    }
    if (!queued && pending.length) {
      queued = true;
      requestAnimationFrame(() => {
        pending.splice(0).forEach((el, i) => {
          if (i) el.style.setProperty('--d', `${(Math.min(i, DEEPEST) * STAGGER).toFixed(2)}s`);
          el.classList.add('is-in');
        });
        queued = false;
      });
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
  /* what is on screen or above it is measured by its section first: an item
     inside a section that is off the screen is not laid out yet (styles/
     routes.css), and measuring it would lay the section out for nothing */
  const fold = innerHeight;
  const boxes = new Map<Element, DOMRect>();
  const seen = items.filter((el) => {
    const sec = el.closest('[data-section]');
    if (!sec) return true;
    let r = boxes.get(sec);
    if (!r) { r = sec.getBoundingClientRect(); boxes.set(sec, r); }
    if (r.bottom <= 0) return true;
    if (r.top >= fold) return false;
    return el.getBoundingClientRect().top < fold;
  });
  const shown = new Set(seen);
  for (const el of items) {
    if (shown.has(el)) el.classList.add('is-shown');
    else io.observe(el);
  }
}

/* ---------------------------------------------------------- router */
export interface RouterHandlers {
  /** the open workflow should change: a key to open, null to close */
  onFlow(key: string | null): void;
}

let handlers: RouterHandlers;
/** did this visit push the workflow address it is on? then closing goes back, not forward */
let pushedFlow = false;
/** the player closed itself and stepped the address back: the step lands where the page already is */
let backFromFlow = false;
/** while the page travels to a section, the scroll does not rewrite the address on the way */
let travelling = false;
let shown: Section = 'home';

function showMissing(on: boolean): void {
  const el = document.getElementById('missing');
  if (!el) return;
  el.classList.toggle('is-open', on);
  el.setAttribute('aria-hidden', String(!on));
  document.body.classList.toggle('is-route-open', on);
  if (on) el.querySelectorAll('.rv').forEach((x) => x.classList.add('is-shown'));
  store.set({ missing: on });
  if (on) document.title = PAGES.missing.title;
}

/**
 * The legal page, open on its overview ('') or a document, or closed (null).
 * Which view it shows is said on <html> (data-doc), as the build writes it
 * for each address; a new view starts at its top, with its heading focused
 * so a screen reader starts there too. Its way back goes to the part of the
 * site the visitor was reading.
 */
/** what had focus when the legal page opened */
let docOpener: HTMLElement | null = null;

function showDoc(id: string | null, first = false): void {
  const el = document.getElementById('legal');
  if (!el) return;
  const html = document.documentElement;
  const was = store.get().doc;
  if (id === null) {
    if (was === null) return;
    el.classList.remove('is-landed');
    // focus goes back to what opened the page, when it is still there to take it
    if (docOpener?.isConnected && !docOpener.closest('[inert]')) docOpener.focus({ preventScroll: true });
    docOpener = null;
    // from wherever a finger left it (src/ui/pull.ts), the page goes on down
    el.style.removeProperty('transform');
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    html.removeAttribute('data-doc');
    document.body.classList.remove('is-doc-open');
    smoothPanel(null);
    store.set({ doc: null });
    return;
  }
  if (was === null && !first) docOpener = document.activeElement as HTMLElement | null;
  // an address of its own landed on: the page itself, not a sheet over one (styles/phone.css)
  if (first) el.classList.add('is-landed');
  html.dataset.doc = id;
  el.classList.add('is-open');
  el.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-doc-open');
  el.querySelector<HTMLAnchorElement>('[data-doc-back]')?.setAttribute('href', backOf(shown));
  const view = el.querySelector<HTMLElement>(`[data-doc-view="${id}"]`);
  // on a phone the tabs are a row that scrolls: the current one is brought to its middle
  const tabs = el.querySelector<HTMLElement>('.doc__tabs');
  const tab = tabs?.querySelector<HTMLElement>(`[data-doc-tab="${id}"]`);
  if (tabs && tab && tabs.scrollWidth > tabs.clientWidth) {
    tabs.scrollTo({ left: tab.offsetLeft - (tabs.clientWidth - tab.offsetWidth) / 2, behavior: first || reduceMotion ? 'auto' : 'smooth' });
  }
  document.title = view?.dataset.docTitle ?? PAGES.legal.title;
  smoothPanel(el, id !== was);
  store.set({ doc: id });
  if (!first && id !== was) view?.querySelector<HTMLElement>('.doc__h')?.focus({ preventScroll: true });
  // a new view rises into place; the page itself fades in over the site as it opens (styles/routes.css)
  if (!first && id !== was && !reduceMotion) {
    view?.animate([{ opacity: 0, translate: '0 18px' }, { opacity: 1, translate: '0 0' }], { duration: DUR.move * 1000, easing: 'cubic-bezier(.16,1,.3,1)' });
  }
}

function setCurrent(s: Section): void {
  document.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach((a) => {
    if (a.dataset.nav === s) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
}

/** the element an address's #hash names, when it is inside a section; otherwise the section itself */
function targetOf(loc: Location): HTMLElement | null {
  const inner = loc.hash && !byName.has(loc.hash as Section) ? document.getElementById(loc.hash) : null;
  if (inner?.closest('[data-section]')) return inner;
  return loc.section ? byName.get(loc.section)?.el ?? null : null;
}

/**
 * Runs a change that may resize what is above the screen, and keeps what is
 * on the screen where it was: whatever is in the middle of it stays put, and
 * the scroll takes up the difference.
 */
function keepPlace(change: () => void): void {
  // what is in the middle of the screen (the bars and the cursor take no pointer there), or failing that the section
  const ref = document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('main *') ?? byName.get(shown)?.el ?? document.getElementById('main')!;
  const before = ref.getBoundingClientRect().top;
  change();
  shiftScroll(ref.getBoundingClientRect().top - before);
  measure();
}

/* The sections above the one being travelled to are laid out first, at
   their real size: one still at its stand-in size (styles/routes.css) would
   grow once it was drawn and push the section being read down the page. */
function settleAbove(el: HTMLElement): void {
  keepPlace(() => {
    for (const p of parts) {
      if (p.el === el || p.el.contains(el)) break;
      if (p.el.matches('.sec')) { p.el.style.contentVisibility = 'visible'; p.el.removeAttribute('data-frozen'); }
    }
  });
}

/*
 * A visit that lands on a section further down (/pricing/, say) finds the
 * sections above it frozen at a stand-in size (index.html): not laid out,
 * so nothing above can move the page while the fonts arrive. Each thaws
 * when the visitor scrolls up towards it, with the page held in place as it
 * takes its real size; never before they have touched the page.
 */
function thawOnTheWayUp(): void {
  const frozen = parts.filter((p) => p.el.hasAttribute('data-frozen'));
  if (!frozen.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      io.unobserve(en.target);
      keepPlace(() => {
        (en.target as HTMLElement).style.contentVisibility = 'visible';
        en.target.removeAttribute('data-frozen');
      });
    }
  }, { rootMargin: '120% 0px 0px 0px' });
  const kinds = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  const start = () => {
    kinds.forEach((k) => removeEventListener(k, start, true));
    frozen.forEach((p) => io.observe(p.el));
  };
  kinds.forEach((k) => addEventListener(k, start, { capture: true, passive: true }));
}

/** a section as the menu numbers and names it, for the veil of a long jump there (none for the top) */
function chapterOf(s: Section): Chapter | null {
  const link = document.querySelector<HTMLElement>(`.menu__link[data-nav="${s}"]`);
  if (!link || s === 'home') return null;
  const n = link.querySelector('.menu__n')?.textContent ?? '';
  return { n, name: (link.textContent ?? '').replace(n, '').trim() };
}

/** below the nav, so a section's heading is not under it */
const navGap = () => (document.querySelector<HTMLElement>('.nav')?.offsetHeight ?? 0) - 4;

async function go(loc: Location): Promise<void> {
  if (loc.flow) { handlers.onFlow(loc.flow); return; }
  const fromFlow = backFromFlow || store.get().flowIndex >= 0;
  backFromFlow = false;
  if (store.get().flowIndex >= 0) handlers.onFlow(null);
  if (loc.doc !== undefined && loc.doc !== null) { showMissing(false); showDoc(loc.doc); return; }
  const leaving = store.get().doc !== null;
  showDoc(null);
  showMissing(loc.missing);
  /* back from the legal page or a film to the part of the site it was
     opened over: the page is still there, untouched (the tour shares the
     top's address, so an address without a #name that is that part's own
     is the same place) */
  const same = loc.section === shown || (!loc.hash && !!loc.section && pathOf(loc.section) === pathOf(shown));
  if ((leaving || fromFlow) && same && (!loc.hash || loc.hash === shown)) { setCurrent(shown); document.title = titleOf(shown); return; }
  if (loc.missing) return;
  const el = targetOf(loc);
  if (!el) return;
  // a section's own top is under the nav already (its padding), so it goes to the very top; a heading inside one sits below the nav
  const yOf = () => Math.max(0, loc.section === 'home' ? 0 : pageTop(el) - (el.matches('[data-section]') ? 0 : navGap() + 16));
  travelling = true;
  setCurrent(loc.section!);
  document.title = titleOf(loc.section!);
  // where it is before what lies between is laid out says whether the way is long; the exact place is measured on arrival
  await travelTo(yOf(), chapterOf(loc.section!), () => { settleAbove(el); return yOf(); });
  travelling = false;
  shown = loc.section!;
  store.set({ section: loc.section! });
}

export function navigate(path: string, hash = '', replace = false): void {
  const target = path + (hash ? `#${hash.replace(/^#/, '')}` : '');
  if (location.pathname + location.hash !== target) history[replace ? 'replaceState' : 'pushState'](null, '', target);
  pushedFlow = false;
  void go(parse(path, hash));
}

/**
 * The player opened, swapped or closed on its own (a card, the arrows, the
 * close button): bring the address in line without telling the player back.
 */
export function syncFlow(key: string | null): void {
  const here = parse(location.pathname);
  if (key) {
    const want = workflowPath(key);
    if (slash(location.pathname) !== want) {
      if (here.flow) history.replaceState({ flow: true }, '', want);
      else { history.pushState({ flow: true }, '', want); pushedFlow = true; }
    }
    document.title = flowTitle(key);
  } else if (here.flow) {
    if (pushedFlow && history.state?.flow) { pushedFlow = false; backFromFlow = true; history.back(); }
    else history.replaceState(null, '', pathOf(shown));
    document.title = titleOf(shown);
  }
}

/*
 * A section is not laid out until it nears the screen (content-visibility:
 * the page is long, and laying all of it out held the first paint back).
 * Left to then, a long one (the platform, on a phone) was laid out in the
 * very frame the scroll reached it, and that frame was late. So each is laid
 * out ahead: once it is within a few screens below, at the first quiet
 * moment, when the scroll has paused and the browser has time to spare.
 */
function layOutAhead(): void {
  if (!('IntersectionObserver' in window)) return;
  let scrolled = 0;
  addEventListener('scroll', () => { scrolled = performance.now(); }, { passive: true });
  const later = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 300));
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      io.unobserve(en.target);
      const inner = en.target.querySelector<HTMLElement>('.sec__inner') ?? (en.target as HTMLElement);
      const run = () => {
        // not in the middle of a scroll: wait for it to pause
        if (performance.now() - scrolled < 150) { setTimeout(() => later(run), 200); return; }
        // asking where its last part is lays out the whole of it, which it then keeps
        inner.lastElementChild?.getBoundingClientRect();
      };
      later(run);
    }
  }, { rootMargin: '0px 0px 300% 0px' });
  parts.filter((p) => p.el.matches('.sec') && !p.el.hasAttribute('data-frozen')).forEach((p) => io.observe(p.el));
}

/* ------------------------------------------------------- scrollspy */
function measure(): void {
  for (const p of parts) { p.top = pageTop(p.el); p.height = p.el.offsetHeight; }
  rescroll();
}

function spy({ y, vh }: ScrollFrame): void {
  // the section that holds the line two-fifths of the way down the screen
  const line = y + vh * 0.4;
  let now = parts[0]!;
  for (const p of parts) if (p.top <= line) now = p;
  if (now.name === shown) return;
  shown = now.name;
  store.set({ section: now.name });
  if (travelling) return;
  setCurrent(now.name);
  const s = store.get();
  if (s.mode !== 'grid') return;
  if (location.pathname !== now.path || location.hash) history.replaceState(null, '', now.path);
  document.title = titleOf(now.name);
}

export function startRouter(h: RouterHandlers): void {
  handlers = h;

  // Legal on a phone is a sheet a finger can pull down to close: the way back, as its button would take it
  const legal = document.getElementById('legal');
  if (legal) pullToClose(legal, () => legal.querySelector<HTMLAnchorElement>('[data-doc-back]')?.click());

  // old #/pricing style links still land
  const legacy = LEGACY[location.hash];
  if (legacy) history.replaceState(null, '', legacy);

  /* same-site links move without a reload; anything with a modifier, a
     target or another origin is left to the browser */
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    e.preventDefault();
    navigate(url.pathname, url.hash);
  });

  addEventListener('popstate', () => { pushedFlow = false; void go(parse(location.pathname, location.hash)); });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (store.get().doc !== null && store.get().flowIndex < 0) navigate(backOf(shown));
    else if (store.get().missing) navigate('/');
  });

  measure();
  new ResizeObserver(() => { measure(); }).observe(document.getElementById('main')!);
  addEventListener('load', measure);

  const here = parse(location.pathname, location.hash);
  // the section landed on is the one being read: the scroll does not rewrite its address (and its #hash) on the first frame
  if (here.section) { shown = here.section; setCurrent(here.section); store.set({ section: here.section }); }
  reveals();
  // the first-paint attributes have done their job (the landing scroll in index.html); from here the router keeps state
  document.documentElement.removeAttribute('data-route');
  document.documentElement.removeAttribute('data-flow');
  if (here.flow) handlers.onFlow(here.flow);
  else if (here.doc !== undefined && here.doc !== null) showDoc(here.doc, true);
  else if (here.missing) showMissing(true);
  else if (here.hash && here.section) {
    const el = targetOf(here);
    if (el) scrollTo({ top: Math.max(0, pageTop(el) - (el.matches('[data-section]') ? 0 : navGap() + 16)), behavior: 'instant' as ScrollBehavior });
  }
  onScroll(spy);
  thawOnTheWayUp();
  layOutAhead();
}

/** where a section starts and ends on the page, kept current as the page changes size */
export function sectionBox(name: Section): { top: number; height: number } | null {
  const p = byName.get(name);
  return p ? { top: p.top, height: p.height } : null;
}
