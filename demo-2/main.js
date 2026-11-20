import * as THREE from 'three';
import { Snd } from './audio.js?v=1';

/* =========================================================
   Point-cloud shape sampling
   ========================================================= */
const R = Math.random, TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

class Shape {
  constructor() { this.p = []; }
  add(area, fn) { this.p.push({ area, fn }); return this; }
  // tube / pipe along a polyline, optional rounded corners (long-radius elbows)
  tube(pts, r, { corner = 0, w = 1 } = {}) {
    let P = pts;
    if (corner) {
      P = [pts[0]];
      for (let i = 1; i < pts.length - 1; i++) {
        const d1 = norm(sub(pts[i], pts[i - 1])), d2 = norm(sub(pts[i + 1], pts[i]));
        const a = sub(pts[i], mul(d1, corner)), b = add(pts[i], mul(d2, corner));
        for (let k = 0; k <= 8; k++) { const t = k / 8; P.push(add(add(mul(a, (1 - t) * (1 - t)), mul(pts[i], 2 * t * (1 - t))), mul(b, t * t))); }
      }
      P.push(pts[pts.length - 1]);
    }
    const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + len(sub(P[i], P[i - 1])));
    const L = cum[cum.length - 1];
    return this.add(L * TAU * Math.max(r, 0.035) * w, () => {
      const s = R() * L; let i = 1; while (cum[i] < s) i++;
      const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), c = add(P[i - 1], mul(sub(P[i], P[i - 1]), t));
      const tg = norm(sub(P[i], P[i - 1])); let n = cross(tg, [0, 1, 0]); if (len(n) < 0.01) n = [1, 0, 0]; n = norm(n);
      const b = cross(tg, n), th = R() * TAU;
      return add(c, add(mul(n, Math.cos(th) * r), mul(b, Math.sin(th) * r)));
    });
  }
  line(a, b, w = 1) { return this.tube([a, b], 0.008, { w }); }
  circle(c, Rr, axis = 'y', r = 0.01, w = 1, a0 = 0, a1 = TAU) {
    const pts = []; for (let k = 0; k <= 48; k++) { const a = a0 + (a1 - a0) * k / 48, u = Math.cos(a) * Rr, v = Math.sin(a) * Rr; pts.push(axis === 'y' ? [c[0] + u, c[1], c[2] + v] : axis === 'x' ? [c[0], c[1] + u, c[2] + v] : [c[0] + u, c[1] + v, c[2]]); }
    return this.tube(pts, r, { w });
  }
  disc(c, r0, r1, axis = 'y', w = 1) {
    return this.add(Math.PI * (r1 * r1 - r0 * r0) * w, () => { const a = R() * TAU, rr = Math.sqrt(r0 * r0 + R() * (r1 * r1 - r0 * r0)), u = Math.cos(a) * rr, v = Math.sin(a) * rr; return axis === 'y' ? [c[0] + u, c[1], c[2] + v] : axis === 'x' ? [c[0], c[1] + u, c[2] + v] : [c[0] + u, c[1] + v, c[2]]; });
  }
  sphere(c, r, sc = [1, 1, 1], ymin = -1, w = 1) {
    return this.add(4 * Math.PI * r * r * (1 - ymin) / 2 * w, () => { const y = ymin + R() * (1 - ymin), a = R() * TAU, q = Math.sqrt(1 - y * y); return [c[0] + Math.cos(a) * q * r * sc[0], c[1] + y * r * sc[1], c[2] + Math.sin(a) * q * r * sc[2]]; });
  }
  cone(c, r, h, w = 1) { return this.add(Math.PI * r * Math.hypot(r, h) * w, () => { const u = Math.sqrt(R()), a = R() * TAU; return [c[0] + Math.cos(a) * u * r, c[1] + h * (1 - u), c[2] + Math.sin(a) * u * r]; }); }
  box(c, s, w = 1) {
    const A = [s[1] * s[2], s[0] * s[2], s[0] * s[1]], T = A[0] + A[1] + A[2];
    return this.add(2 * T * w, () => { let k = R() * T, f = k < A[0] ? 0 : k < A[0] + A[1] ? 1 : 2; const p = [(R() - 0.5) * s[0], (R() - 0.5) * s[1], (R() - 0.5) * s[2]]; p[f] = (R() < 0.5 ? -0.5 : 0.5) * s[f]; return add(c, p); });
  }
  flange(c, axis, rp, Rf, t = 0.07) {
    const d = axis === 'x' ? [t, 0, 0] : axis === 'y' ? [0, t, 0] : [0, 0, t];
    this.tube([sub(c, d), add(c, d)], Rf, { w: 1.6 });
    return this.disc(sub(c, d), rp, Rf, axis, 1.4).disc(add(c, d), rp, Rf, axis, 1.4);
  }
  build(n, scale = 1, off = [0, 0, 0]) {
    const tot = this.p.reduce((s, q) => s + q.area, 0), out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { let k = R() * tot, j = 0; while (k > this.p[j].area && j < this.p.length - 1) k -= this.p[j++].area; const v = this.p[j].fn(); out[i * 3] = v[0] * scale + off[0]; out[i * 3 + 1] = v[1] * scale + off[1]; out[i * 3 + 2] = v[2] * scale + off[2]; }
    return out;
  }
}

