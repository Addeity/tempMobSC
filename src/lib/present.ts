/*
 * Where the ring's last card comes to rest, facing the viewer, at the end of
 * the ring's scroll: the rectangle its screen fills, in CSS px. The scene
 * (src/scene/stage.ts) puts the card there; the page's copy of it starts from
 * there on its way into the tour's frame (src/ui/handover.ts). Both read it
 * here, so the two meet exactly.
 */
export interface Rect { x: number; y: number; w: number; h: number }

export function presentRect(w: number, h: number): Rect {
  const width = Math.min(w * 0.86, h * 0.5 * 16 / 9, 820);
  const height = width * 9 / 16;
  return { x: (w - width) / 2, y: h * 0.46 - height / 2, w: width, h: height };
}
