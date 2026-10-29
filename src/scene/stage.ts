/*
 * The WebGL layer: renderer, camera, the ring, the cage and the centrepiece,
 * and the input that drives them.
 *
 * Version 2 is one page, and the ring is its first stretch: the page's own
 * scroll through the intro (0 at the top, 1 where the tour takes over) turns
 * the ring, drifts its rows and bends the cards (mechanics after k95.it), so
 * the ring has a start and an end. Over the last part of it the ring opens:
 * the cards swing out past the camera and fade and the chrome ring draws
 * back, all but one card: the tour's first workflow turns to face the viewer
 * and comes forward, to be handed to the tour as it rises (src/ui/handover.ts
 * takes it from there into the tour's frame). Once the tour covers the ring,
 * nothing is drawn at all. The frame runs on
 * GSAP's ticker, so the scene and every DOM tween share one
 * requestAnimationFrame.
 */
import { WORKFLOWS } from '@site/content';
import {
  type BufferGeometry, Color, type Group, type LineBasicMaterial, type LineSegments, NoToneMapping,
  PerspectiveCamera, Quaternion, Raycaster, SRGBColorSpace, Scene, Texture, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { clamp, coarsePointer, easeOutExpo, gsap, reduceMotion } from '../lib/motion.ts';
import { smallScreen } from '../lib/media.ts';
import { presentRect } from '../lib/present.ts';
import { store, type Theme } from '../lib/store.ts';
import { VideoAtlas } from './atlas.ts';
import { createCentrepiece, disposeGroup, loadChrome } from './centrepiece.ts';
import { buildCage } from './environment.ts';
import { CardFaces, FACE, SCREEN } from './faces.ts';
import { layoutFor, type Layout } from './layout.ts';
import { GROUND, Ring, type Card, type Presenting } from './ring.ts';

export interface StageEvents {
  /** the card under the pointer (or the keyboard's selection) changed */
  onHover(card: Card | null): void;
  /** a card was clicked or tapped */
  onOpen(index: number, card: Card): void;
  /** the ring started or stopped moving under the user's hand */
  onMoving(moving: boolean): void;
}

/** elements the raycast cannot see: a pointer on them is not on the card behind */
const CHROME = 'a, button, .nav, .switch, .hero__cta, .foot, .flow, .route, .seo, .menu, .tour, .sec, .end';

/** the scene's colours in each theme: the ground it fades into, and the cage's lines */
const SCENE: Record<Theme, { ground: number; cage: number; cageAlpha: number }> = {
  dark: { ground: 0x05070c, cage: 0x5098f8, cageAlpha: 0.07 },
  light: { ground: 0xf2f3f6, cage: 0x1850e0, cageAlpha: 0.08 },
};

/** seconds the intro's first frame is held while the canvas fades in over the seed (--t-2) */
const INTRO_HOLD = 0.26;

/** where the ring starts opening, and where it has opened and its last card has come forward, as fractions of the intro's scroll
    (the tour's sheet starts to rise at 1 - 1/5.5 of it, styles/intro.css: a moment after) */
const OPEN_FROM = 0.7;
const OPEN_TO = 0.8;
/** the workflow whose card comes forward: the tour's first */
const PRESENTED = 0;
const _toward = new Vector3();
const _up = new Vector3();
const smoothstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/*
 * The ring's feel, read from k95.it's ThreeCylinderScene so the two turn
 * alike. Their per-frame lerps assume 60fps; `perFrame` below converts each
 * to the same feel at any refresh rate.
 */
const FEEL = {
  wheelScroll: 0.005,  // rows travel deltaY x this, in world units (the arrow keys)
  wheelSpin: 0.004,    // and the spin velocity gets deltaY x this...
  travel: 22,          // the rows travel this far over the whole intro, in world units (about four a screen)
  scrollSpin: 15,      // and the spin velocity gets the change in the intro's progress x this...
  spinMax: 2,          // ...clamped to +-2 rad/s
  idle: 0.08,          // rad/s with nobody touching it
  follow: 0.1,         // how fast the rows catch up with the scroll
  decay: 0.92,         // what is left of the spin velocity each frame
  hoverSpeed: 0.3,     // time scale while a card is under the pointer
  hoverEase: 0.1,      // how fast it slows down and comes back
  bendHMax: 0.25,      // the cards arch with spin...
  bendVMax: 0.15,      // ...and with scroll
  pickPause: 0.2,      // seconds without hover picking after a wheel tick
} as const;

/** a lerp factor tuned per 60fps frame, made independent of the refresh rate */
const perFrame = (f: number, dt: number) => 1 - Math.pow(1 - f, dt * 60);

/** hand the main thread back to the browser between heavy steps, so none of them holds up input */
const breathe = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/**
 * Waits, a frame at a time, for the GPU to finish what it has been sent.
 * Without it the next call that needs an answer from the GPU stalls the page
 * until every upload before it is done, which on a slow phone was the
 * longest single wait in the build.
 */
async function gpuDone(gl: WebGL2RenderingContext): Promise<void> {
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!sync) return;
  gl.flush();
  while (gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) await breathe();
  gl.deleteSync(sync);
}

