/*
 * A chrome ring at the still centre of the ring of cards: a stand-in for a
 * 3D logo. When the new brand's arrives, load it with GLTFLoader
 * (three/examples/jsm/loaders/GLTFLoader.js), centre it on its own bounds and
 * give every mesh `chrome`. The rotation wiring in Stage stays as it is.
 *
 * The chrome is a matcap: the mirror metal, its studio and its lights baked
 * into one image by tools/matcap.html. It shades exactly as the lit,
 * reflecting material did, for the cost of a texture lookup.
 */
import {
  Group, ImageBitmapLoader, type Material, Mesh, MeshMatcapMaterial, SRGBColorSpace, Texture, TorusGeometry,
} from 'three';
import chromeUrl from './chrome-matcap.jpg';

/** the baked chrome, decoded off the main thread */
export async function loadChrome(): Promise<Texture> {
  const bitmap = await new ImageBitmapLoader().setOptions({ imageOrientation: 'flipY' }).loadAsync(chromeUrl);
  const texture = new Texture(bitmap);
  texture.flipY = false;   // already flipped while decoding
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createCentrepiece(radius: number, chromeMap: Texture): Group {
  const chrome = new MeshMatcapMaterial({ matcap: chromeMap });
  const group = new Group();
  group.add(new Mesh(new TorusGeometry(radius * 0.22, radius * 0.064, 64, 192), chrome));
  group.position.z = -0.6;
  return group;
}

export function disposeGroup(g: Group): void {
  g.traverse((o) => {
    const m = o as Mesh;
    m.geometry?.dispose();
    (m.material as Material | undefined)?.dispose?.();
  });
}
