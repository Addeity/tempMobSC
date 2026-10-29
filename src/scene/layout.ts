/*
 * The responsive layout table, after the reference's (panel unit 1.1).
 * Cards are landscape so the screens are big enough to read; a card's height
 * follows the face's aspect. `lift` raises the ring above centre to leave
 * the lower band to the hero.
 */
export interface Layout {
  fov: number;
  camZ: number;
  radius: number;
  panelW: number;
  rowSpacing: number;
  lift: number;
}

export const ROWS = 5;
export const SLOTS = 12;

export function layoutFor(w: number, h: number): Layout {
  const portrait = h > w;
  // a phone: the camera closer and the cards larger, so the ring fills the screen it has rather than float in it
  if (w < 500) return { fov: 72, camZ: 7.3, radius: 4.3, panelW: 1.82, rowSpacing: 4.6, lift: 1.05 };
  if (w < 768) return { fov: 68, camZ: 9.4, radius: 4.9, panelW: 2.0, rowSpacing: 4.2, lift: 0.9 };
  if (w < 1024 && portrait) return { fov: 64, camZ: 9.4, radius: 5.6, panelW: 2.15, rowSpacing: 5.0, lift: 0.9 };
  if (w < 1024) return { fov: 58, camZ: 11, radius: 6.6, panelW: 2.35, rowSpacing: 4.6, lift: 0.75 };
  return { fov: 50, camZ: 13, radius: 7.8, panelW: 2.6, rowSpacing: 5.2, lift: 0.75 };
}
