/*
 * The ring's controls: the split-flap nav, the Rings / Spiral switch, the
 * hover label and cursor, the footer's counter and its motion control.
 */
import { WORKFLOWS } from '@site/content';
import { byId, pad2, prefs } from '../lib/dom.ts';
import { DUR, EASE_OUT, SPRING_SOFT, gsap, reduceMotion } from '../lib/motion.ts';
import { store } from '../lib/store.ts';

const N = WORKFLOWS.length;

/** each character becomes two stacked copies in a clipped box, for the hover roll */
export function splitFlap(): void {
  document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
    const text = el.textContent ?? '';
    el.textContent = '';
    const word = document.createElement('span');
    word.className = 'sr';
    word.textContent = text;
    el.appendChild(word);
    [...text].forEach((ch, i) => {
      const wrap = document.createElement('span');
      wrap.className = 'ch';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.style.setProperty('--i', String(i));
      if (ch === ' ') {
        wrap.innerHTML = '<span class="ch__sp">&nbsp;</span>';
      } else {
        const top = document.createElement('span'); top.className = 'ch__top'; top.textContent = ch;
        const bot = document.createElement('span'); bot.className = 'ch__bot'; bot.textContent = ch;
        wrap.append(top, bot);
      }
      el.appendChild(wrap);
    });
  });
}

export function layoutSwitch(onChange: (spiral: boolean) => void): void {
  const root = byId('layoutSwitch');
  const pill = root.querySelector<HTMLElement>('.switch__pill')!;
  const place = (btn: HTMLElement, animate: boolean) => {
    gsap.to(pill, { x: btn.offsetLeft, width: btn.offsetWidth, duration: animate && !reduceMotion ? DUR.panel : 0, ease: SPRING_SOFT });
  };
  root.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLElement>('.switch__btn');
    if (!btn) return;
    root.querySelectorAll('.switch__btn').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    place(btn, true);
    onChange(btn.dataset.layout === 'spiral');
  });
  const sync = () => place(root.querySelector<HTMLElement>('.switch__btn.is-active')!, false);
  sync();
  document.fonts?.ready.then(sync);
  addEventListener('resize', sync);
}

/** the label and the cursor trail the pointer on quickTo springs */
export function pointerChrome() {
  const cursor = byId('cursor');
  const label = byId('label');
  const pills = label.querySelectorAll<HTMLElement>('.label__pill');
  const cx = gsap.quickTo(cursor, 'x', { duration: DUR.micro, ease: EASE_OUT });
  const cy = gsap.quickTo(cursor, 'y', { duration: DUR.micro, ease: EASE_OUT });
  const lx = gsap.quickTo(label, 'x', { duration: DUR.panel, ease: EASE_OUT });
  const ly = gsap.quickTo(label, 'y', { duration: DUR.panel, ease: EASE_OUT });

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') cursor.classList.add('is-on');
    cx(e.clientX); cy(e.clientY);
    // keep the pills out of the top strip and off the footer
    lx(Math.min(Math.max(e.clientX, 8), innerWidth - 260));
    ly(Math.min(Math.max(e.clientY, 132), innerHeight - 110));
  }, { passive: true });

  return {
    show(title: string | null, category = '') {
      const on = !!title && store.get().mode === 'grid' && innerWidth > 900;
      if (title) {
        byId('labelTitle').textContent = title;
        byId('labelCat').textContent = category;
      }
      pills.forEach((p) => p.classList.toggle('is-visible', on));
      cursor.classList.toggle('is-hovering', !!title);
    },
  };
}

export function footerCounter(index: number): void {
  byId('footSel').textContent = `${pad2(index + 1)} / ${pad2(N)}`;
}

/**
 * WCAG 2.2.2: a control that stops everything that moves on its own (the
 * ring, its screens, the footer's liquid); remembered per viewer. The home
 * view's bar and every footer band carry one, and they all say the same.
 */
export function motionToggle(): void {
  const btns = [...document.querySelectorAll<HTMLButtonElement>('#motionToggle, [data-motion-toggle]')];
  const apply = (paused: boolean) => {
    for (const btn of btns) {
      btn.setAttribute('aria-pressed', String(paused));
      btn.querySelector('.foot__pause-t')!.textContent = paused ? 'Resume motion' : 'Pause motion';
    }
    // what moves in CSS alone (the map's wires) is held by a class
    document.documentElement.classList.toggle('is-paused', paused);
    store.set({ motionPaused: paused });
  };
  const stored = prefs.get('motion');
  apply(stored ? stored === 'paused' : reduceMotion);
  for (const btn of btns) {
    btn.addEventListener('click', () => {
      const paused = !store.get().motionPaused;
      apply(paused);
      prefs.set('motion', paused ? 'paused' : 'on');
    });
  }
}
