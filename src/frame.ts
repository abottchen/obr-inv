export interface Rect { x: number; y: number; width: number; height: number; }

/**
 * Returns x,y so the rect is fully inside the iframe viewport.
 * Falls back to (padding, padding) if the rect is larger than the viewport.
 */
export function clampToFrame(target: Rect, padding = 4): { x: number; y: number } {
  const W = document.documentElement.clientWidth;
  const H = document.documentElement.clientHeight;
  let { x, y } = target;
  const { width, height } = target;
  if (x + width + padding > W) x = Math.max(padding, W - width - padding);
  if (y + height + padding > H) y = Math.max(padding, H - height - padding);
  if (x < padding) x = padding;
  if (y < padding) y = padding;
  return { x, y };
}
