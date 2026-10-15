// Small helpers shared by the two canvas animations.

// Matches the canvas backing store to its CSS size and device pixel ratio.
export function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const w = Math.round(W * dpr), h = Math.round(H * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, W, H };
}

// Reads a colour token from style.css so the canvases follow the palette.
export const color = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
