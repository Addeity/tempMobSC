/*
 * Checks the content before anything is built or rendered from it:
 *
 *   npm run check               every build runs this
 *   npm run check -- --launch   the gate before going live
 *
 * A step past the end of its film, a focus box off the frame, a mask window
 * that never happens or a cut outside the clip all fail here, loudly,
 * instead of shipping as a camera pointed at nothing.
 *
 * It also lists what is not yet true: copy still marked draft, samples that
 * only the dev server shows, [placeholders] in the legal pages and a
 * placeholder domain. Those are notes on a normal run; with --launch, each
 * one fails it.
 */
import { readFileSync } from 'node:fs';
import {
  BRAND, COMPANY, LEGAL, PLATFORM, PROOF, SERVICES, WORKFLOWS, filmDuration, masterDuration,
  type Rect, type Status, type Workflow,
} from '../src/index.ts';

const launch = process.argv.includes('--launch');

const problems: string[] = [];
const fail = (wf: Workflow | null, msg: string) => problems.push(`${wf ? `${wf.key}: ` : ''}${msg}`);

function rect(wf: Workflow, what: string, r: Rect) {
  const [x, y, w, h] = r;
  if (w <= 0 || h <= 0) fail(wf, `${what} has no size`);
  if (x < 0 || y < 0 || x + w > 1.0001 || y + h > 1.0001) fail(wf, `${what} [${r.join(', ')}] runs off the frame`);
}

const keys = new Set<string>();
for (const wf of WORKFLOWS as readonly Workflow[]) {
  if (keys.has(wf.key)) fail(wf, 'key is used twice');
  keys.add(wf.key);
  if (!/^[a-z0-9-]+$/.test(wf.key)) fail(wf, 'key must be lowercase letters, digits and hyphens: it is a URL');

  const { start, end, cuts } = wf.source;
  if (end <= start) fail(wf, 'source ends before it starts');
  let last = 0;
  for (const [a, b] of cuts) {
    if (a < last || b <= a) fail(wf, `cut [${a}, ${b}] overlaps or runs backwards`);
    if (b > end - start) fail(wf, `cut [${a}, ${b}] is past the end of the clip`);
    last = b;
  }
  if (wf.speed < 1) fail(wf, 'films are tightened, never slowed: speed must be >= 1');

  const dur = filmDuration(wf);
  if (masterDuration(wf) <= 0) fail(wf, 'nothing left after the cuts');
  if (!wf.steps.length) fail(wf, 'has no steps');
  wf.steps.forEach((s, i) => {
    if (s.t < 0 || s.t >= dur) fail(wf, `step ${i + 1} at ${s.t}s is outside the ${dur.toFixed(1)}s film`);
    if (i > 0 && s.t <= wf.steps[i - 1]!.t) fail(wf, `step ${i + 1} does not come after step ${i}`);
    if (s.focus) rect(wf, `step ${i + 1} focus`, s.focus);
    if (!s.title.trim() || !s.body.trim()) fail(wf, `step ${i + 1} is missing its words`);
  });
  for (const m of wf.masks ?? []) {
    rect(wf, `${m.kind} mask`, m.rect);
    if (m.kind === 'cover') {
      for (const [a, b] of m.during) if (b <= a || a >= dur) fail(wf, `cover window [${a}, ${b}] never shows`);
    }
  }
  for (const field of ['title', 'category', 'lede', 'note'] as const) {
    if (!wf[field].trim()) fail(wf, `${field} is empty`);
    if (/—/.test(wf[field])) fail(wf, `${field} uses an em dash; the site's copy does not`);
  }
}

if (!/^https:\/\/[^/]+$/.test(BRAND.url)) fail(null, 'BRAND.url must be https://host with no trailing slash');
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(BRAND.email)) fail(null, 'BRAND.email does not look like an address');

