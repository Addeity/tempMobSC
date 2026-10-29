/*
 * The sheets answer the pointer: a faint light follows it across the card
 * under it (styles/pages.css draws it from --mx and --my). One listener for
 * the whole page, only for a mouse, and none with reduced motion, where the
 * light still comes up on hover but stays put.
 */
import { reduceMotion } from '../lib/motion.ts';

/** the same list styles/pages.css lights */
const SHEETS = '.plan:not(.plan--featured), .node:not(.node--opt, .node--off), .deploy__c, .tool, .info__c, .quote, .story, .person';

export function spotlight(): void {
  if (reduceMotion || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  addEventListener('pointermove', (e) => {
    const sheet = (e.target as Element | null)?.closest?.<HTMLElement>(SHEETS);
    if (!sheet) return;
    const r = sheet.getBoundingClientRect();
    sheet.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`);
    sheet.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
  }, { passive: true });
}