function column() {
  const s = new Shape();
  s.tube([[0, -1.45, 0], [0, 1.25, 0]], 0.4).sphere([0, 1.25, 0], 0.4, [1, 0.55, 1], 0).tube([[0, -1.9, 0], [0, -1.45, 0]], 0.42).disc([0, -1.9, 0], 0, 0.62);
  [-0.65, 0.25, 0.95].forEach(y => { s.disc([0, y, 0], 0.4, 0.78, 'y', 1.3).circle([0, y + 0.24, 0], 0.78, 'y', 0.012, 1.5).circle([0, y + 0.12, 0], 0.78); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; s.line([Math.cos(a) * 0.78, y, Math.sin(a) * 0.78], [Math.cos(a) * 0.78, y + 0.24, Math.sin(a) * 0.78], 0.6); } });
  [-0.07, 0.07].forEach(z => s.line([0.46, -1.9, z], [0.46, 1.25, z]));
  s.tube([[0, 1.47, 0], [0, 1.8, 0], [-1.0, 1.8, 0], [-1.0, -1.0, 0], [-1.75, -1.0, 0]], 0.09, { corner: 0.22, w: 1.3 }).flange([0, 1.52, 0], 'y', 0.09, 0.17, 0.03).flange([-1.75, -1.0, 0], 'x', 0.09, 0.17, 0.03);
  s.tube([[0.85, -1.4, 0], [1.75, -1.4, 0]], 0.28).sphere([0.85, -1.4, 0], 0.28, [0.5, 1, 1]).sphere([1.75, -1.4, 0], 0.28, [0.5, 1, 1]);
  [1.05, 1.55].forEach(x => s.box([x, -1.78, 0], [0.1, 0.24, 0.5]));
  return s;
}
function spool() {
  const s = new Shape(), r = 0.2;
  s.tube([[-1.7, -0.6, 0.45], [-0.45, -0.6, 0.45], [-0.45, 0.65, 0.45], [1.0, 0.65, 0.45], [1.0, 0.65, -0.95]], r, { corner: 0.36 });
  s.flange([-1.7, -0.6, 0.45], 'x', r, 0.36).flange([1.0, 0.65, -0.95], 'z', r, 0.36).flange([-0.45, 0.05, 0.45], 'y', r, 0.36, 0.05);
  s.tube([[-1.05, -0.6, 0.45], [-1.05, -1.45, 0.45]], 0.14).flange([-1.05, -1.45, 0.45], 'y', 0.14, 0.27, 0.05);
  s.sphere([0.3, 0.65, 0.45], 0.32).flange([0.0, 0.65, 0.45], 'x', r, 0.34, 0.04).flange([0.6, 0.65, 0.45], 'x', r, 0.34, 0.04);
  s.tube([[0.3, 0.95, 0.45], [0.3, 1.4, 0.45]], 0.035, { w: 1.5 }).circle([0.3, 1.4, 0.45], 0.33, 'y', 0.035, 1.6);
  [0, 1, 2].forEach(k => { const a = k / 3 * Math.PI; s.line([0.3 + Math.cos(a) * 0.33, 1.4, 0.45 + Math.sin(a) * 0.33], [0.3 - Math.cos(a) * 0.33, 1.4, 0.45 - Math.sin(a) * 0.33], 0.7); });
  [[-0.9, -0.6, 0.45, 'x'], [0.75, 0.65, 0.45, 'x'], [1.0, 0.65, -0.3, 'z']].forEach(([x, y, z, ax]) => s.circle([x, y, z], r + 0.012, ax, 0.014, 1.6));   // weld seams
  return s;
}
function civil() {
  const s = new Shape();
  s.box([0, -1.45, 0], [2.4, 0.5, 2.4]).box([0, -0.9, 0], [1.2, 0.6, 1.2]).box([0, -0.57, 0], [0.95, 0.06, 0.95], 1.5);
  [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]].forEach(([x, z]) => s.tube([[x, -0.6, z], [x, -0.38, z]], 0.03, { w: 2 }));
  for (let k = -4; k <= 4; k++) { s.line([k * 0.26, -1.19, -1.15], [k * 0.26, -1.19, 1.15], 0.5); s.line([-1.15, -1.19, k * 0.26], [1.15, -1.19, k * 0.26], 0.5); }
  s.box([-0.24, 0.55, 0], [0.04, 2.2, 0.5]).box([0.24, 0.55, 0], [0.04, 2.2, 0.5]).box([0, 0.55, 0], [0.48, 2.2, 0.03]);
  s.box([0, 1.87, 0], [2.6, 0.04, 0.42]).box([0, 1.67, 0], [2.6, 0.04, 0.42]).box([0, 1.77, 0], [2.6, 0.2, 0.03]);
  return s;
}
function scaffold() {
  const s = new Shape(), X = [-0.95, 0, 0.95], Z = [-0.6, 0.6], Y = [-1.0, -0.1, 0.8, 1.7];
  X.forEach(x => Z.forEach(z => { s.tube([[x, -1.8, z], [x, 1.9, z]], 0.022, { w: 1.6 }); s.disc([x, -1.8, z], 0, 0.1, 'y', 2); }));
  Y.forEach(y => { Z.forEach(z => s.tube([[-0.95, y, z], [0.95, y, z]], 0.02, { w: 1.4 })); X.forEach(x => s.tube([[x, y, -0.6], [x, y, 0.6]], 0.02, { w: 1.4 })); });
  [-0.07, 0.83].forEach(y => s.box([0, y, 0], [1.9, 0.04, 1.2], 1.2));
  [0.36, 1.26].forEach(y => { Z.forEach(z => s.line([-0.95, y, z], [0.95, y, z])); [-0.95, 0.95].forEach(x => s.line([x, y, -0.6], [x, y, 0.6])); });
  [[-0.95, -1.8, 0, -1.0], [0, -1.0, 0.95, -0.1], [-0.95, -0.1, 0, 0.8], [0, 0.8, 0.95, 1.7]].forEach(([x0, y0, x1, y1]) => s.line([x0, y0, 0.6], [x1, y1, 0.6], 1.2));
  s.line([0.95, -1.8, -0.6], [0.95, -1.0, 0.6]).line([0.95, -0.1, -0.6], [0.95, 0.8, 0.6]);
  return s;
}
function tank() {
  const s = new Shape(), r = 1.2, y0 = -1.15, y1 = 0.45;
  s.tube([[0, y0, 0], [0, y1, 0]], r).cone([0, y1, 0], r, 0.34).disc([0, y0, 0], r, r + 0.12);
  [-0.75, -0.35, 0.05].forEach(y => s.circle([0, y, 0], r + 0.004, 'y', 0.006, 0.8));
  s.circle([0, y1 + 0.22, 0], r, 'y', 0.012, 1.5).circle([0, y1 + 0.11, 0], r).circle([0, y1, 0], r + 0.02, 'y', 0.02, 1.5);
  for (let k = 0; k < 20; k++) { const a = k / 20 * TAU; s.line([Math.cos(a) * r, y1, Math.sin(a) * r], [Math.cos(a) * r, y1 + 0.22, Math.sin(a) * r], 0.5); }
  const hel = (rr, dy) => { const p = []; for (let k = 0; k <= 40; k++) { const a = 0.4 + 1.5 * k / 40; p.push([Math.cos(a) * rr, y0 + (y1 - y0) * k / 40 + dy, Math.sin(a) * rr]); } return p; };
  s.tube(hel(r + 0.2, 0), 0.014, { w: 1.6 }).tube(hel(r + 0.02, 0), 0.014).tube(hel(r + 0.2, 0.2), 0.012, { w: 1.6 });
  for (let k = 0; k <= 22; k++) { const a = 0.4 + 1.5 * k / 22, y = y0 + (y1 - y0) * k / 22; s.line([Math.cos(a) * r, y, Math.sin(a) * r], [Math.cos(a) * (r + 0.2), y, Math.sin(a) * (r + 0.2)], 0.6); }
  s.tube([[0, y0 + 0.3, r], [0, y0 + 0.3, r + 0.4]], 0.1).flange([0, y0 + 0.3, r + 0.4], 'z', 0.1, 0.19, 0.03).tube([[0, y1 + 0.3, 0], [0, y1 + 0.55, 0]], 0.1);
  s.tube([[-0.7, y0 + 0.5, r - 0.25], [-0.7, y0 + 0.5, r + 0.08]], 0.22).disc([-0.7, y0 + 0.5, r + 0.08], 0, 0.27, 'z', 1.5);
  return s;
}
function valve() {
  const s = new Shape(), r = 0.3, y = -0.55;
  s.tube([[-1.75, y, 0], [-0.62, y, 0]], r).tube([[0.62, y, 0], [1.75, y, 0]], r);
  [-1.75, -0.62, 0.62, 1.75].forEach(x => s.flange([x, y, 0], 'x', r, 0.5));
  s.sphere([0, y, 0], 0.56, [1.05, 1, 1]).tube([[0, y + 0.45, 0], [0, y + 0.95, 0]], 0.24).flange([0, y + 0.95, 0], 'y', 0.2, 0.4, 0.05);
  [-0.16, 0.16].forEach(x => s.tube([[x, y + 1.0, 0], [x, y + 1.6, 0]], 0.035, { w: 1.5 }));
  s.tube([[-0.2, y + 1.6, 0], [0.2, y + 1.6, 0]], 0.05, { w: 1.5 }).tube([[0, y + 0.95, 0], [0, y + 1.95, 0]], 0.04, { w: 1.5 });
  s.circle([0, y + 1.9, 0], 0.62, 'y', 0.05, 1.6).sphere([0, y + 1.9, 0], 0.09);
  [0, 1, 2].forEach(k => { const a = k / 3 * Math.PI; s.tube([[Math.cos(a) * 0.62, y + 1.9, Math.sin(a) * 0.62], [-Math.cos(a) * 0.62, y + 1.9, -Math.sin(a) * 0.62]], 0.025, { w: 1.4 }); });
  return s;
}
function hardhat() {
  const s = new Shape(), sc = [1.12, 0.92, 1.3], y = -0.5;
  s.sphere([0, y, 0], 1, sc, 0);
  s.add(4, () => { const a = R() * TAU, rr = 0.98 + R() * (a > 0.25 && a < Math.PI - 0.25 ? 0.5 * Math.sin(a) + 0.16 : 0.16); return [Math.cos(a) * rr * sc[0], y - 0.02, Math.sin(a) * rr * sc[2]]; });
  [-0.3, 0, 0.3].forEach(x => { const p = []; for (let k = 0; k <= 30; k++) { const a = Math.PI * k / 30, q = Math.sqrt(1 - x * x); p.push([x * sc[0], y + Math.sin(a) * q * sc[1] + 0.02, Math.cos(a) * q * sc[2]]); } s.tube(p, 0.03, { w: 1.6 }); });
  s.circle([0, y + 0.02, 0], 1, 'y', 0.02, 0.01);
  return s;
}