/** the WebGL context, on its own step of the build: creating it with the scene that uses it came to one long task */
function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  // throws without WebGL; app.ts catches it and shows the list instead
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  // checking each program after it links waits on the GPU; worth it while working, not for visitors
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
  renderer.setClearColor(SCENE[store.get().theme].ground, 1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  return renderer;
}

/** each step of the build is measured, so a profile (or Lighthouse's user timings) shows where the time went */
async function measured<T>(name: string, work: () => T | Promise<T>): Promise<T> {
  const start = performance.now();
  try { return await work(); } finally { performance.measure(`stage: ${name}`, { start }); }
}

export class Stage {
  readonly atlas = new VideoAtlas();
  readonly faces = new CardFaces(WORKFLOWS);
  readonly camera = new PerspectiveCamera(50, 1, 0.1, 200);
  readonly ring: Ring;

  private readonly scene = new Scene();
  private chrome: Texture | null = null;

  /* adaptive resolution: a slow device spends fewer pixels rather than drop frames */
  private dpr = 1;
  private dprSet = false;
  private maxDpr = 1;
  private frameMs = 1000 / 60;
  private lastTune = 0;
  private calmSince = 0;
  private readonly ray = new Raycaster();
  private cage: LineSegments<BufferGeometry, LineBasicMaterial> | null = null;
  private centre: Group | null = null;
  private layout: Layout = layoutFor(innerWidth, innerHeight);

  /** where the scroll is heading, where the rows are, and where they were last frame */
  private scroll = { target: 0, current: 0, last: 0 };
  private spin = 0;
  private spinVel = 0;
  /** 1 normally, eases to FEEL.hoverSpeed while a card is hovered */
  private timeScale = 1;
  private lastWheel = -10;
  private bendH = 0;
  private bendV = 0;
  private time = 0;
  private introStart: number | null = null;
  private focusT = 0;
  private videoMix = 0;
  private movingSince = -10;
  private moving = false;
  /** the page's scroll through the intro, 0 to 1, and how far the ring has opened at its end */
  private progress = 0;
  private open = 0;
  /** anything of the ring on screen: when the tour covers it, nothing is drawn */
  private visible = true;
  /** the card coming forward at the end, where it goes, and how far the page's copy of it has taken over */
  private presented: Card | null = null;
  private readonly presentAt = { pos: new Vector3(), quat: new Quaternion() };
  private handoff = 0;
  private poster: { tex: Texture; aspect: number } | null = null;

  private readonly pointer = new Vector2(-2, -2);
  private readonly parallax = { x: 0, y: 0 };
  private overChrome = false;
  private downAt: { x: number; y: number } | null = null;
  private hovered: Card | null = null;
  private selected = 0;
  private keyboardActive = false;

