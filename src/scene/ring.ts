/*
 * The ring: 5 rows x 12 slots of cards on a cylinder, wrapping as they drift.
 *
 * Rings and Spiral are two (angle, height) pairs over the same cards. Each
 * card owns an interpolation value `lt` (0 rings, 1 spiral); a switch records
 * where every card is and starts a staggered ease round the ring, and the
 * card's angle, height and a slight outward swell are derived from `lt`
 * every frame, so switching mid-morph simply turns round. On load the cards
 * fly out from the axis along the same path, unwinding as they come; at the
 * end of the intro they swing out past the camera and fade (`open`), all but
 * one: the card of the tour's first workflow turns to face the viewer and
 * comes forward (`present`), to be handed to the tour (src/ui/handover.ts).
 */
import { WORKFLOWS } from '@site/content';
import {
  Color, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, type PerspectiveCamera, Quaternion,
  type Raycaster, type Intersection, type Object3D, type Scene, type ShaderMaterial, type Texture, Vector3,
} from 'three';
import { clamp, easeInOutCubic, easeOutExpo, reduceMotion } from '../lib/motion.ts';
import type { VideoAtlas } from './atlas.ts';
import { createCardMaterial } from './cardMaterial.ts';
import { CARD_ASPECT, FACE, SCREEN, type CardFaces } from './faces.ts';
import { ROWS, SLOTS, type Layout } from './layout.ts';

const N = WORKFLOWS.length;
const MORPH = 1.15;
/** the ground the far cards fade into; every card shares this one colour, so the theme changes it in place (stage.ts) */
export const GROUND = new Color(0x05070c);
const LIFT = 0.38;   // matches pos.z += uHover * 0.38 in card.vert.glsl

export interface CardData {
  wfIndex: number;
  slot: number;
  thetaRing: number;
  thetaSpiral: number;
  ySpiral: number;
  lt: number;
  ltFrom: number;
  morphDelay: number;
  introDelay: number;
  hover: number;
  dim: number;
  scale: number;
}
export type Card = Mesh<PlaneGeometry, ShaderMaterial> & { userData: CardData };

export interface RingFrame {
  time: number;
  dt: number;
  introT: number;
  /** how far the rows travel this frame, in world units */
  drift: number;
  spin: number;
  bendH: number;
  bendV: number;
  focusT: number;
  videoMix: number;
  hit: Card | null;
  keyboard: Card | null;
  /** 0 to 1: how far the ring has opened at the end of the intro */
  open: number;
  /** the card coming forward at the end of the intro, where it is going (in the world), and how far it has come */
  present: Presenting | null;
}

export interface Presenting {
  card: Card;
  /** 0 to 1: from its place on the ring to facing the viewer */
  t: number;
  pos: Vector3;
  quat: Quaternion;
  /** 0 to 1: how far the page's copy of it has taken over (the card itself fades out as it does) */
  fade: number;
  /** the still the page's copy shows (src/ui/handover.ts), which the card's screen turns to on its way */
  poster: { tex: Texture; aspect: number } | null;
}

const _v = new Vector3();
const _local = new Vector3();
const _ringQ = new Quaternion();
const _faceQ = new Quaternion();

export class Ring {
  readonly rows: Group[] = [];
  readonly cards: Card[] = [];
  spiral = false;
  private morphStart = -10;
  private layout!: Layout;
  private panelW = 2.6;
  private panelH = 2.6 / CARD_ASPECT;
  private geo: PlaneGeometry | null = null;
  private hitGeo: PlaneGeometry | null = null;
  private readonly hitMat = new MeshBasicMaterial({ side: DoubleSide });

  constructor(
    private readonly scene: Scene,
    private readonly faces: CardFaces,
    private readonly atlas: VideoAtlas,
  ) {}

