/*
 * The demo stand-in for the outside services (SERVICES.demo in
 * @site/content). `npm run dev` and `npm run preview` answer:
 *
 *   POST /api/demo/contact   the contact form, as JSON (or a plain form post
 *                            without scripts, which comes back to the page)
 *   POST /api/demo/booking   a time picked in the demo scheduler
 *   GET  /__demo/inbox       everything received, newest first
 *
 * Each one is appended to .demo/inbox.jsonl and announced in the
 * server's terminal. It is a stand-in to show the flow end to end: a built
 * site on a real host has none of it, which is why `npm run check --
 * --launch` refuses while demo mode is on.
 */
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Connect, Plugin } from 'vite';
import { BRAND, DEMO_API, DEMO_INBOX, PAGES, SERVICES } from '../content/src/index.ts';

type Kind = 'contact' | 'booking';
interface Entry { id: string; kind: Kind; at: string; fields: Record<string, string> }

const FIELDS: Record<Kind, string[]> = {
  contact: ['name', 'email', 'company', 'size', 'topic', 'message', 'page'],
  booking: ['name', 'email', 'start', 'when', 'zone', 'timezone'],
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function readBody(req: IncomingMessage, limit = 32_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** what was sent, as plain strings, keeping only the fields this kind has */
function fieldsOf(kind: Kind, raw: string, type: string): Record<string, string> {
  let data: Record<string, unknown> = {};
  if (type.includes('application/json')) data = JSON.parse(raw || '{}') as Record<string, unknown>;
  else data = Object.fromEntries(new URLSearchParams(raw));
  return Object.fromEntries(FIELDS[kind]
    .filter((k) => data[k] !== undefined && data[k] !== '')
    .map((k) => [k, String(data[k]).slice(0, 4000)]));
}

function inboxPage(entries: Entry[]): string {
  const rows = entries.map((e) => {
    const f = e.fields;
    const when = new Date(e.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    const detail = e.kind === 'booking'
      ? `<p class="big">${esc(f.when ?? f.start ?? '')}</p><p>${esc(f.zone ?? f.timezone ?? '')}</p>`
      : `<p class="meta">${esc([f.company, f.size && `${f.size} people`, f.topic].filter(Boolean).join(' · '))}</p>${f.message ? `<p>${esc(f.message)}</p>` : ''}`;
    return `<article><header><span class="kind kind--${e.kind}">${e.kind === 'booking' ? 'Booking' : 'Message'}</span><time>${esc(when)}</time></header>
      <h2>${esc(f.name ?? 'No name')} <a href="mailto:${esc(f.email ?? '')}">${esc(f.email ?? '')}</a></h2>${detail}</article>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo inbox · ${esc(BRAND.name)}</title><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
  body { margin: 0; background: #05070c; color: #f4f5f7; font: 15px/1.55 system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 56px 20px 80px; }
  .k { margin: 0 0 10px; font: 500 11.5px ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; color: #5098f8; }
  h1 { margin: 0 0 10px; font: 400 40px/1.1 Georgia, serif; letter-spacing: -.02em; }
  .lede { margin: 0 0 36px; color: rgba(244,245,247,.7); }
  article { padding: 20px 22px; margin-bottom: 12px; border: 1px solid rgba(226,232,245,.14); border-radius: 18px; background: #0d111b; }
  article header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; font-size: 13px; color: rgba(244,245,247,.52); }
  .kind { padding: 2px 9px; border-radius: 99px; font-size: 11.5px; font-weight: 600; }
  .kind--contact { background: rgba(80,152,248,.16); color: #5098f8; }
  .kind--booking { background: rgba(24,80,224,.9); color: #fff; }
  h2 { margin: 0 0 6px; font-size: 16px; font-weight: 600; }
  h2 a { margin-left: 8px; color: rgba(244,245,247,.7); font-weight: 400; }
  p { margin: 4px 0 0; color: rgba(244,245,247,.7); white-space: pre-wrap; }
  .big { font: 400 22px Georgia, serif; color: #f4f5f7; }
  .meta { font-size: 13.5px; }
  .empty { padding: 40px; text-align: center; border: 1px dashed rgba(226,232,245,.2); border-radius: 18px; color: rgba(244,245,247,.52); }
  a { color: #5098f8; }
</style></head><body><main>
<p class="k">Demo inbox</p>
<h1>What the site has received</h1>
<p class="lede">Messages from the contact form and times picked in the demo scheduler, newest first. Kept in .demo/inbox.jsonl, on this machine only. Set a real endpoint and booking link in content/src/services.ts and they go there instead. <a href="${PAGES.contact.path}">Back to the contact page</a></p>
${rows || '<p class="empty">Nothing yet. Send the contact form or book a time, then reload.</p>'}
</main></body></html>`;
}

export function demoServices(): Plugin {
  let file = '';

  const handle: Connect.NextHandleFunction = (req, res: ServerResponse, next) => {
    const url = (req.url ?? '').split('?')[0]!;
    if (url === DEMO_INBOX || url === `${DEMO_INBOX}/`) {
      readFile(file, 'utf8').catch(() => '').then((text) => {
        const entries = text.split('\n').filter(Boolean).map((l) => JSON.parse(l) as Entry).reverse();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(inboxPage(entries));
      });
      return;
    }
    const m = url.match(new RegExp(`^${DEMO_API}/(contact|booking)/?$`));
    if (!m) { next(); return; }
    if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); res.end(); return; }

    const kind = m[1] as Kind;
    const type = String(req.headers['content-type'] ?? '');
    readBody(req).then(async (raw) => {
      const fields = fieldsOf(kind, raw, type);
      if (!fields.email || !fields.name) {
        res.statusCode = 422;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'name and email are required' }));
        return;
      }
      const entry: Entry = { id: randomUUID().slice(0, 8), kind, at: new Date().toISOString(), fields };
      await mkdir(path.dirname(file), { recursive: true });
      await appendFile(file, `${JSON.stringify(entry)}\n`);
      console.log(`\n  demo ${kind} from ${fields.name} <${fields.email}>: see ${DEMO_INBOX}\n`);
      if (type.includes('application/json')) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, id: entry.id }));
      } else {
        // a form posted without scripts comes back to its page
        res.statusCode = 303;
        res.setHeader('Location', `${PAGES.contact.path}?sent=1`);
        res.end();
      }
    }).catch(() => {
      res.statusCode = 400;
      res.end();
    });
  };

  return {
    name: 'demo-services',
    configResolved(config) { file = path.join(config.root, '.demo', 'inbox.jsonl'); },
    configureServer(server) { if (SERVICES.demo) server.middlewares.use(handle); },
    configurePreviewServer(server) { if (SERVICES.demo) server.middlewares.use(handle); },
  };
}