/* =========================================================
   Topics and content (copy from the PMI 2026 brochure)
   ========================================================= */
const IC = {
  intro: 'M9 3h6v15H9zM7 21h10M9 8h6M9 13h6', mech: 'M3 16h7a3 3 0 0 0 3-3V8a3 3 0 0 1 3-3h5M3 13v6M21 2v6', civil: 'M4 20h16M7 20v-4h10v4M10 16V4h4v12',
  soft: 'M5 3v18M19 3v18M5 8h14M5 15h14M5 15l14-7', clean: 'M4 8c0-2 16-2 16 0v11H4zM4 8c0 2 16 2 16 0', pipe: 'M3 13v6M21 13v6M3 16h5l4-2 4 2h5M12 14V7M8 7h8',
  fac: 'M3 17h18M5 17a7 7 0 0 1 14 0M12 6v4', talk: 'M12 3l9 16H3z', list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', star: 'M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z', pin: 'M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
};
const svg = d => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const list = a => `<ul>${a.map(x => `<li>${x}</li>`).join('')}</ul>`;
const card = (eyebrow, title, body) => `<p class="eyebrow">${eyebrow}</p><h3>${title}</h3>${body}`;
const svc = (n, name, items) => card(`${n} / 06 · Self-performed`, name, list(items) + `<p>Executing multiple disciplines under one team reduces contractor interfaces, improves schedule control, and delivers consistent project execution.</p>`);
const TOPICS = [
  { key: 'intro', name: 'Reducing complexity. Delivering results.', short: 'Why PMI', shape: column, rot: 0.5, hot: [
    { at: [0.8, 0.5, 0], icon: IC.star, label: 'Why choose PMI', html: card('Why choose PMI', 'Every scope, working together', `<p>The success of a project depends on how well every scope works together. PMI delivers coordinated, accountable, multi-discipline execution that reduces gaps between scopes and keeps work moving safely and efficiently.</p>` + list(['One contractor, multiple scopes', 'Field-to-leadership alignment', 'Built to keep work moving', 'Execution that adapts']) + `<div class="stats"><div><b>6</b><span>Disciplines</span></div><div><b>29</b><span>Self-performed services</span></div><div><b>5</b><span>Fab &amp; shop locations</span></div><div><b>2003</b><span>Founded</span></div></div>`) },
    { at: [-1.0, 0.9, 0], icon: IC.intro, label: 'PMI advantage', html: card('PMI advantage', 'Construction · Maintenance · Turnarounds', `<p>PMI simplifies project delivery through a self-perform approach that reduces complexity, improves coordination, and helps keep projects on schedule.</p>` + list(['Eliminate handoffs that delay your project', 'Minimize disruption to operations', 'Take back control of your project schedule', 'Clear accountability at every stage'])) },
    { at: [1.3, -1.4, 0], icon: IC.list, label: 'Industries served', html: card('Industries served', 'Where we work', `<div class="pics">${[['petrochemical', 'Petrochemical'], ['refining', 'Refining'], ['midstream', 'Midstream'], ['food', 'Food &amp; Beverage'], ['mining', 'Mining &amp; Smelting'], ['power', 'Power Generation'], ['pulp', 'Pulp &amp; Paper'], ['datacenter', 'Mission Critical &amp; Data Centers']].map(([f, n]) => `<figure><img loading="lazy" src="../assets/ind-${f}.jpg" alt=""><figcaption>${n}</figcaption></figure>`).join('')}</div>`) },
  ] },
  { key: 'mech', name: 'Mechanical', shape: spool, rot: -0.55, hot: [
    { at: [0.3, 1.4, 0.45], icon: IC.list, label: 'Mechanical services', html: svc('01', 'Mechanical', ['Piping Systems Installation', 'Equipment Setting and Alignment', 'ASME “U” and “S” Code Work', 'NBIC “R” Stamp Repair', 'Structural Steel Erection']) },
    { at: [-1.7, -0.6, 0.45], icon: IC.star, label: 'Fab &amp; shop support', html: card('Fabrication &amp; shop support', 'From our shops to your pipe rack', list(['Corpus Christi', 'Port Lavaca', 'Freeport', 'Houston', 'Baton Rouge']) + `<p>By self-performing critical scopes with our own workforce, PMI helps reduce subcontractor dependency and maintain greater control over project timelines.</p>`) },
  ] },
  { key: 'civil', name: 'Civil', shape: civil, rot: 0.6, hot: [
    { at: [0.9, -0.6, 0.6], icon: IC.list, label: 'Civil services', html: svc('02', 'Civil', ['Site Preparation and Earthwork', 'Concrete Foundations', 'Equipment Pads and Structural Foundations', 'Underground Utilities', 'Drainage and Erosion Control']) },
    { at: [-1.2, 1.8, 0], icon: IC.star, label: 'One contractor', html: card('One contractor, multiple scopes', 'Fewer handoffs', `<p>Simplify project delivery through one team managing civil, mechanical, soft craft, pipeline, and facility services, reducing handoff delays and improving coordination.</p>`) },
  ] },
  { key: 'soft', name: 'Soft Craft', shape: scaffold, rot: 0.55, hot: [
    { at: [1.0, 0.9, 0.6], icon: IC.list, label: 'Soft craft services', html: svc('03', 'Soft Craft', ['Scaffold Design and Access', 'Insulation Systems', 'Industrial Coatings', 'Fireproofing Applications', 'Abatement']) },
    { at: [-1.0, -1.0, 0.6], icon: IC.star, label: 'Keep work moving', html: card('Built to keep work moving', 'Real-time response', `<p>Coordinated teams respond to challenges in real time, reducing delays, improving accountability, and maintaining project momentum.</p>`) },
  ] },
  { key: 'clean', name: 'Industrial Cleaning', shape: tank, rot: 0.3, hot: [
    { at: [0, -0.85, 1.6], icon: IC.list, label: 'Cleaning services', html: svc('04', 'Industrial Cleaning', ['Hydroblasting', 'Tank Cleaning', 'Hydro Excavation', 'Vacuum Services', 'Line Cleaning']) },
    { at: [-1.1, 0.85, 0.4], icon: IC.star, label: 'Minimize disruption', html: card('Minimize disruption to operations', 'Planned around your site', `<p>Work is planned around site conditions and production requirements to help minimize disruption and support ongoing operations.</p>`) },
  ] },
  { key: 'pipe', name: 'Pipeline', shape: valve, rot: 0.45, hot: [
    { at: [0, 1.4, 0], icon: IC.list, label: 'Pipeline services', html: svc('05', 'Pipeline', ['Pipeline Construction', 'Compressor, Metering, and Pump Stations', 'Pipeline Repair and Replacement', 'Integrity and Coating Services', 'Right-of-Way Maintenance']) },
    { at: [1.75, -0.55, 0], icon: IC.star, label: 'Execution that adapts', html: card('Execution that adapts', 'Real-world conditions', `<p>Keep work progressing across maintenance, turnarounds, capital projects, startups, and decommissioning activities with execution that adapts to real-world conditions.</p>`) },
  ] },
  { key: 'fac', name: 'Facility Services', shape: hardhat, rot: 0.5, hot: [
    { at: [0.9, 0.35, 0.6], icon: IC.list, label: 'Facility services', html: svc('06', 'Facility Services', ['Routine Facility Maintenance', 'Janitorial and Site Services', 'Grounds and Exterior Maintenance', 'Security Services']) },
    { at: [-1.1, -0.55, 0.8], icon: IC.star, label: 'Our values', html: card('Core values', 'People. Grit. Integrity.', list(['People: a people-first culture drives stronger field leadership', 'Grit: dependable results that keep projects moving', 'Integrity: transparent communication and follow-through']) + `<p>PMI strives to be our customers’ greatest asset by providing exceptional service through unrivaled responsiveness, reliability, and accountability.</p>`) },
  ] },
  { key: 'talk', name: 'Let’s discuss your next project', short: 'Contact', shape: null, rot: 0, hot: [
    { at: [1.5, -0.3, 0], icon: IC.pin, label: 'Locations', html: card('Locations', 'Gulf Coast and beyond', list(['Corporate Office: Port Lavaca, Texas', 'Texas: Corpus Christi · Victoria · Freeport · Deer Park · Houston', 'Louisiana: Lake Charles · Baton Rouge', 'Alabama: Mobile', 'International: Clarendon, Jamaica'])) },
    { at: [-1.5, -0.3, 0], icon: IC.star, label: 'Contact PMI', html: card('Let’s discuss', 'Your next project', `<p>Planning an upcoming maintenance event, turnaround, capital project, or specialty service scope? Connect with PMI to discuss your project goals and execution requirements.</p>` + list(['888.744.9699', 'bids@palaciosmarineindustrial.com', '2392 State Highway 35 N, Port Lavaca, TX 77979']) + `<a class="cta" href="mailto:bids@palaciosmarineindustrial.com">Request a bid</a>`) },
  ] },
];