  build(layout: Layout): void {
    this.dispose();
    this.layout = layout;
    this.panelW = layout.panelW;
    this.panelH = layout.panelW / CARD_ASPECT;
    const geo = (this.geo = new PlaneGeometry(this.panelW, this.panelH, 20, 14));
    const hitGeo = (this.hitGeo = new PlaneGeometry(this.panelW, this.panelH));
    const near = Math.max(0.5, layout.camZ - layout.radius);
    const far = layout.camZ + layout.radius;

    for (let r = 0; r < ROWS; r++) {
      const group = new Group();
      for (let s = 0; s < SLOTS; s++) {
        // each row is the twelve shifted by five, so no column repeats
        const idx = (s + r * 5) % N;
        const material = createCardMaterial({
          face: this.faces.textures[idx]!,
          video: this.atlas.texture ?? this.atlas.blank,
          cell: this.atlas.cellUV(idx),
          depthNear: near,
          depthFar: far,
          depthColor: GROUND,
        });
        const card = new Mesh(geo, material) as Card;
        card.frustumCulled = false;
        // hit-test a one-quad stand-in rather than the 560-triangle card
        const proxy = new Mesh(hitGeo, this.hitMat);
        card.raycast = function (this: Card, rc: Raycaster, out: Intersection<Object3D>[]) {
          proxy.matrixWorld.copy(this.matrixWorld);
          const before = out.length;
          Mesh.prototype.raycast.call(proxy, rc, out);
          for (let k = before; k < out.length; k++) out[k]!.object = this;
        };
        const ring = Math.abs(r - (ROWS - 1) / 2);
        const lt = this.spiral ? 1 : 0;
        card.userData = {
          wfIndex: idx,
          slot: r * SLOTS + s,
          thetaRing: ((s + r * 0.5) / SLOTS) * Math.PI * 2,
          thetaSpiral: (s / SLOTS) * Math.PI * 2,
          ySpiral: (s / SLOTS - 0.5) * layout.rowSpacing,
          lt, ltFrom: lt,
          morphDelay: (s / SLOTS) * 0.38 + ring * 0.07,
          introDelay: 0.15 + (s / SLOTS) * 0.6 + ring * 0.14,
          hover: 0, dim: 0, scale: 1,
        };
        group.add(card);
        this.cards.push(card);
      }
      group.position.y = r * layout.rowSpacing - ((ROWS - 1) * layout.rowSpacing) / 2;
      this.rows.push(group);
      this.scene.add(group);
    }
  }

  setVideo(tex: Texture): void {
    for (const c of this.cards) c.material.uniforms.uVideo!.value = tex;
  }

  setSpiral(on: boolean, time: number): void {
    if (on === this.spiral) return;
    this.spiral = on;
    for (const c of this.cards) c.userData.ltFrom = c.userData.lt;
    this.morphStart = time;
  }

  private place(card: Card, intro: number, compact: boolean, open: number): void {
    const u = card.userData;
    const { radius } = this.layout;
    let theta = u.thetaRing + (u.thetaSpiral - u.thetaRing) * u.lt;
    let y = u.ySpiral * (compact ? 0.55 : 1) * u.lt;
    // opening, the ring widens and its cards turn on a little further, each a touch later round the ring
    let r = radius * (1 + 0.08 * Math.sin(Math.PI * u.lt) + open * open * 1.5);
    theta += open * (0.5 + 0.25 * Math.sin(u.slot));
    if (intro < 1) {
      theta -= (1 - intro) * 1.5;
      r *= 0.12 + 0.88 * intro;
      y *= intro;
    }
    card.position.set(Math.cos(theta) * r, y, Math.sin(theta) * r);
    // all three: a card that was presented comes back square to the ring
    card.rotation.set(0, Math.PI / 2 - theta, 0);
  }

  update(f: RingFrame, compact: boolean): void {
    const { rowSpacing } = this.layout;
    const wrap = ROWS * rowSpacing;
    for (const g of this.rows) {
      g.position.y -= f.drift;
      if (g.position.y > wrap / 2 + rowSpacing) g.position.y -= wrap;
      if (g.position.y < -wrap / 2 - rowSpacing) g.position.y += wrap;
      g.rotation.y = f.spin;
    }

    const smooth = 1 - Math.exp(-9 * f.dt);
    const target = this.spiral ? 1 : 0;
    for (const card of this.cards) {
      const u = card.userData;
      if (u.lt !== target) {
        const p = reduceMotion ? 1 : clamp((f.time - this.morphStart - u.morphDelay) / MORPH, 0, 1);
        u.lt = p >= 1 ? target : u.ltFrom + (target - u.ltFrom) * easeInOutCubic(p);
      }
      const e = reduceMotion ? 1 : clamp((f.introT - u.introDelay) / 1.9, 0, 1);
      const ease = easeOutExpo(e);
      this.place(card, ease, compact, f.open);

      const hot = f.hit === card || (!f.hit && f.keyboard === card);
      u.hover += ((hot ? 1 : 0) - u.hover) * smooth;
      u.dim += ((f.hit && f.hit !== card ? 1 : 0) - u.dim) * smooth;
      u.scale += ((hot ? 1.05 : 1) - u.scale) * smooth;
      card.scale.setScalar(u.scale);

      const m = card.material.uniforms;
      m.uScale!.value = 0.7 + 0.3 * ease;
      m.uBlur!.value = 0.018 * (1 - ease);
      m.uOpacity!.value = Math.min(1, e * 1.6) * (1 - f.focusT * 0.9) * Math.pow(1 - f.open, 1.4);
      m.uPosterMix!.value = 0;
      m.uHover!.value = u.hover;
      m.uDim!.value = u.dim;
      m.uVideoMix!.value = f.videoMix;
      m.uBendH!.value = f.bendH;
      m.uBendV!.value = f.bendV;
      m.uTime!.value = f.time;
    }
    if (f.present && f.present.t > 0) this.bringForward(f.present);
  }

