import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments } from 'three';

/*
 * The cage: the camera sits inside a radius-30 cylinder of lines, so it
 * reads as flat graph paper across the viewport. In the product's lifted
 * blue, barely there.
 */
export function buildCage(aspect: number): LineSegments<BufferGeometry, LineBasicMaterial> {
  const portrait = aspect > 1;
  const r = 30;
  const halfH = portrait ? Math.max(30, 22 * Math.min(aspect, 2.2)) : 22;
  const meridians = 80, segments = 200, rings = portrait ? 22 : 16;
  const v: number[] = [];
  for (let i = 0; i < meridians; i++) {
    const t = (i / meridians) * Math.PI * 2;
    const x = Math.cos(t) * r, z = Math.sin(t) * r;
    v.push(x, -halfH, z, x, halfH, z);
  }
  for (let i = 0; i <= rings; i++) {
    const y = -halfH + (i / rings) * halfH * 2;
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2, b = ((j + 1) / segments) * Math.PI * 2;
      v.push(Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(b) * r, y, Math.sin(b) * r);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(v, 3));
  const cage = new LineSegments(geo, new LineBasicMaterial({ color: 0x5098f8, transparent: true, opacity: 0, depthWrite: false }));
  cage.renderOrder = -10;
  return cage;
}