/* =========================================================
   Renderer + particles
   ========================================================= */
const canvas = document.getElementById('scene');
const mobile = window.innerWidth < 760;
const N = mobile ? 12000 : 26000;
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100); camera.position.z = 8.6;
const group = new THREE.Group(); scene.add(group);

const SH = TOPICS.map(t => t.shape ? t.shape().build(N) : null);
// contact shape: triangle frame until the logo pixels are sampled
{ const s = new Shape(); s.tube([[-1.8, -1.0, 0], [1.8, -1.0, 0], [0, 1.6, 0], [-1.8, -1.0, 0]], 0.07).tube([[-1.1, -0.65, 0], [1.1, -0.65, 0], [0, 0.95, 0], [-1.1, -0.65, 0]], 0.03); SH[7] = s.build(N); }
// intro ring: every discipline's shape, small, orbiting the mission card
const RING = new Float32Array(N * 3);
for (let i = 0; i < N; i++) { const k = 1 + (i % 6), a = (k - 1) / 6 * TAU + 0.5, src = SH[k], j = i * 3; RING[j] = src[j] * 0.34 + Math.cos(a) * 2.75; RING[j + 1] = src[j + 1] * 0.34 + Math.sin(a) * 1.55; RING[j + 2] = src[j + 2] * 0.34; }