/* ------------------------------------------- company, proof, legal */
const keysKnown = new Set(WORKFLOWS.map((w) => w.key));
for (const story of PROOF.stories) {
  for (const k of story.workflows) if (!keysKnown.has(k)) fail(null, `story "${story.company}" links a workflow that does not exist: ${k}`);
}
for (const tool of PLATFORM.integrations.tools) {
  if ('flow' in tool && tool.flow && !keysKnown.has(tool.flow)) fail(null, `tool "${tool.name}" links a workflow that does not exist: ${tool.flow}`);
}

/** every entry with a status, wherever it sits, with a label to find it by */
function statuses(node: unknown, at: string, out: { at: string; status: Status; text: string }[] = []) {
  if (Array.isArray(node)) node.forEach((n, i) => statuses(n, `${at}[${i}]`, out));
  else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (typeof o.status === 'string') {
      const label = String(o.title ?? o.q ?? o.label ?? o.name ?? o.company ?? o.plan ?? o.id ?? '');
      out.push({ at: label ? `${at} "${label}"` : at, status: o.status as Status, text: JSON.stringify(o) });
    }
    for (const [k, v] of Object.entries(o)) if (k !== 'status') statuses(v, `${at}.${k}`, out);
  }
  return out;
}
const entries = [
  ...statuses(PLATFORM, 'PLATFORM'), ...statuses(PROOF, 'PROOF'),
  ...statuses(COMPANY, 'COMPANY'), ...statuses(LEGAL, 'LEGAL'),
];
for (const e of entries) if (/—/.test(e.text)) fail(null, `${e.at} uses an em dash; the site's copy does not`);

const drafts = entries.filter((e) => e.status === 'draft');
const samples = entries.filter((e) => e.status === 'sample');
const legalText = [LEGAL.updated, ...LEGAL.sections.flatMap((s) => s.paragraphs)].join(' ');
const placeholders = [...legalText.matchAll(/\[[^\][]+\]/g)].map((m) => m[0]);
const todo: string[] = [];
const placeholders_ = [BRAND.url, `https://${BRAND.email.split('@')[1]}`, BRAND.appUrl].filter((u) => /\.example$/.test(new URL(u).hostname));
if (placeholders_.length) todo.push('BRAND.url, BRAND.email and BRAND.appUrl are placeholders (.example)');
// the pricing page says its own prices are placeholders, in so many words
if (readFileSync(new URL('../../index.html', import.meta.url), 'utf8').includes('placeholders for review')) {
  todo.push('the prices on the pricing page are placeholders: set them in index.html and remove the line that says so');
}
const listed = (items: { at: string }[]) => items.map((d) => `\n      ${d.at}`).join('');
if (drafts.length) todo.push(`${drafts.length} entries are drafts, to confirm in content/src/company.ts:${listed(drafts)}`);
if (samples.length) todo.push(`${samples.length} entries are samples (dev server only), to replace with real ones or remove:${listed(samples)}`);
if (placeholders.length) todo.push(`the legal pages still have ${placeholders.length} placeholders: ${[...new Set(placeholders)].join(', ')}`);
if (SERVICES.demo) {
  console.log('note: demo mode is on: the form and the scheduler go to the local stand-in, see /__demo/inbox (content/src/services.ts)');
  todo.push('demo mode is on: a real host has no stand-in, so set contactEndpoint and bookingUrl (or leave them empty for the email app) and turn demo off');
} else if (!SERVICES.contactEndpoint) {
  console.log("note: no contact endpoint set; the form opens the visitor's email app instead (content/src/services.ts)");
}

if (launch) todo.forEach((t) => fail(null, `not ready to launch: ${t}`));
else if (todo.length) console.warn(`before launch (npm run check -- --launch):\n  - ${todo.map((t) => t.split('\n')[0]).join('\n  - ')}`);

if (problems.length) {
  console.error(`${problems.length} problem(s) in @site/content:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`content ok: ${WORKFLOWS.length} workflows, ${WORKFLOWS.reduce((n, w) => n + w.steps.length, 0)} steps`);
