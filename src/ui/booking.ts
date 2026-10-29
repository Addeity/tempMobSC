/*
 * The demo scheduler, behind "Prefer to pick a time?" on the contact page
 * while SERVICES.demo is on and no real booking link is set (with one, the
 * card simply links to it). The next ten working days, half-hour slots from
 * nine to five in the visitor's own time zone, a few already taken so it
 * reads like a real calendar; a booking goes to the local stand-in
 * (build/demo.ts) and shows in its inbox.
 *
 * A native <dialog>: the browser holds focus inside it, closes it on Escape
 * and puts the page behind it out of reach.
 */
import { DEMO_API } from '@site/content';
import { track } from '../lib/analytics.ts';
import { byId } from '../lib/dom.ts';
import { DUR, EASE_IN, EASE_OUT, gsap, reduceMotion } from '../lib/motion.ts';

const DAYS = 10;
const FIRST = 9 * 60;   // 09:00
const LAST = 16 * 60 + 30;   // the last slot starts at 16:30
const STEP = 30;

/** some slots are already gone, the same ones every time, so it looks like a calendar people use */
const taken = (day: number, slot: number) => (day * 7 + slot * 3) % 5 === 0;

function workingDays(): Date[] {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (out.length < DAYS) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(new Date(d));
  }
  return out;
}

/** the visitor's zone as people say it ("Nepal Time"), not as a computer files it:
    Chrome reports Nepal as "Asia/Katmandu", a spelling the time zone database has since replaced */
function zoneName(tz: string): string {
  // the generic name holds across a daylight-saving change inside the fortnight; older browsers know only the long one
  for (const timeZoneName of ['longGeneric', 'long'] as const) {
    try {
      const name = new Intl.DateTimeFormat(undefined, { timeZoneName }).formatToParts().find((p) => p.type === 'timeZoneName')?.value;
      if (name) return name;
    } catch { /* a browser without this style */ }
  }
  return tz.replace(/_/g, ' ');
}

export function bookingDialog(): void {
  const opener = document.querySelector<HTMLButtonElement>('[data-book]');
  const dialog = document.getElementById('book') as HTMLDialogElement | null;
  if (!opener || !dialog || typeof dialog.showModal !== 'function') return;

  const form = byId<HTMLFormElement>('bookForm');
  const daysEl = byId('bookDays');
  const timesEl = byId('bookTimes');
  const msg = byId('bookMsg');
  const done = byId('bookDone');
  /* the calendar's formats, made the first time it opens: the first date
     format a page makes loads the browser's locale data, a long task on a
     phone, and most visits never open the scheduler at all */
  let fmt: { tz: string; zone: string; day: Intl.DateTimeFormat; time: Intl.DateTimeFormat; long: Intl.DateTimeFormat } | null = null;
  const formats = () => {
    if (fmt) return fmt;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fmt = {
      tz, zone: zoneName(tz),
      day: new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
      time: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }),
      long: new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
    };
    byId('bookTz').textContent = `your time zone (${fmt.zone})`;
    return fmt;
  };

  let days: Date[] = [];
  let sending = false;

  const radio = (name: string, value: string, label: string, disabled = false, checked = false) =>
    `<label class="book__opt${disabled ? ' is-gone' : ''}"><input type="radio" name="${name}" value="${value}"${disabled ? ' disabled' : ''}${checked ? ' checked' : ''} /><span>${label}</span></label>`;

  function showTimes(dayIndex: number): void {
    const day = days[dayIndex]!;
    const slots: string[] = [];
    for (let m = FIRST, i = 0; m <= LAST; m += STEP, i++) {
      const at = new Date(day);
      at.setMinutes(m);
      const gone = taken(dayIndex, i);
      slots.push(radio('time', at.toISOString(), formats().time.format(at), gone));
    }
    timesEl.innerHTML = slots.join('');
  }

  function open(): void {
    days = workingDays();
    daysEl.innerHTML = days.map((d, i) => {
      const [wd, ...rest] = formats().day.format(d).replace(',', '').split(' ');
      return radio('day', String(i), `<b>${wd}</b> ${rest.join(' ')}`, false, i === 0);
    }).join('');
    showTimes(0);
    form.hidden = false;
    done.hidden = true;
    msg.textContent = '';
    msg.classList.remove('is-err');
    dialog!.showModal();
    if (!reduceMotion) gsap.fromTo(dialog, { opacity: 0, y: 14, scale: 0.985 }, { opacity: 1, y: 0, scale: 1, duration: DUR.panel, ease: EASE_OUT, clearProps: 'opacity,transform' });
  }

  function close(): void {
    if (!dialog!.open) return;
    if (reduceMotion) { dialog!.close(); return; }
    gsap.to(dialog, { opacity: 0, y: 8, duration: DUR.ui, ease: EASE_IN, onComplete: () => { dialog!.close(); gsap.set(dialog, { clearProps: 'opacity,transform' }); } });
  }

  opener.addEventListener('click', open);
  dialog.addEventListener('click', (e) => {
    // a click on the backdrop (the dialog box itself, outside its content) closes it, as does a close button
    if (e.target === dialog || (e.target as Element).closest('[data-book-close]')) close();
  });
  // Escape is the dialog's own; it must not also close the contact panel behind it
  dialog.addEventListener('keydown', (e) => { if (e.key === 'Escape') e.stopPropagation(); });
  dialog.addEventListener('close', () => opener.focus({ preventScroll: true }));
  // a new pick clears the last complaint
  form.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.name === 'day') showTimes(Number(input.value));
    if (msg.classList.contains('is-err')) { msg.textContent = ''; msg.classList.remove('is-err'); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const data = new FormData(form);
    const start = String(data.get('time') ?? '');
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const problem = !start ? 'Pick a time first.'
      : !name ? 'Please tell us your name.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? 'That email does not look right.' : '';
    msg.classList.toggle('is-err', !!problem);
    msg.textContent = problem;
    if (problem) {
      (!start ? timesEl.querySelector<HTMLInputElement>('input:not([disabled])') : !name ? byId('b-name') : byId('b-email'))?.focus();
      return;
    }

    const { long, zone, tz } = formats();
    const when = long.format(new Date(start));
    sending = true;
    msg.textContent = 'Booking.';
    try {
      const res = await fetch(`${DEMO_API}/booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, email, start, when, zone, timezone: tz }),
      });
      if (!res.ok) throw new Error(String(res.status));
      byId('bookWhen').textContent = `${when}, ${zone}`;
      form.hidden = true;
      done.hidden = false;
      byId('bookDoneTitle').focus();
      form.reset();
      track('Demo request', { via: 'booking' });
    } catch {
      msg.classList.add('is-err');
      msg.textContent = 'That did not go through. Try again, or use the form instead.';
    } finally {
      sending = false;
    }
  });
}