  /**
   * Builds the scene a step at a time: the card faces, the cards, then the
   * shaders, compiled in parallel where the browser can. Each step yields
   * first, so the page stays responsive while the ring is assembled behind
   * the headline. The centrepiece's chrome decodes alongside; if it cannot
   * load, the ring turns round an empty centre.
   */
  static async create(canvas: HTMLCanvasElement, events: StageEvents): Promise<Stage> {
    const chrome = loadChrome().catch(() => null);
    const renderer = await measured('context', () => createRenderer(canvas));
    await breathe();
    const stage = await measured('scene', () => new Stage(renderer, events));
    await breathe();
    await measured('faces', () => stage.faces.draw(breathe));
    stage.chrome = await chrome;
    // sent to the GPU two at a time too, each pair finished before the next, rather than all in the first frame
    await measured('uploads', async () => {
      const gl = stage.renderer.getContext() as WebGL2RenderingContext;
      const textures = [...stage.faces.textures, ...(stage.chrome ? [stage.chrome] : [])];
      for (let i = 0; i < textures.length; i += 2) {
        textures.slice(i, i + 2).forEach((t) => stage.renderer.initTexture(t));
        await gpuDone(gl);
      }
    });
    await breathe();
    await measured('cards', () => stage.fit(breathe));
    await breathe();
    await measured('shaders', () => stage.renderer.compileAsync(stage.scene, stage.camera));
    await breathe();
    /* one frame drawn here, unseen (the canvas shows only once the ring
       is on): the first render sends every buffer to the GPU and binds every
       program, and left to the entrance's first frame it was a long task of
       its own, just as the cards begin to fly */
    await measured('first frame', () => stage.renderer.render(stage.scene, stage.camera));
    return stage;
  }

  private constructor(private readonly renderer: WebGLRenderer, private readonly events: StageEvents) {
    this.ring = new Ring(this.scene, this.faces, this.atlas);
    this.atlas.onTexture((t) => this.ring.setVideo(t));
    this.bindInput();
  }

  /* ------------------------------------------------------------ input */
  /** the ring takes a tap or a key only while it is the thing on screen, before it opens */
  private get live(): boolean {
    return this.visible && this.open < 0.25 && store.get().mode === 'grid' && store.get().section === 'home';
  }

  private bindInput(): void {
    addEventListener('pointermove', (e) => {
      this.setPointer(e);
      this.overChrome = !!(e.target instanceof Element && e.target.closest(CHROME));
      this.keyboardActive = false;
    }, { passive: true });
    addEventListener('pointerdown', (e) => {
      this.setPointer(e);
      this.downAt = { x: e.clientX, y: e.clientY };
    }, { passive: true });
    addEventListener('pointerup', (e) => {
      const start = this.downAt;
      this.downAt = null;
      if (!this.live) return;
      if (e.target instanceof Element && e.target.closest(CHROME)) return;
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) return;   // a drag, not a tap
      this.setPointer(e);
      const card = this.pick();
      if (card) this.events.onOpen(card.userData.wfIndex, card);
    });

