// Task sketch: draws the triangle from the task's own data (problem.triangle)
// edge by edge, then the height, angle marks and labels. The area is a "?"
// at the centre until the student answers correctly; then the triangle fills
// in and the "?" flips to the area.

import { fitCanvas, color, ease } from './canvas.js';

const GREEN = '43,240,127';
const fmt = (x) => String(Number(x.toFixed(2)));
const rad = (d) => (d * Math.PI) / 180;

// Turns problem.triangle into points and labels. Side labels follow the
// edges A-B, B-C, C-A.
export function shapeOf(tri, units = '', { right = false } = {}) {
  const u = String(units).replace(/square units?/i, '').replace(/\s*(²|\^2)\s*$/, '').trim();
  const len = (name, v) => `${name} = ${fmt(v)}${u ? ` ${u}` : ''}`;
  const shape = { pts: [], names: ['A', 'B', 'C'], sides: ['', '', ''], height: null, angles: {}, right: null };

  switch (tri?.method) {
    case 'base_height': {
      const { base: b, height: h } = tri;
      shape.sides[0] = len('a', b);
      if (right) {
        // right triangle: the height is the second leg
        shape.pts = [[0, 0], [b, 0], [0, h]];
        shape.sides[2] = len('h', h);
        shape.right = 0;
      } else {
        const foot = b * 0.3;
        shape.pts = [[0, 0], [b, 0], [foot, h]];
        shape.height = { from: 2, foot: [foot, 0], label: len('h', h) };
      }
      break;
    }
    case 'two_sides_angle': {
      const { a, b, angle_deg: t } = tri;
      shape.pts = [[0, 0], [a, 0], [b * Math.cos(rad(t)), b * Math.sin(rad(t))]];
      shape.sides[0] = len('a', a);
      shape.sides[2] = len('b', b);
      if (t === 90) shape.right = 0; else shape.angles[0] = `${fmt(t)}°`;
      break;
    }
    case 'three_sides': {
      const { a, b, c } = tri;
      const x = (b * b + c * c - a * a) / (2 * c);
      shape.pts = [[0, 0], [c, 0], [x, Math.sqrt(Math.max(0, b * b - x * x))]];
      shape.sides = [len('c', c), len('a', a), len('b', b)];
      break;
    }
    case 'coordinates': {
      shape.pts = tri.points.map(([x, y]) => [x, y]);
      shape.names = tri.points.map(([x, y], i) => `${'ABC'[i]}(${fmt(x)}, ${fmt(y)})`);
      break;
    }
    default:
      return null;
  }
  return shape;
}

