/*
 * Card faces: a bezel with a caption, drawn once per workflow. The screen
 * area holds a placeholder (the title, large) that the shader replaces with
 * the workflow's cell of the atlas once the video plays, and keeps if the
 * video cannot be used.
 */
import { filmDuration, type Workflow } from '@site/content';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { fmtTime, pad2 } from '../lib/dom.ts';
import { MONO, SERIF } from '../lib/fonts.ts';

/* On a phone a card is its screen alone. Its caption would sit among the
   page's own lines (the headline, the two on the way down), and at that
   size it could not be read anyway. A media query, asked once: the faces
   are drawn once. */
const BARE = matchMedia('(max-width: 767.98px)').matches;
export const FACE = { width: 1024, height: BARE ? 590 : 736 } as const;
/** the screen inside the face: exact 16:9, like the films */
export const SCREEN = { x: 16, y: 16, width: 992, height: 558 } as const;
export const CARD_ASPECT = FACE.width / FACE.height;


function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function spaced(g: CanvasRenderingContext2D, px: number) {
  if ('letterSpacing' in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

/*
 * Pixels per face unit. On a phone a card is never more than about 500
 * device pixels across, so its face is drawn at half size: a quarter of the
 * pixels to draw, upload and keep, and no difference on screen. Everything
 * below is laid out in face units either way.
 */
const DETAIL = matchMedia('(max-width: 899.98px)').matches ? 0.5 : 1;   // a media query: innerWidth would force a layout

function draw(canvas: HTMLCanvasElement, wf: Workflow, index: number) {
  const g = canvas.getContext('2d')!;
  const { width: W, height: H } = FACE;
  g.setTransform(DETAIL, 0, 0, DETAIL, 0, 0);
  g.clearRect(0, 0, W, H);

  // the bezel, a hair lighter at the top as a lit edge would be
  const bezel = g.createLinearGradient(0, 0, 0, H);
  bezel.addColorStop(0, '#111623');
  bezel.addColorStop(1, '#0a0d15');
  g.fillStyle = bezel;
  g.fillRect(0, 0, W, H);

  // the screen's placeholder
  g.fillStyle = '#0d121c';
  roundRect(g, SCREEN.x, SCREEN.y, SCREEN.width, SCREEN.height, 12);
  g.fill();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(244,245,247,.78)';
  g.font = `400 58px ${SERIF}`;
  g.fillText(wf.title, W / 2, SCREEN.y + SCREEN.height / 2 - 10);
  g.fillStyle = 'rgba(80,152,248,.9)';
  g.font = `500 19px ${MONO}`;
  spaced(g, 3);
  g.fillText(wf.category.toUpperCase(), W / 2, SCREEN.y + SCREEN.height / 2 + 46);
  spaced(g, 0);
  if (BARE) return;

  // the caption: number, area, length, then the title
  const x = 36;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillStyle = 'rgba(244,245,247,.48)';
  g.font = `500 20px ${MONO}`;
  g.fillText(pad2(index + 1), x, 624);
  g.fillStyle = '#5098f8';
  g.font = `500 18px ${MONO}`;
  spaced(g, 2.6);
  g.fillText(wf.category.toUpperCase(), x + 44, 624);
  spaced(g, 0);
  g.textAlign = 'right';
  g.fillStyle = 'rgba(244,245,247,.48)';
  g.font = `500 20px ${MONO}`;
  g.fillText(fmtTime(filmDuration(wf)), W - x, 624);
  g.textAlign = 'left';
  g.fillStyle = '#f4f5f7';
  g.font = `400 46px ${SERIF}`;
  g.fillText(wf.title, x, 694);
}

export class CardFaces {
  readonly textures: CanvasTexture[];
  private readonly canvases: HTMLCanvasElement[];

  constructor(private readonly workflows: readonly Workflow[]) {
    this.canvases = workflows.map(() => {
      const c = document.createElement('canvas');
      c.width = FACE.width * DETAIL;
      c.height = FACE.height * DETAIL;
      return c;
    });
    this.textures = this.canvases.map((c) => {
      const t = new CanvasTexture(c);
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    });
  }

  /** draw every face, one at a time with a yield after each, so the page never stalls on it (two at a time came to a long task on a phone) */
  async draw(yieldTo: () => Promise<void>): Promise<void> {
    for (let i = 0; i < this.canvases.length; i++) {
      draw(this.canvases[i]!, this.workflows[i]!, i);
      this.textures[i]!.needsUpdate = true;
      await yieldTo();
    }
  }
}
