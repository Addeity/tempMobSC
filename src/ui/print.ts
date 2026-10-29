/*
 * Two small affordances that are not about the ring.
 *
 * "Skip to content" goes to whatever is in front: the film, the not-found
 * notice, the heading of the section being read, or at the top, the list of
 * workflows (the keyboard's way into the ring). Without scripts it is a
 * plain link to <main>.
 *
 * On paper every answer is open: a closed one would print as its question
 * alone (styles/print.css does the rest).
 */
import { store } from '../lib/store.ts';

export function skipLink(): void {
  document.querySelector<HTMLAnchorElement>('[data-skip]')?.addEventListener('click', (e) => {
    const section = store.get().section;
    const target = (document.querySelector('.flow.is-open') ? document.querySelector<HTMLElement>('.flow__inner') : null)
      ?? document.querySelector<HTMLElement>('.route.is-open .route__h')
      ?? (section === 'home' ? document.getElementById('seo')
        : document.querySelector<HTMLElement>(`[data-section="${section}"] :is(.route__h, h2)`));
    if (!target) return;
    e.preventDefault();
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus();
  });
}

export function printReady(): void {
  addEventListener('beforeprint', () => {
    document.querySelectorAll<HTMLDetailsElement>('details:not([open])').forEach((d) => { d.open = true; d.dataset.printOpened = ''; });
  });
  addEventListener('afterprint', () => {
    document.querySelectorAll<HTMLDetailsElement>('details[data-print-opened]').forEach((d) => { d.open = false; delete d.dataset.printOpened; });
  });
}
