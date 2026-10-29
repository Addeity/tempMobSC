/*
 * The card atlas: one <video> and one texture shared by every card, each
 * card sampling its own cell (see ATLAS in @site/content).
 *
 * The cards never wait on the video. A still of its first frame (about
 * 30 kB) is fetched first and shown at once; the video takes over on its
 * own first frame, which is the same picture, so the change cannot be seen.
 * Which video, if any, is decided when the scene is built, from the
 * visitor's screen and measured connection (src/lib/media.ts): on a slow
 * connection the cards keep the still and the video is never fetched.
 *
 * Chrome treats a video loaded from file:// as cross-origin, and uploading
 * a tainted frame to WebGL throws. So the first frame is test-drawn into a
 * 2D canvas: if it cannot be read back, the cards keep the still and the
 * player, plain DOM video, still works.
 */
import { ATLAS, MEDIA } from '@site/content';
import {
  CanvasTexture, ImageBitmapLoader, LinearFilter, SRGBColorSpace, Texture, Vector4, VideoTexture,
} from 'three';
import { atlasSize, mediaUrl } from '../lib/media.ts';

/* the cells' inset is measured on the half-size grid, the smallest any texture here is */
const SMALL_W = ATLAS.cols * ATLAS.cellWidth / 2;
const SMALL_H = ATLAS.rows * ATLAS.cellHeight / 2;

/** can WebGL use this video's frames? Only one from another origin, without CORS, can say no */
function readable(v: HTMLVideoElement): boolean {
  /* served from this site, it is readable by definition: and the test below
     reads a pixel back off the GPU, a stall of tens of milliseconds on a phone */
  if (new URL(v.currentSrc || v.src, location.href).origin === location.origin) return true;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const g = c.getContext('2d')!;
    g.drawImage(v, 0, 0, 2, 2);
    g.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

export class VideoAtlas {
  readonly video: HTMLVideoElement;
  /** a 1x1 stand-in so the sampler is never unbound before anything arrives */
  readonly blank: Texture;
  /** what the cards show now: the still, then the video once it has a frame */
  texture: Texture | null = null;
  private still: ImageBitmap | null = null;
  private playing = false;
  private listeners: Array<(t: Texture) => void> = [];

  constructor() {
    const v = (this.video = document.createElement('video'));
    v.muted = v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');

    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0d121c';
    g.fillRect(0, 0, 1, 1);
    this.blank = new CanvasTexture(c);
    this.blank.colorSpace = SRGBColorSpace;

    // the still, flipped while decoding to match the video texture's orientation
    new ImageBitmapLoader().setOptions({ imageOrientation: 'flipY' }).loadAsync(mediaUrl(MEDIA.atlasStill)).then((bitmap) => {
      this.still = bitmap;
      if (this.texture) return;   // the video beat it
      const t = new Texture(bitmap);
      t.flipY = false;
      t.colorSpace = SRGBColorSpace;
      t.minFilter = t.magFilter = LinearFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      this.show(t);
    }, () => { /* no still: the cards keep their drawn placeholders until the video */ });

    const size = atlasSize();
    if (size === 'still') return;
    v.addEventListener('loadeddata', () => {
      if (!readable(v)) {
        document.documentElement.classList.add('video-tainted');
        return;
      }
      const t = new VideoTexture(v);
      t.colorSpace = SRGBColorSpace;
      t.minFilter = t.magFilter = LinearFilter;
      t.generateMipmaps = false;
      this.show(t);
    }, { once: true });
    v.src = mediaUrl(MEDIA.atlas(size === 'small'));
    if (this.playing) this.setPlaying(true);
  }

  private show(t: Texture): void {
    this.texture = t;
    this.listeners.forEach((fn) => fn(t));
  }

  /** called with the cards' texture now and whenever it changes (still, then video) */
  onTexture(fn: (t: Texture) => void): void {
    this.listeners.push(fn);
    if (this.texture) fn(this.texture);
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    if (!this.video.src) return;
    if (on) this.video.play().catch(() => { /* autoplay refused; the cards keep their last frame */ });
    else this.video.pause();
  }

  /** a cell in UV space, inset 1.5px so linear filtering never reaches the neighbouring clip */
  cellUV(i: number): Vector4 {
    const col = i % ATLAS.cols;
    const row = Math.floor(i / ATLAS.cols);
    const cw = 1 / ATLAS.cols;
    const ch = 1 / ATLAS.rows;
    const iu = 1.5 / SMALL_W;
    const iv = 1.5 / SMALL_H;
    // the textures are flipped: v runs up from the bottom row
    return new Vector4(col * cw + iu, 1 - (row + 1) * ch + iv, cw - 2 * iu, ch - 2 * iv);
  }

  /** draws cell i's current frame (or the still), for the player to open on; false if it cannot */
  drawCell(i: number, g: CanvasRenderingContext2D, w: number, h: number): boolean {
    const col = i % ATLAS.cols, row = Math.floor(i / ATLAS.cols);
    try {
      if (this.texture instanceof VideoTexture && this.video.readyState >= 2) {
        // measured off the video, so the half-size atlas lines up as well as the full one
        const cw = this.video.videoWidth / ATLAS.cols, ch = this.video.videoHeight / ATLAS.rows;
        g.drawImage(this.video, col * cw, row * ch, cw, ch, 0, 0, w, h);
        return true;
      }
      if (this.still) {
        // the still was decoded upside down for WebGL: its rows run from the bottom, and it is drawn flipped back
        const cw = this.still.width / ATLAS.cols, ch = this.still.height / ATLAS.rows;
        g.save();
        g.translate(0, h);
        g.scale(1, -1);
        g.drawImage(this.still, col * cw, (ATLAS.rows - 1 - row) * ch, cw, ch, 0, 0, w, h);
        g.restore();
        return true;
      }
    } catch { /* fall through */ }
    return false;
  }

  /** where cell i's loop is, as a fraction 0..1 (0 while only the still is showing) */
  get loopProgress(): number {
    return this.texture instanceof VideoTexture ? (this.video.currentTime % ATLAS.loop) / ATLAS.loop : 0;
  }
}
