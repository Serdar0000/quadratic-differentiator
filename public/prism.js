// Hero animation: a 3D triangular prism on a 3-4-5 right triangle, drawn the
// way a geometry textbook draws solids (hidden edges dashed). Plain canvas,
// no 3D library. Drag to rotate; it keeps spinning slowly on its own.

import { fitCanvas, color } from './canvas.js';

const GREEN = '43,240,127';

export function startPrism(canvas, box, { reduceMotion = false } = {}) {
  // Rotate around the circumcentre (midpoint of the hypotenuse) so every
  // vertex stays inside one sphere and the solid never leaves the frame.
  const base = [[0, 0], [4, 0], [0, 3]].map(([x, y]) => [x - 2, y - 1.5]);
  const D = 0.75;                     // half the prism's depth
  const RB = Math.hypot(2.5, D);      // bounding-sphere radius
  const V = [...base.map(([x, y]) => [x, y, D]), ...base.map(([x, y]) => [x, y, -D])];

  const faces = [
    { v: [0, 1, 2], n: [0, 0, 1], cap: true },
    { v: [5, 4, 3], n: [0, 0, -1], cap: true },
  ];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    const dx = base[j][0] - base[i][0], dy = base[j][1] - base[i][1], l = Math.hypot(dx, dy);
    faces.push({ v: [i, j, j + 3, i + 3], n: [dy / l, -dx / l, 0] });
  }
  // [from, to, faces that share this edge]
  const edges = [];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    edges.push([i, j, [0, 2 + i]], [i + 3, j + 3, [1, 2 + i]], [i, i + 3, [2 + i, 2 + ((i + 2) % 3)]]);
  }
  const sideLabel = ['4', '5', '3']; // edges A-B, B-C, C-A
  const light = (() => { const v = [-0.45, 0.6, 0.75], l = Math.hypot(...v); return v.map((c) => c / l); })();

  let yaw = 0.6, pitch = -0.35, vYaw = 0.35, vPitch = 0, drag = null, last = performance.now();

  function rot([x, y, z]) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  }

  function draw() {
    const { g, W, H } = fitCanvas(canvas);
    if (!W) return;
    g.clearRect(0, 0, W, H);

    // Scale so the sphere's nearest point still fits, with room for labels.
    const cam = 9, fit = Math.min(W, H) / 2 - (W < 500 ? 22 : 30), F = (fit * (cam - RB)) / RB, cx = W / 2, cy = H / 2;
    const proj = ([x, y, z]) => { const d = cam - z; return [cx + (F * x) / d, cy - (F * y) / d]; };
    const P = V.map(rot).map(proj);
    const G = color('--g'), TXT = color('--text'), MUT = color('--muted');

    // soft glow on the "floor"
    g.save();
    g.translate(cx, cy + fit * 0.9);
    g.scale(1, 0.22);
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, fit);
    glow.addColorStop(0, `rgba(${GREEN},.22)`);
    glow.addColorStop(1, `rgba(${GREEN},0)`);
    g.fillStyle = glow;
    g.beginPath(); g.arc(0, 0, fit, 0, 7); g.fill();
    g.restore();

    const visible = faces.map((f) => rot(f.n)[2] > 0);
    faces.forEach((f, k) => {
      if (!visible[k]) return;
      const n = rot(f.n), lit = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
      g.beginPath();
      f.v.forEach((vi, q) => (q ? g.lineTo(...P[vi]) : g.moveTo(...P[vi])));
      g.closePath();
      g.fillStyle = f.cap ? `rgba(${GREEN},${0.08 + 0.22 * lit})` : `rgba(${GREEN},${0.03 + 0.16 * lit})`;
      g.fill();
    });

    edges.forEach(([a, b, adj]) => {
      const shown = adj.some((k) => visible[k]);
      g.beginPath(); g.moveTo(...P[a]); g.lineTo(...P[b]);
      g.setLineDash(shown ? [] : [4, 5]);
      g.strokeStyle = shown ? G : MUT;
      g.globalAlpha = shown ? 1 : 0.5;
      g.lineWidth = shown ? 2 : 1.2;
      if (shown) { g.shadowColor = `rgba(${GREEN},.6)`; g.shadowBlur = 10; }
      g.stroke();
      g.shadowBlur = 0; g.globalAlpha = 1;
    });
    g.setLineDash([]);

    // Labels go on whichever triangular face looks at the viewer.
    const capIdx = visible[0] ? 0 : visible[1] ? 1 : -1;
    if (capIdx >= 0) {
      const off = capIdx === 0 ? 0 : 3;
      g.globalAlpha = Math.min(1, Math.abs(rot(faces[capIdx].n)[2]) * 1.8);

      const z = capIdx === 0 ? D : -D, s = 0.38, o = base[0];
      const mark = [[o[0] + s, o[1], z], [o[0] + s, o[1] + s, z], [o[0], o[1] + s, z]].map(rot).map(proj);
      g.strokeStyle = G; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(...mark[0]); g.lineTo(...mark[1]); g.lineTo(...mark[2]); g.stroke();

      const c = [0, 1, 2].map((i) => P[i + off]).reduce((acc, p) => [acc[0] + p[0] / 3, acc[1] + p[1] / 3], [0, 0]);
      const away = (p, d) => { const dx = p[0] - c[0], dy = p[1] - c[1], l = Math.hypot(dx, dy) || 1; return [p[0] + (dx / l) * d, p[1] + (dy / l) * d]; };
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '600 13px "Martian Mono", monospace';
      g.fillStyle = TXT;
      for (let i = 0; i < 3; i++) {
        const a = P[i + off], b = P[((i + 1) % 3) + off];
        g.fillText(sideLabel[i], ...away([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], 18));
      }
      g.font = '700 14px Unbounded, sans-serif';
      g.fillStyle = G;
      ['A', 'B', 'C'].forEach((name, i) => g.fillText(name, ...away(P[i + off], 18)));
      g.globalAlpha = 1;
    }
    P.forEach((p, i) => { g.fillStyle = i < 3 ? G : MUT; g.beginPath(); g.arc(p[0], p[1], i < 3 ? 3 : 2, 0, 7); g.fill(); });
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!drag) {
      vYaw += (0.35 - vYaw) * 0.02;
      vPitch += (0 - vPitch) * 0.05;
      pitch += (-0.32 + 0.12 * Math.sin(now / 2400) - pitch) * 0.02;
      if (!reduceMotion) yaw += vYaw * dt;
      pitch += vPitch * dt;
    }
    draw();
    requestAnimationFrame(frame);
  }

  box.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, t: performance.now() };
    box.setPointerCapture(e.pointerId);
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y, dt = Math.max(1, performance.now() - drag.t) / 1000;
    yaw += dx * 0.01;
    pitch = Math.max(-1.3, Math.min(1.3, pitch + dy * 0.01));
    vYaw = (dx * 0.01) / dt;
    vPitch = (dy * 0.01) / dt;
    drag = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  const release = () => {
    drag = null;
    vYaw = Math.max(-6, Math.min(6, vYaw));
    vPitch = Math.max(-3, Math.min(3, vPitch));
  };
  box.addEventListener('pointerup', release);
  box.addEventListener('pointercancel', release);

  requestAnimationFrame(frame);
}