    /* the cards are WebGL, so the arrows move a selection; Enter opens it */
    addEventListener('keydown', (e) => {
      if (!this.live || e.target !== document.body) return;
      const n = this.ring.cards.length;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        this.keyboardActive = true;
        this.selected = (this.selected + (e.key === 'ArrowRight' ? 1 : -1) + n) % n;
        const dy = e.key === 'ArrowRight' ? 80 : -80;   // as one notch of a wheel
        this.push(dy * FEEL.wheelScroll, dy * FEEL.wheelSpin);
      } else if (e.key === 'Enter') {
        const card = this.ring.cards[this.selected];
        if (card) this.events.onOpen(card.userData.wfIndex, card);
      }
    });
  }

  private setPointer(e: PointerEvent): void {
    this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  }

  /** the arrow keys nudge the ring as one notch of a wheel would */
  private push(scroll: number, spin: number): void {
    this.scroll.target -= scroll;
    this.spinVel = clamp(this.spinVel + spin, -FEEL.spinMax, FEEL.spinMax);
  }

  /**
   * The page's scroll through the intro, 0 to 1: scrolling down lifts the
   * rows and turns the ring, as on k95, and the rows ease after the scroll
   * rather than jump with it. Bounded both ways: the top is where the ring
   * starts, 1 is where it has opened and the tour has it.
   */
  setScroll(p: number): void {
    const dp = p - this.progress;
    if (dp === 0) return;
    this.progress = p;
    this.scroll.target = -p * FEEL.travel;
    this.spinVel = clamp(this.spinVel + dp * FEEL.scrollSpin, -FEEL.spinMax, FEEL.spinMax);
    this.lastWheel = this.time;
  }

  /** 0 to 1: how far the page's copy of the presented card has taken over from it (src/ui/handover.ts) */
  setHandoff(f: number): void { this.handoff = f; }

  /** the still the page's copy of the presented card shows, for the card's screen to turn to before the copy takes over */
  setPoster(img: HTMLImageElement): void {
    if (!img.naturalWidth) return;
    this.poster?.tex.dispose();
    const tex = new Texture(img);
    tex.needsUpdate = true;
    this.poster = { tex, aspect: img.naturalWidth / img.naturalHeight };
  }

  /** the tour covers the ring: stop drawing it (and start again when it is uncovered) */
  setVisible(on: boolean): void {
    this.visible = on;
    if (!on && this.moving) { this.moving = false; this.events.onMoving(false); }
  }

  /** the scene in the page's theme: the ground the cards fade into, the cage's lines, the clear colour; drawn at once */
  setTheme(theme: Theme): void {
    const c = SCENE[theme];
    GROUND.setHex(c.ground);
    this.renderer.setClearColor(c.ground, 1);
    if (this.cage) this.cage.material.color.setHex(c.cage);
    this.renderer.render(this.scene, this.camera);
  }

  private pick(): Card | null {
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = this.ray.intersectObjects(this.ring.cards, false)[0];
    return (hit?.object as Card | undefined) ?? null;
  }

  /* ----------------------------------------------------------- layout */
  resize(): void {
    this.sizeView();
    this.buildCage();
    this.ring.build(this.layout);
    this.buildCentre();
  }

  /** the first build's version of resize(), a part at a time with a turn for the browser between */
  private async fit(between: () => Promise<void>): Promise<void> {
    this.sizeView();
    await between();
    this.buildCage();
    await between();
    this.ring.build(this.layout);
    await between();
    this.buildCentre();
  }

  private sizeView(): void {
    this.layout = layoutFor(innerWidth, innerHeight);
    this.maxDpr = Math.min(devicePixelRatio || 1, smallScreen ? 1.5 : 1.75);
    // full resolution to begin with; after that, whatever tune() has settled on, within the new ceiling
    this.dpr = this.dprSet ? Math.min(this.dpr, this.maxDpr) : this.maxDpr;
    this.dprSet = true;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.fov = this.layout.fov;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  private buildCage(): void {
    if (this.cage) { this.scene.remove(this.cage); this.cage.geometry.dispose(); this.cage.material.dispose(); }
    this.cage = buildCage(innerHeight / Math.max(innerWidth, 1));
    this.cage.material.color = new Color(SCENE[store.get().theme].cage);
    this.scene.add(this.cage);
  }

  private buildCentre(): void {
    if (this.centre) { this.scene.remove(this.centre); disposeGroup(this.centre); }
    if (this.chrome) {
      this.centre = createCentrepiece(this.layout.radius, this.chrome);
      this.scene.add(this.centre);
    }
  }

  /*
   * Watches the frame time: below about 42fps for a second, drop a quarter
   * of the pixel ratio (never under 0.75); comfortably above 60fps for three
   * seconds, take a step back up. A tab switch or a stall is ignored.
   */
  private tune(rawDt: number): void {
    if (rawDt > 0.25) return;
    this.frameMs += (rawDt * 1000 - this.frameMs) * 0.1;
    if (this.frameMs >= 15) this.calmSince = this.time;
    if (this.time - this.lastTune < 1) return;
    this.lastTune = this.time;
    let next = this.dpr;
    if (this.frameMs > 24) next = Math.max(0.75, this.dpr - 0.25);
    else if (this.time - this.calmSince > 3) next = Math.min(this.maxDpr, this.dpr + 0.25);
    if (next !== this.dpr) { this.dpr = next; this.renderer.setPixelRatio(next); }
  }

  setSpiral(on: boolean): void { this.ring.setSpiral(on, this.time); }

  start(): void {
    gsap.ticker.add((_time, deltaMs) => this.step(deltaMs / 1000));
  }

  /* ------------------------------------------------------------ frame */
  step(rawDt: number): void {
    const dt = Math.min(rawDt, 0.05);
    const { mode, motionPaused } = store.get();
    this.focusT += ((mode === 'grid' ? 0 : 1) - this.focusT) * (1 - Math.exp(-7 * dt));

    /* Once a route or the player has faded over the ring, it is all but
       invisible: hold its last frame instead of spinning, uploading video and
       rendering underneath. Every frame of that work was being re-blended
       under the panel while it scrolled, which is what made pricing judder.
       The ring carries on from the same moment when the panel closes. */
    if (mode !== 'grid' && this.focusT > 0.995) return;
    // under the tour: nothing to see, nothing to draw
    if (!this.visible) return;

    this.time += dt;
    this.tune(rawDt);
    /* the intro holds its first frame while the canvas fades in over the
       seed it matches (styles/stage.css), then starts */
    if (this.introStart === null) this.introStart = this.time + (reduceMotion ? 0 : INTRO_HOLD);
    const introT = this.time - this.introStart;

    /* a card under the pointer slows the turn to 0.3 and lets it come back
       when the pointer leaves; the scroll itself is never slowed */
    const slow = this.hovered && !coarsePointer && !this.keyboardActive ? FEEL.hoverSpeed : 1;
    this.timeScale += (slow - this.timeScale) * perFrame(FEEL.hoverEase, dt);
    const n = dt * this.timeScale;

    this.scroll.current += (this.scroll.target - this.scroll.current) * perFrame(FEEL.follow, dt);
    const drift = this.scroll.current - this.scroll.last;
    this.scroll.last = this.scroll.current;

    this.spinVel *= Math.pow(FEEL.decay, n * 60);
    this.spin += ((reduceMotion || motionPaused ? 0 : FEEL.idle) + this.spinVel) * n;
    this.bendH += (clamp(this.spinVel * 0.1, -FEEL.bendHMax, FEEL.bendHMax) - this.bendH) * perFrame(0.08, dt);
    this.bendV += (clamp(drift * 8, -FEEL.bendVMax, FEEL.bendVMax) - this.bendV) * perFrame(0.12, dt);

    // the hero steps back while the ring is under the user's hand
    if (Math.abs(this.spinVel) > 0.05 || Math.abs(this.scroll.target - this.scroll.current) > 0.02) this.movingSince = this.time;
    const moving = this.time - this.movingSince < 0.9 && introT > 2.2;
    if (moving !== this.moving) { this.moving = moving; this.events.onMoving(moving); }

    /* the camera dollies in on load, leans after the pointer, and sits a
       little low so the ring rides above the hero */
    const camIntro = reduceMotion ? 1 : easeOutExpo(clamp(introT / 2.6, 0, 1));
    const lean = mode === 'grid' && !coarsePointer && !reduceMotion;
    const k = 1 - Math.exp(-2.4 * dt);
    this.parallax.x += ((lean ? clamp(this.pointer.x, -1, 1) : 0) - this.parallax.x) * k;
    this.parallax.y += ((lean ? clamp(this.pointer.y, -1, 1) : 0) - this.parallax.y) * k;
    /* the end of the intro: the ring opens, the cards parting round the view
       as the camera eases in a little, and the chrome ring draws back */
    this.open = reduceMotion ? 0 : smoothstep(OPEN_FROM, OPEN_TO, this.progress);
    const o = this.open;
    const { camZ, lift } = this.layout;
    this.camera.position.set(
      this.parallax.x * camZ * 0.035,
      this.parallax.y * camZ * 0.022 + (1 - camIntro) * 2.2 - lift,
      camZ + (1 - camIntro) * 8 - o * camZ * 0.08,
    );
    this.camera.lookAt(0, -lift * 1.25, 0);
    this.camera.updateMatrixWorld();

    if (this.cage) {
      this.cage.rotation.y = this.spin * 0.09;
      this.cage.material.opacity = SCENE[store.get().theme].cageAlpha * camIntro * (1 - this.focusT * 0.6) * (1 - o);
    }
    if (this.centre) {
      this.centre.rotation.y = -this.spin * 2;
      this.centre.rotation.x = 0.42 + Math.sin(this.time * 0.3) * (reduceMotion || motionPaused ? 0 : 0.06);
      this.centre.scale.setScalar((0.6 + 0.4 * (reduceMotion ? 1 : easeOutExpo(clamp((introT - 0.2) / 2, 0, 1)))) * (1 - o * 0.45));
      this.centre.position.z = -0.6 - o * 5;
    }

    // no hover picking while the ring is turning under the scroll, so cards do not flicker past
    let hit: Card | null = null;
    const scrolling = this.time - this.lastWheel < FEEL.pickPause;
    const live = mode === 'grid' && o < 0.25 && store.get().section === 'home';
    if (live && !coarsePointer && !this.overChrome && !scrolling && introT > 1.2) hit = this.pick();
    const keyboard = live && this.keyboardActive ? this.ring.cards[this.selected] ?? null : null;
    const shown = hit ?? keyboard;
    if (shown !== this.hovered) { this.hovered = shown; this.events.onHover(shown); }

    if (this.atlas.texture && this.videoMix < 1) this.videoMix = Math.min(1, this.videoMix + dt / 0.9);

    this.ring.update({
      time: this.time, dt, introT, drift, spin: this.spin, bendH: this.bendH, bendV: this.bendV,
      focusT: this.focusT, videoMix: this.videoMix, hit, keyboard, open: o, present: this.presenting(o),
    }, innerWidth < 768 || innerHeight > innerWidth);

    this.renderer.render(this.scene, this.camera);
    // the first frame is drawn: the canvas fades in over the stage's placeholder (stage.css)
    if (!this.shown) { this.shown = true; requestAnimationFrame(() => document.documentElement.classList.add('ring-on')); }
  }
  private shown = false;

  /**
   * The card that comes forward at the end, and where to: chosen as the ring
   * starts to open (the one of the tour's first workflow nearest the viewer)
   * and let go again if the scroll goes back up past that. It comes to face
   * the camera with its screen filling presentRect(), which the page's copy
   * of it starts from: the distance follows from that width and the field of
   * view, and the card sits a little lower than the point, by however far its
   * screen sits above its middle (the caption is under it).
   */
  private presenting(o: number): Presenting | null {
    if (reduceMotion || this.progress < OPEN_FROM - 0.04) { this.presented = null; return null; }
    if (this.progress < OPEN_FROM - 0.01 && !this.presented) return null;
    this.presented ??= this.ring.nearestOf(PRESENTED, this.camera);
    if (!this.presented) return null;
    const w = innerWidth, h = innerHeight;
    const r = presentRect(w, h);
    const cam = this.camera;
    _toward.set(((r.x + r.w / 2) / w) * 2 - 1, 1 - ((r.y + r.h / 2) / h) * 2, 0.5).unproject(cam).sub(cam.position).normalize();
    const forward = _up.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const screenW = this.layout.panelW * (SCREEN.width / FACE.width);
    const depth = (screenW * h) / (2 * Math.tan((cam.fov * Math.PI) / 360) * r.w);
    const at = this.presentAt.pos.copy(cam.position).addScaledVector(_toward, depth / Math.max(0.2, _toward.dot(forward)));
    const above = (0.5 - (SCREEN.y + SCREEN.height / 2) / FACE.height) * (this.layout.panelW * FACE.height / FACE.width);
    at.addScaledVector(_up.set(0, 1, 0).applyQuaternion(cam.quaternion), -above);
    this.presentAt.quat.copy(cam.quaternion);
    return { card: this.presented, t: o, pos: at, quat: this.presentAt.quat, fade: this.handoff, poster: this.poster };
  }

  /* --------------------------------------------------------- queries */
  cardRect(card: Card): DOMRect | null { return this.ring.screenRect(card, this.camera, innerWidth, innerHeight); }
  frontCard(i?: number): Card | null { return this.ring.frontMost(this.camera, i); }

  /** for a test harness in a background tab, where rAF does not fire */
  debug() {
    return {
      tick: (n = 60) => { for (let i = 0; i < n; i++) this.step(1 / 60); },
      settle: () => { this.introStart = this.time - 10; },
      wheel: (deltaY: number) => { this.push(deltaY * FEEL.wheelScroll, deltaY * FEEL.wheelSpin); this.lastWheel = this.time; },
      scroll: (p: number) => this.setScroll(p),
      state: () => ({
        time: +this.time.toFixed(2), spin: +this.spin.toFixed(3), spinVel: +this.spinVel.toFixed(3),
        progress: +this.progress.toFixed(3), open: +this.open.toFixed(3), visible: this.visible,
        timeScale: +this.timeScale.toFixed(3), scroll: +this.scroll.current.toFixed(3), spiral: this.ring.spiral,
        videoMix: this.videoMix, video: { t: +this.atlas.video.currentTime.toFixed(2), ready: this.atlas.video.readyState },
        hovered: this.hovered?.userData.slot ?? null,
        lt: this.ring.cards.slice(0, 3).map((c) => +c.userData.lt.toFixed(3)),
      }),
      front: () => {
        const c = this.frontCard();
        if (!c) return null;
        const r = this.cardRect(c);
        return { key: WORKFLOWS[c.userData.wfIndex]!.key, x: r ? r.x + r.width / 2 : 0, y: r ? r.y + r.height / 2 : 0 };
      },
    };
  }
}

