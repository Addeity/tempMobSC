/*
 * The little shared state the page has, and who hears when it changes.
 * The scene reads it every frame; the interface subscribes.
 *
 * Version 2 is one page, so there is no panel open over the ring any more:
 * `section` is whichever part of the page is in view, and only a film or the
 * not-found notice is ever laid over it.
 */
export type Section = 'home' | 'workflows' | 'platform' | 'customers' | 'pricing' | 'company' | 'contact';
/** grid: the page is free; focus: a film is open over it; route: the legal page or the not-found notice is */
export type Mode = 'grid' | 'focus' | 'route';
export type Theme = 'dark' | 'light';

export interface State {
  mode: Mode;
  section: Section;
  /** the address matched nothing: the not-found notice is up */
  missing: boolean;
  /** the legal page is open: '' on its overview, otherwise the document's id; null when closed */
  doc: string | null;
  motionPaused: boolean;
  /** the workflow open in the player, -1 when it is closed */
  flowIndex: number;
  /** some of the ring is on screen: the intro, or the tour still rising over it */
  ringInView: boolean;
  theme: Theme;
}

type Listener = (state: State, prev: State) => void;

const listeners = new Set<Listener>();
let state: State = {
  // nothing is in view until the scroll has been read once (src/app.ts)
  mode: 'grid', section: 'home', missing: false, doc: null, motionPaused: false, flowIndex: -1, ringInView: false,
  theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
};

export const store = {
  get: (): State => state,
  set(patch: Partial<State>): void {
    const prev = state;
    state = { ...state, ...patch };
    // the ring and the page take the pointer only when nothing is laid over them
    state.mode = state.flowIndex >= 0 ? 'focus' : state.missing || state.doc !== null ? 'route' : 'grid';
    listeners.forEach((fn) => fn(state, prev));
  },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
