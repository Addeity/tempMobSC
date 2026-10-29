/*
 * The pricing page's billing toggle and the contact form.
 *
 * The form sends to SERVICES.contactEndpoint when one is set, or in demo
 * mode to the local stand-in (build/demo.ts). Without either, it opens the
 * visitor's own email app with the message written out and addressed:
 * nothing typed is ever thrown away, which is what it used to do.
 */
import { BRAND, DEMO_INBOX, SERVICES, formEndpoint } from '@site/content';
import { track } from '../lib/analytics.ts';
import { byId } from '../lib/dom.ts';

export function billingToggle(): void {
  const group = document.getElementById('billing');
  if (!group) return;
  group.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!btn) return;
    const yearly = btn.dataset.period === 'yr';
    group.querySelectorAll('button').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll<HTMLElement>('.plan').forEach((plan) => {
      const amt = plan.querySelector<HTMLElement>('.plan__amt');
      const note = plan.querySelector<HTMLElement>('.plan__note');
      if (amt?.dataset.mo) amt.textContent = `$${yearly ? amt.dataset.yr : amt.dataset.mo}`;
      if (note?.dataset.noteMo) note.textContent = (yearly ? note.dataset.noteYr : note.dataset.noteMo) ?? '';
    });
  });
}

export function contactForm(): void {
  const form = document.getElementById('contactForm') as HTMLFormElement | null;
  if (!form) return;
  const msg = byId('contactMsg');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  let sending = false;

  const errFor = (input: HTMLInputElement, text: string) => {
    const slot = form.querySelector(`[data-err-for="${input.id}"]`);
    if (slot) slot.textContent = text;
    if (text) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return !text;
  };

  /** a status line, optionally ending in a link */
  const say = (text: string, err = false, link?: { href: string; label: string; newTab?: boolean }) => {
    msg.textContent = text;
    msg.classList.toggle('is-err', err);
    if (link) {
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.label;
      // the demo inbox is not a page of the site: it opens beside it, past the router
      if (link.newTab) { a.target = '_blank'; a.rel = 'noopener'; }
      msg.append(' ', a, '.');
    }
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const name = byId<HTMLInputElement>('c-name');
    const email = byId<HTMLInputElement>('c-email');
    const company = byId<HTMLInputElement>('c-company');
    const ev = email.value.trim();
    const results = [
      errFor(name, name.value.trim() ? '' : 'Please tell us your name.'),
      errFor(email, !ev ? 'We need an email to reply to.' : emailOk(ev) ? '' : 'That email does not look right.'),
      errFor(company, company.value.trim() ? '' : 'Which company are you with?'),
    ];
    if (results.includes(false)) {
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      say('');
      return;
    }

    const fields = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim()]));
    // a field nobody can see or reach: only a bot fills it in. It gets the same thanks and goes nowhere
    if (fields.website) { say('Thanks. We will reply within one working day.'); form.reset(); return; }
    delete fields.website;
    const mail = { href: mailto(fields), label: BRAND.email };

    if (!formEndpoint) {
      location.href = mail.href;
      say('Your email app has opened with the message written out. Send it from there, or write to us at', false, mail);
      track('Demo request', { via: 'email' });
      return;
    }

    sending = true;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    say('Sending.');
    try {
      const res = await fetch(formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...fields, page: location.href }),
      });
      if (!res.ok) throw new Error(String(res.status));
      if (SERVICES.contactEndpoint) say('Thanks. We will reply within one working day.');
      else say('Thanks. Demo mode: your message is in the', false, { href: DEMO_INBOX, label: 'local demo inbox', newTab: true });
      form.reset();
      form.querySelectorAll('.field__err').forEach((s) => { s.textContent = ''; });
      track('Demo request', { via: 'form' });
    } catch {
      // what they wrote stays in the form, and the email route is offered with it already filled in
      say('That did not go through. Try again, or send it by email to', true, mail);
    } finally {
      sending = false;
      submit.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });

  // clear an error as soon as the field is touched again
  form.querySelectorAll<HTMLInputElement>('input, textarea').forEach((i) => {
    i.addEventListener('input', () => {
      if (form.querySelector(`[data-err-for="${i.id}"]`)?.textContent) errFor(i, '');
    });
  });
}

/** the same message as an email, for when there is no endpoint or it is down */
function mailto(f: Record<string, string>): string {
  const body = [
    `Name: ${f.name}`, `Email: ${f.email}`, `Company: ${f.company}`,
    `Team size: ${f.size}`, `About: ${f.topic}`, '', f.message ?? '',
  ].join('\n');
  return `mailto:${BRAND.email}?subject=${encodeURIComponent(`Demo request from ${f.company}`)}&body=${encodeURIComponent(body)}`;
}
