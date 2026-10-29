/*
 * Bakes the centrepiece's chrome into a matcap (src/scene/chrome-matcap.jpg).
 *
 * A sphere is lit and reflected the way the chrome is meant to look: a mirror
 * metal under a clear coat, a small studio of lamps for it to reflect, and
 * three lights in the product's colours. It is seen square-on through an
 * orthographic camera, so every normal the centrepiece can turn towards the
 * viewer is one pixel of the sphere. The page then shades the centrepiece
 * from this one image: no reflection pass to build, no lights, no physical
 * shader to compile, which was most of the time the scene took to start on
 * a slow phone.
 *
 * To change the look, edit it here, run `npm run dev`, open
 * /tools/matcap.html and save the image over src/scene/chrome-matcap.jpg.
 */
import {
  AmbientLight, BackSide, BoxGeometry, DirectionalLight, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  NoToneMapping, OrthographicCamera, PMREMGenerator, PlaneGeometry, SRGBColorSpace, Scene, SphereGeometry,
  WebGLRenderer,
} from 'three';

const SIZE = 1024;

/* the studio: a dark room with four lamps, in the product's blue, amber and white */
function studio(renderer: WebGLRenderer) {
  const pmrem = new PMREMGenerator(renderer);
  const room = new Scene();
  room.add(new Mesh(new BoxGeometry(20, 20, 20), new MeshBasicMaterial({ color: 0x0a0f1c, side: BackSide })));
  const lamps: Array<[number, number, number, [number, number, number]]> = [
    [0xdbe6ff, 7, 7, [-4, 7, 5]],
    [0xe89000, 4, 5, [7, 2, -5]],
    [0x1850e0, 7, 6, [0, 9, 0]],
    [0x5098f8, 3, 9, [-8, 0, -2]],
  ];
  for (const [color, w, h, [x, y, z]] of lamps) {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    room.add(m);
  }
  return pmrem.fromScene(room, 0.04, 0.1, 100, { size: 512 }).texture;
}

/* its blue as the key, its amber as the rim */
function lights(scene: Scene) {
  const key = new DirectionalLight(0xbcd2ff, 2.2);
  key.position.set(-5, 4, 6);
  const rim = new DirectionalLight(0xe89000, 1.6);
  rim.position.set(6, 1, -4);
  const top = new DirectionalLight(0xffffff, 0.9);
  top.position.set(0, 6, 3);
  scene.add(key, rim, top, new AmbientLight(0xffffff, 0.15));
}

const canvas = document.querySelector<HTMLCanvasElement>('#c')!;
const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = NoToneMapping;
renderer.setClearColor(0x05070c, 1);

const scene = new Scene();
lights(scene);
scene.add(new Mesh(new SphereGeometry(1, 256, 256), new MeshPhysicalMaterial({
  color: 0xaab4c8, roughness: 0.06, metalness: 1,
  clearcoat: 1, clearcoatRoughness: 0.03,
  envMap: studio(renderer), envMapIntensity: 2.2,
})));

// the sphere fills the frame edge to edge; three samples a matcap within 99% of its radius
const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);
renderer.render(scene, camera);

const save = document.querySelector<HTMLAnchorElement>('#save')!;
canvas.toBlob((blob) => {
  save.href = URL.createObjectURL(blob!);
  document.documentElement.dataset.baked = '';
}, 'image/jpeg', 0.9);