  /**
   * The presented card, eased from where the ring put it this frame to where
   * it faces the viewer: both in its row's terms, since the row has moved and
   * turned under it. It keeps its full brightness as the others fade, its
   * screen turns from the film to the still the page's copy of it shows
   * while it is still on its way (a change made in motion is not seen as
   * one), and it gives way to that copy as the copy takes over: the same
   * picture, in the same place.
   */
  private bringForward(p: Presenting): void {
    const card = p.card;
    const row = card.parent!;
    row.updateMatrixWorld();
    const t = easeInOutCubic(p.t);
    _local.copy(p.pos);
    row.worldToLocal(_local);
    card.position.lerp(_local, t);
    _ringQ.copy(card.quaternion);
    row.getWorldQuaternion(_faceQ).invert().multiply(p.quat);
    card.quaternion.slerpQuaternions(_ringQ, _faceQ, t);
    card.scale.setScalar(1);
    const m = card.material.uniforms;
    const opacity = m.uOpacity!.value as number;
    m.uOpacity!.value = (opacity + (1 - opacity) * t) * (1 - p.fade);
    m.uBendH!.value = (m.uBendH!.value as number) * (1 - t);
    m.uBendV!.value = (m.uBendV!.value as number) * (1 - t);
    m.uHover!.value = 0;
    m.uDim!.value = 0;
    if (p.poster) {
      m.uPoster!.value = p.poster.tex;
      m.uPosterAspect!.value = p.poster.aspect;
      m.uPosterMix!.value = clamp((t - 0.3) / 0.5, 0, 1);
    }
  }

  /** the card of workflow i best placed to come forward: in front of the camera and nearest the middle of the view */
  nearestOf(i: number, camera: PerspectiveCamera): Card | null {
    let best: Card | null = null;
    let score = -Infinity;
    for (const c of this.cards) {
      if (c.userData.wfIndex !== i) continue;
      c.getWorldPosition(_v);
      const z = _v.z;
      _v.project(camera);
      const s = z - Math.abs(_v.y) * 6 - Math.abs(_v.x) * 3 - (_v.z > 1 ? 50 : 0);
      if (s > score) { score = s; best = c; }
    }
    return best;
  }

  /** where a card's screen is on the page right now, for the player to grow from */
  screenRect(card: Card, camera: PerspectiveCamera, w: number, h: number): DOMRect | null {
    const xs = [SCREEN.x, SCREEN.x + SCREEN.width];
    const ys = [SCREEN.y, SCREEN.y + SCREEN.height];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const fx of xs) for (const fy of ys) {
      _v.set((fx / FACE.width - 0.5) * this.panelW, (0.5 - fy / FACE.height) * this.panelH, card.userData.hover * LIFT);
      card.localToWorld(_v).project(camera);
      const x = (_v.x * 0.5 + 0.5) * w;
      const y = (-_v.y * 0.5 + 0.5) * h;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    if (!Number.isFinite(x0) || x1 - x0 < 8) return null;
    return new DOMRect(x0, y0, x1 - x0, y1 - y0);
  }

  /** the nearest card on screen showing workflow i, or the nearest of all */
  frontMost(camera: PerspectiveCamera, i?: number): Card | null {
    let best: Card | null = null;
    let bz = -Infinity;
    for (const c of this.cards) {
      if (i !== undefined && c.userData.wfIndex !== i) continue;
      c.getWorldPosition(_v);
      const z = _v.z;
      _v.project(camera);
      if (_v.x < -0.9 || _v.x > 0.9 || _v.y < -0.8 || _v.y > 0.8) continue;
      if (z > bz) { bz = z; best = c; }
    }
    return best;
  }

  dispose(): void {
    for (const g of this.rows) {
      this.scene.remove(g);
      for (const c of g.children as Card[]) c.material.dispose();
      g.clear();
    }
    this.rows.length = 0;
    this.cards.length = 0;
    this.geo?.dispose();
    this.hitGeo?.dispose();
  }
}
