/** an element the page cannot work without: fails loudly if the markup lost it */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing from index.html`);
  return el as T;
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

/** read and write a per-viewer preference; private windows can throw, so never trust it */
export const prefs = {
  get(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* not remembered, still works */ }
  },
};