const geo = new THREE.BufferGeometry();
const scatter = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) scatter[i] = (R() - 0.5) * 14;
const rnd = new Float32Array(N * 4); for (let i = 0; i < N * 4; i++) rnd[i] = R();
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
geo.setAttribute('aFrom', new THREE.BufferAttribute(scatter, 3));
geo.setAttribute('aTo', new THREE.BufferAttribute(RING.slice(), 3));
geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
const U = { uT: { value: 0 }, uTime: { value: 0 }, uPix: { value: 1 }, uMouse: { value: new THREE.Vector2(9, 9) }, uAspect: { value: 1 }, uSize: { value: mobile ? 0.03 : 0.024 } };
const mat = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  vertexShader: `
    attribute vec3 aFrom, aTo; attribute vec4 aRnd;
    uniform float uT, uTime, uPix, uAspect, uSize; uniform vec2 uMouse; varying float vA;
    void main(){
      float t = clamp(uT * 1.7 - aRnd.x * 0.7, 0.0, 1.0);
      float e = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
      vec3 p = mix(aFrom, aTo, e);
      float burst = sin(3.14159 * e);
      // mid-flight: swirl out and stream sideways before settling
      float ang = burst * (aRnd.y - 0.5) * 3.0; float c = cos(ang), s = sin(ang);
      p.xz = mat2(c, -s, s, c) * p.xz;
      p += burst * (vec3(aRnd.y - 0.5, aRnd.z - 0.5, aRnd.w - 0.5) * 3.2 + vec3(1.6, 0.4, 0.0) * (aRnd.w - 0.3));
      // loose dust halo around the shape
      float loose = step(0.9, aRnd.w);
      p += loose * (vec3(aRnd.x - 0.5, aRnd.y - 0.5, aRnd.z - 0.5) * 1.5 + 0.25 * vec3(sin(uTime * 0.3 + aRnd.x * 30.0), cos(uTime * 0.25 + aRnd.y * 30.0), sin(uTime * 0.2 + aRnd.z * 30.0)));
      p += 0.012 * vec3(sin(uTime * 1.3 + aRnd.x * 40.0), cos(uTime * 1.1 + aRnd.y * 40.0), sin(uTime * 0.9 + aRnd.z * 40.0));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      vec2 d = (gl_Position.xy / gl_Position.w - uMouse) * vec2(uAspect, 1.0);
      float f = smoothstep(0.28, 0.0, length(d));
      gl_Position.xy += normalize(d + 1e-5) / vec2(uAspect, 1.0) * f * 0.07 * gl_Position.w;
      gl_PointSize = uSize * (0.55 + aRnd.z * 1.3) * (1.0 + burst * 0.6) * uPix / -mv.z;
      vA = (0.55 + 0.45 * aRnd.x) * (1.0 - loose * 0.45);
    }`,
  fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.18, d); gl_FragColor = vec4(1.0, 0.985, 0.97, a * vA); }`,
});
group.add(new THREE.Points(geo, mat)).frustumCulled = false;
group.children[0].frustumCulled = false;

// ambient dust / bokeh drifting through the frame
const DN = mobile ? 500 : 1100, dgeo = new THREE.BufferGeometry(), dp = new Float32Array(DN * 3), dr = new Float32Array(DN * 3);
for (let i = 0; i < DN; i++) { dp[i * 3] = (R() - 0.5) * 20; dp[i * 3 + 1] = (R() - 0.5) * 11; dp[i * 3 + 2] = (R() - 0.5) * 12; dr[i * 3] = R(); dr[i * 3 + 1] = R(); dr[i * 3 + 2] = R(); }
dgeo.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dgeo.setAttribute('aR', new THREE.BufferAttribute(dr, 3));
const DU = { uTime: { value: 0 }, uPix: { value: 1 }, uRush: { value: 0 } };
const dust = new THREE.Points(dgeo, new THREE.ShaderMaterial({
  uniforms: DU, transparent: true, depthWrite: false,
  vertexShader: `attribute vec3 aR; uniform float uTime, uPix, uRush; varying float vA; varying float vB;
    void main(){ vec3 p = position; p.x = mod(p.x + uTime * (0.08 + aR.x * 0.22) + uRush * (2.0 + aR.y * 6.0) + 10.0, 20.0) - 10.0; p.y += sin(uTime * 0.25 + aR.y * 20.0) * 0.4 + p.x * 0.12;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      vB = step(0.82, aR.z); gl_PointSize = (vB > 0.5 ? 0.42 : 0.05 + aR.z * 0.08) * uPix / -mv.z; vA = vB > 0.5 ? 0.13 : 0.3 + aR.x * 0.5; }`,
  fragmentShader: `varying float vA; varying float vB; void main(){ float d = length(gl_PointCoord - 0.5); float a = vB > 0.5 ? smoothstep(0.5, 0.3, d) : smoothstep(0.5, 0.1, d); gl_FragColor = vec4(1.0, mix(0.62, 0.35, vB), mix(0.42, 0.25, vB), a * vA); }`,
}));
dust.frustumCulled = false; scene.add(dust);

// sample the PMI logo into the contact shape
{ const img = new Image(); img.onload = () => { const w = 220, h = Math.round(220 * img.height / img.width), c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, pts = []; for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] > 140 && d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] < 560) pts.push(i);
    if (pts.length < 500) return; const out = SH[7]; for (let i = 0; i < N; i++) { const q = pts[(R() * pts.length) | 0]; out[i * 3] = ((q % w + R()) / w - 0.5) * 3.9; out[i * 3 + 1] = -(((q / w | 0) + R()) / h - 0.5) * 3.9 * h / w + 0.1; out[i * 3 + 2] = (R() - 0.5) * 0.1; }
    if (cur === 7) geo.attributes.aTo.needsUpdate = true; }; img.src = '../assets/pmi-logo.png'; }

/* =========================================================
   UI
   ========================================================= */
const snd = new Snd();
const $ = s => document.querySelector(s);
const rail = $('.rail'), hots = $('.hotspots'), title = $('.topic-title'), nextBtn = $('.next'), cardEl = $('.card'), cardBody = $('.card-body'), allEl = $('.all');
let cur = -1, morph = { t0: 0, dur: 1, on: false }, hotEls = [], started = false, baseRot = 0.3, lock = 0;

TOPICS.forEach((t, i) => {
  const b = document.createElement('button'); b.innerHTML = svg(IC[t.key]) + `<span>${t.short || t.name}</span>`; b.onclick = () => go(i); rail.appendChild(b);
  const g = document.createElement('button'); g.innerHTML = svg(IC[t.key]) + `<span>${t.short || t.name}</span>`; g.onclick = () => { closeAll(); go(i); }; $('.all-grid').appendChild(g);
});

function setTarget(arr, dur) {
  const from = geo.attributes.aFrom, to = geo.attributes.aTo;
  from.array.set(to.array); to.array.set(arr); from.needsUpdate = to.needsUpdate = true;
  U.uT.value = 0; morph = { t0: performance.now(), dur: dur * 1000, on: true };
}
function go(i) {
  if (!started || i === cur || performance.now() < lock) return;
  lock = performance.now() + 900;
  i = (i + TOPICS.length) % TOPICS.length; cur = i; const t = TOPICS[i];
  closeCard(true); snd.morph();
  setTarget(SH[i], 2.4); baseRot = t.rot;
  title.textContent = t.name;
  [...rail.children].forEach((b, k) => b.classList.toggle('on', k === i));
  const nx = TOPICS[(i + 1) % TOPICS.length]; nextBtn.querySelector('span').textContent = nx.short || nx.name;
  hots.innerHTML = ''; hotEls = t.hot.map(h => {
    const el = document.createElement('button'); el.className = 'hot'; el.innerHTML = `<b>${svg(h.icon)}</b><span>${h.label}</span>`;
    el.onclick = () => openCard(h.html); wire(el); hots.appendChild(el); return { el, at: new THREE.Vector3(...h.at) };
  });
  setTimeout(() => { if (cur === i) hotEls.forEach((h, k) => setTimeout(() => h.el.classList.add('show'), k * 180)); }, 1700);
}
function openCard(html) { cardBody.innerHTML = html; cardBody.scrollTop = 0; cardEl.classList.add('open'); cardEl.setAttribute('aria-hidden', 'false'); snd.open(); }
function closeCard(quiet) { if (!cardEl.classList.contains('open')) return; cardEl.classList.remove('open'); cardEl.setAttribute('aria-hidden', 'true'); if (!quiet) snd.close(); }
function closeAll() { allEl.classList.remove('open'); }
function wire(el) { el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') snd.hover(); }); el.addEventListener('pointerdown', () => snd.click()); }
document.querySelectorAll('button, a').forEach(wire);

$('.start').onclick = () => { snd.start(); started = true; $('.intro').classList.add('gone'); document.body.classList.add('live'); lock = 0; go(0); };
nextBtn.onclick = () => go(cur + 1);
$('.card .card-x').onclick = () => closeCard();
$('.all-btn').onclick = () => { allEl.classList.add('open'); snd.open(); };
$('.all-x').onclick = () => { closeAll(); snd.close(); };
allEl.addEventListener('click', e => { if (e.target === allEl) closeAll(); });
$('.snd').onclick = e => { const on = !snd.on; snd.set(on); e.currentTarget.classList.toggle('off', !on); };
$('.logo').onclick = e => { e.preventDefault(); go(0); };

// one gesture = one topic
let lastWheel = 0, ty = null;
const blocked = () => cardEl.classList.contains('open') || allEl.classList.contains('open');
window.addEventListener('wheel', e => { if (blocked()) return; const now = performance.now(), fresh = now - lastWheel > 200; lastWheel = now; if (fresh && Math.abs(e.deltaY) > 4) go(cur + Math.sign(e.deltaY)); }, { passive: true });
window.addEventListener('touchstart', e => { ty = e.touches[0].clientY; }, { passive: true });
window.addEventListener('touchend', e => { if (ty === null || blocked()) return; const dy = ty - e.changedTouches[0].clientY; ty = null; if (Math.abs(dy) > 45) go(cur + Math.sign(dy)); }, { passive: true });
window.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCard(); closeAll(); } if (blocked()) return; if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) go(cur + 1); if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) go(cur - 1); });

const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', e => { mouse.tx = e.clientX / innerWidth * 2 - 1; mouse.ty = -(e.clientY / innerHeight * 2 - 1); U.uMouse.value.set(mouse.tx, mouse.ty); });
window.addEventListener('pointerleave', () => U.uMouse.value.set(9, 9));

function fit() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  U.uAspect.value = w / h; U.uPix.value = DU.uPix.value = h * renderer.getPixelRatio() / (2 * Math.tan(camera.fov * Math.PI / 360));
  const s = Math.min(0.82, (w / h) * 1.3); group.scale.setScalar(s); group.position.y = w < 760 ? 0.15 : 0; U.uSize.value = (mobile ? 0.03 : 0.024) * (0.45 + 0.55 * s / 0.82);
}
window.addEventListener('resize', fit); fit();

const v = new THREE.Vector3(); let t0 = performance.now(), el = 0, rush = 0;
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = Math.min(0.05, (now - t0) / 1000); t0 = now; el += dt;
  U.uTime.value = DU.uTime.value = el;
  let k = 1; if (morph.on) { k = Math.min(1, (now - morph.t0) / morph.dur); U.uT.value = k; if (k >= 1) morph.on = false; }
  rush += Math.sin(Math.PI * k) * dt * 0.9; DU.uRush.value = rush;
  mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
  const target = started ? baseRot + Math.sin(el * 0.22) * 0.38 + mouse.x * 0.3 : Math.sin(el * 0.15) * 0.08;
  group.rotation.y += (target - group.rotation.y) * 0.04;
  group.rotation.x += ((started ? 0.1 : 0) - mouse.y * 0.14 - group.rotation.x) * 0.04;
  group.updateMatrixWorld();
  hotEls.forEach(h => { v.copy(h.at).applyMatrix4(group.matrixWorld).project(camera); h.el.style.transform = `translate(${((v.x + 1) / 2 * innerWidth - 23).toFixed(1)}px, ${((1 - v.y) / 2 * innerHeight - 23).toFixed(1)}px)`; });
  renderer.render(scene, camera);
}
// entrance: particles gather into the ring of shapes around the mission card
morph = { t0: performance.now() + 500, dur: 3200, on: true };
frame();
setTimeout(() => document.getElementById('loader').classList.add('done'), 1300);
window.__d2 = { go, snd, start: () => $('.start').click() };
