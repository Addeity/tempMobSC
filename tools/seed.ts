/*
 * The ring's seed (src/scene/ring-seed.webp, styles/stage.css): the chrome
 * ring as the intro's first frame shows it, before the cards fly out, drawn
 * once here so the page shows it with its first paint and the live ring can
 * take over from it without a visible change.
 *
 * The centrepiece alone, posed as Stage.step() poses it at the start of the
 * intro (the camera dollied back, the ring at six tenths of its size and
 * tilted), on a transparent ground. For each layout in src/scene/layout.ts it
 * says where the ring's middle sits and how tall it is, as fractions of the
 * screen's height, for the numbers in stage.css; and it offers the picture.
 *
 * To redo it after the centrepiece or the intro's opening pose changes: run
 * `npm run dev`, open /tools/seed.html, save the picture over
 * src/scene/ring-seed.webp and copy the numbers into styles/stage.css.
 */
import { NoToneMapping, PerspectiveCamera, SRGBColorSpace, Scene, Vector3, WebGLRenderer } from 'three';
import { createCentrepiece, loadChrome } from '../src/scene/centrepiece.ts';
import { layoutFor } from '../src/scene/layout.ts';

/** a screen of each layout's shape (the fractions depend on the height alone; the width picks the layout) */
const SCREENS: Array<[string, number, number]> = [
  ['phone', 393, 852],
  ['small', 600, 900],
  ['tablet', 820, 1180],
  ['landscape', 1000, 700],
  ['large', 1440, 900],
];
/** the picture is drawn this many pixels tall, enough for a large screen's ring at twice its size */
const PICTURE_H = 240;

const out = document.getElementById('out')!;
const save = document.getElementById('save') as HTMLAnchorElement;

async function main(): Promise<void> {
  const chrome = await loadChrome();
  const canvas = document.createElement('canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  const rows: string[] = [];
  let picture = '';

  for (const [name, W, H] of SCREENS) {
    const layout = layoutFor(W, H);
    const scene = new Scene();
    const centre = createCentrepiece(layout.radius, chrome);
    // as Stage.step() has it at the intro's start: no spin yet, tilted, at six tenths
    centre.rotation.set(0.42, 0, 0);
    centre.scale.setScalar(0.6);
    scene.add(centre);
    const camera = new PerspectiveCamera(layout.fov, W / H, 0.1, 200);
    camera.position.set(0, 2.2 - layout.lift, layout.camZ + 8);
    camera.lookAt(0, -layout.lift * 1.25, 0);
    camera.updateMatrixWorld();
    centre.updateMatrixWorld(true);

    // the ring's outline on the screen: points round the tube's outer surface, projected
    const r = layout.radius * 0.22, tube = layout.radius * 0.064;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const v = new Vector3();
    for (let i = 0; i < 360; i++) {
      for (let j = 0; j < 24; j++) {
        const a = (i / 360) * Math.PI * 2, b = (j / 24) * Math.PI * 2;
        v.set((r + tube * Math.cos(b)) * Math.cos(a), (r + tube * Math.cos(b)) * Math.sin(a), tube * Math.sin(b));
        centre.children[0]!.localToWorld(v);
        v.project(camera);
        const px = (v.x * 0.5 + 0.5) * W, py = (-v.y * 0.5 + 0.5) * H;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
    }
    const cx = (x0 + x1) / 2 / W, cy = (y0 + y1) / 2 / H, h = (y1 - y0) / H, aspect = (x1 - x0) / (y1 - y0);
    rows.push(`${name.padEnd(10)} middle ${(cx * 100).toFixed(2)}% ${(cy * 100).toFixed(2)}%   height ${(h * 100).toFixed(3)}% of the screen   width/height ${aspect.toFixed(4)}`);

    // the picture, from the phone's pose: drawn large, then cut to the ring with a pixel to spare
    if (name === 'phone') {
      const scale = PICTURE_H / (y1 - y0);
      renderer.setPixelRatio(1);
      renderer.setSize(Math.round(W * scale), Math.round(H * scale), false);
      renderer.render(scene, camera);
      const pad = 2;
      const cut = document.createElement('canvas');
      cut.width = Math.ceil((x1 - x0) * scale) + pad * 2;
      cut.height = Math.ceil((y1 - y0) * scale) + pad * 2;
      cut.getContext('2d')!.drawImage(canvas, Math.floor(x0 * scale) - pad, Math.floor(y0 * scale) - pad, cut.width, cut.height, 0, 0, cut.width, cut.height);
      picture = cut.toDataURL('image/webp', 0.9);
      rows.push(`picture    ${cut.width} x ${cut.height}, padded ${pad}px each side`);
    }
  }
  out.textContent = rows.join('\n');
  save.href = picture;
  (window as unknown as { seed: unknown }).seed = { rows, picture };
}

void main();