export function createSketch(canvas, { reduceMotion = false } = {}) {
  let mode = 'empty';            // empty | loading | locked | shown
  let shape = null, areaText = '';
  let t0 = 0, revealAt = 0, raf = 0;
  const skip = reduceMotion ? 1e5 : 0;

  function run() {
    cancelAnimationFrame(raf);
    const step = () => { if (draw(performance.now())) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  }

  function grid(g, W, H) {
    g.fillStyle = color('--bg');
    g.fillRect(0, 0, W, H);
    g.strokeStyle = color('--grid');
    g.lineWidth = 1;
    for (let p = 0.5; p < W; p += 16) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, H); g.stroke(); }
    for (let p = 0.5; p < H; p += 16) { g.beginPath(); g.moveTo(0, p); g.lineTo(W, p); g.stroke(); }
  }

  function draw(now) {
    const { g, W, H } = fitCanvas(canvas);
    if (!W) return false;
    grid(g, W, H);
    if (mode === 'loading') return drawLoading(g, W, H, now);
    if (mode !== 'shown' || !shape) return false;

    const G = color('--g'), TXT = color('--text'), MUT = color('--muted'), ON = color('--on-g');
    const t = (now - t0) / 1000;

    // fit the triangle (and the height's foot) into the box at one scale
    const all = shape.height ? [...shape.pts, shape.height.foot] : shape.pts;
    const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = shape.names[0].length > 2 ? 64 : 52;
    const sc = Math.min((W - 2 * pad) / (maxX - minX || 1), (H - 2 * pad) / (maxY - minY || 1));
    const ox = (W - (maxX - minX) * sc) / 2 - minX * sc;
    const oy = (H + (maxY - minY) * sc) / 2 + minY * sc;
    const at = ([x, y]) => [ox + x * sc, oy - y * sc];
    const P = shape.pts.map(at);
    const C = P.reduce((acc, p) => [acc[0] + p[0] / 3, acc[1] + p[1] / 3], [0, 0]);
    const away = (p, d) => { const dx = p[0] - C[0], dy = p[1] - C[1], l = Math.hypot(dx, dy) || 1; return [p[0] + (dx / l) * d, p[1] + (dy / l) * d]; };

    // area fill, swept upwards after a correct answer
    if (revealAt) {
      const k = ease((now - revealAt) / 700);
      const top = Math.min(...P.map((p) => p[1])), bottom = Math.max(...P.map((p) => p[1]));
      g.save();
      g.beginPath(); g.rect(0, bottom - (bottom - top) * k - 1, W, H); g.clip();
      g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath();
      g.fillStyle = `rgba(${GREEN},.22)`; g.fill();
      g.restore();
    }

    // 1) edges, one after another
    g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = ease((t - i * 0.32) / 0.38);
      if (k <= 0) continue;
      const a = P[i], b = P[(i + 1) % 3];
      g.beginPath(); g.moveTo(...a); g.lineTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k);
      g.strokeStyle = revealAt ? G : TXT;
      g.lineWidth = 2;
      g.stroke();
    }

    // 2) height, right angles and angle arcs
    const km = ease((t - 1.0) / 0.35);
    if (km > 0) {
      g.globalAlpha = km;
      if (shape.height) {
        const top = P[shape.height.from], foot = at(shape.height.foot);
        g.setLineDash([5, 5]);
        g.strokeStyle = MUT; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(...top); g.lineTo(top[0] + (foot[0] - top[0]) * km, top[1] + (foot[1] - top[1]) * km); g.stroke();
        g.setLineDash([]);
        rightMark(g, foot, top, P[1], MUT);
      }
      if (shape.right != null) rightMark(g, P[shape.right], P[(shape.right + 1) % 3], P[(shape.right + 2) % 3], MUT);
      Object.entries(shape.angles).forEach(([vi, label]) => {
        const v = P[vi], a = P[(+vi + 1) % 3], b = P[(+vi + 2) % 3];
        const from = Math.atan2(a[1] - v[1], a[0] - v[0]);
        let d = Math.atan2(b[1] - v[1], b[0] - v[0]) - from;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        g.strokeStyle = MUT; g.lineWidth = 1.5;
        g.beginPath(); g.arc(v[0], v[1], 26, from, from + d * km, d < 0); g.stroke();
        const mid = from + d / 2;
        text(g, label, v[0] + Math.cos(mid) * 46, v[1] + Math.sin(mid) * 46, TXT, '600 12px "Martian Mono", monospace');
      });
      g.globalAlpha = 1;
    }

    // 3) vertex names, side labels, height label, area pill
    const kl = ease((t - 1.2) / 0.4);
    if (kl > 0) {
      g.globalAlpha = kl;
      const long = shape.names[0].length > 2;
      shape.names.forEach((name, i) => text(g, name, ...away(P[i], long ? 26 : 18), G, long ? '600 11px "Martian Mono", monospace' : '700 14px Unbounded, sans-serif'));
      P.forEach((p) => { g.fillStyle = TXT; g.beginPath(); g.arc(p[0], p[1], 3, 0, 7); g.fill(); });
      shape.sides.forEach((label, i) => {
        if (!label) return;
        const a = P[i], b = P[(i + 1) % 3];
        text(g, label, ...away([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], 20), TXT, '600 11px "Martian Mono", monospace');
      });
      if (shape.height) {
        const top = P[shape.height.from], foot = at(shape.height.foot);
        // label on the side of the dashed line away from the centre, where the area pill sits
        const side = top[0] > C[0] ? 1 : -1;
        g.textAlign = side > 0 ? 'left' : 'right';
        g.fillStyle = MUT; g.font = '600 11px "Martian Mono", monospace'; g.textBaseline = 'middle';
        g.fillText(shape.height.label, (top[0] + foot[0]) / 2 + side * 12, (top[1] + foot[1]) / 2);
      }
      pill(g, C, now, G, ON);
      g.globalAlpha = 1;
    }
    return true; // keep animating: the "?" breathes until it is solved
  }

  function pill(g, [x, y], now, G, ON) {
    const r = revealAt ? (now - revealAt) / 1000 : 0;
    const flip = revealAt ? ease(r / 0.4) : 0;
    const label = flip > 0.5 ? areaText : 'S = ?';
    g.font = '700 12px "Martian Mono", monospace';
    const w = g.measureText(label).width + 20, h = 24;
    const sy = Math.max(0.02, Math.abs(Math.cos(flip * Math.PI)));
    const breathe = revealAt || reduceMotion ? 1 : 1 + 0.05 * Math.sin(now / 320);
    g.save();
    g.translate(x, y); g.scale(breathe, sy * breathe);
    g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 12);
    g.fillStyle = flip > 0.5 ? G : `rgba(${GREEN},.14)`; g.fill();
    g.strokeStyle = G; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = flip > 0.5 ? ON : G;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, 0, 1);
    g.restore();
    if (revealAt && r < 1.1) {
      const k = ease(r / 1.1);
      g.strokeStyle = G; g.globalAlpha = (1 - k) * 0.8; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, 16 + k * 50, 0, 7); g.stroke();
      g.globalAlpha = 1;
    }
  }

  // while the AI is writing: a dashed triangle with marching dashes
  function drawLoading(g, W, H, now) {
    const s = Math.min(W, H) * 0.32, cx = W / 2, cy = H / 2 + s * 0.15;
    const pts = [[cx - s, cy + s * 0.55], [cx + s, cy + s * 0.55], [cx - s * 0.2, cy - s * 0.9]];
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath();
    g.setLineDash([8, 8]);
    g.lineDashOffset = reduceMotion ? 0 : -now / 30;
    g.strokeStyle = color('--g-dim'); g.lineWidth = 2; g.stroke();
    g.setLineDash([]);
    text(g, 'drawing…', cx, cy + s * 0.55 + 28, color('--muted'), '500 11px "Martian Mono", monospace');
    return true;
  }

  function rightMark(g, v, a, b, stroke) {
    const q = 11;
    const ua = [a[0] - v[0], a[1] - v[1]], la = Math.hypot(...ua) || 1;
    const ub = [b[0] - v[0], b[1] - v[1]], lb = Math.hypot(...ub) || 1;
    const p1 = [v[0] + (ua[0] / la) * q, v[1] + (ua[1] / la) * q];
    const p2 = [v[0] + (ub[0] / lb) * q, v[1] + (ub[1] / lb) * q];
    g.strokeStyle = stroke; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(...p1); g.lineTo(p1[0] + p2[0] - v[0], p1[1] + p2[1] - v[1]); g.lineTo(...p2); g.stroke();
  }

  function text(g, str, x, y, fill, font) {
    g.font = font; g.fillStyle = fill; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(str, x, y);
  }

  new ResizeObserver(() => draw(performance.now())).observe(canvas);

  return {
    loading() { mode = 'loading'; shape = null; revealAt = 0; run(); },
    lock() { mode = 'locked'; revealAt = 0; run(); },
    show(problem) {
      const text = `${problem.title} ${problem.context}`;
      shape = shapeOf(problem.triangle, problem.units, { right: /right[- ]?(angled|triangle)|legs?\b/i.test(text) });
      areaText = `S = ${fmt(problem.answer)}${problem.units ? ` ${problem.units}` : ''}`;
      mode = shape ? 'shown' : 'empty';
      t0 = performance.now() - skip;
      revealAt = 0;
      run();
    },
    replay() { if (mode === 'shown') { t0 = performance.now() - skip; run(); } },
    reveal() { if (mode === 'shown' && !revealAt) { revealAt = performance.now() - skip; run(); } },
  };
}
