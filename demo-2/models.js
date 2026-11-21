import * as THREE from 'three';
import { GULF } from './gulf.js?v=9';

/* Surface-sampled point clouds: models are built from real meshes, then particles are
   scattered over their triangles (area-weighted) and along feature edges. */
const PI = Math.PI, R = Math.random;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export class Model {
  constructor() { this.T = []; this.TW = []; this.TT = []; this.S = []; this.SW = []; this.ST = []; this.stack = [new THREE.Matrix4()]; }
  push(p = [0, 0, 0], r = [0, 0, 0], s = 1) { const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(s, s, s)); this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m)); return this; }
  pop() { this.stack.pop(); return this; }
  add(geo, { p = [0, 0, 0], r = [0, 0, 0], s = 1, w = 1, t = 0, e = 0, ea = 25 } = {}) {
    const sc = Array.isArray(s) ? s : [s, s, s];
    const m = this.stack[this.stack.length - 1].clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...sc)));
    if (w > 0) {
      const g = geo.index ? geo.toNonIndexed() : geo, P = g.attributes.position;
      for (let i = 0; i < P.count; i += 3) {
        _a.fromBufferAttribute(P, i).applyMatrix4(m); _b.fromBufferAttribute(P, i + 1).applyMatrix4(m); _c.fromBufferAttribute(P, i + 2).applyMatrix4(m);
        const area = _b.clone().sub(_a).cross(_c.clone().sub(_a)).length() / 2; if (area < 1e-9) continue;
        this.T.push(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, _c.x, _c.y, _c.z); this.TW.push(area * w); this.TT.push(t);
      }
    }
    if (e > 0) { const P = new THREE.EdgesGeometry(geo, ea).attributes.position; for (let i = 0; i < P.count; i += 2) { _a.fromBufferAttribute(P, i).applyMatrix4(m); _b.fromBufferAttribute(P, i + 1).applyMatrix4(m); this._seg(_a, _b, e, t); } }
    return this;
  }
  _seg(a, b, w, t) { this.S.push(a.x, a.y, a.z, b.x, b.y, b.z); this.SW.push(a.distanceTo(b) * 0.035 * w); this.ST.push(t); }
  line(a, b, w = 1, t = 0) { const m = this.stack[this.stack.length - 1]; this._seg(_a.set(...a).applyMatrix4(m), _b.set(...b).applyMatrix4(m), w, t); return this; }
  poly(pts, w = 1, closed = false, t = 0) { for (let i = 1; i < pts.length; i++) this.line(pts[i - 1], pts[i], w, t); if (closed) this.line(pts[pts.length - 1], pts[0], w, t); return this; }
  ground() {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, z0 = 1e9, z1 = -1e9; const scan = (A) => { for (let i = 0; i < A.length; i += 3) { x0 = Math.min(x0, A[i]); x1 = Math.max(x1, A[i]); y0 = Math.min(y0, A[i + 1]); z0 = Math.min(z0, A[i + 2]); z1 = Math.max(z1, A[i + 2]); } }; scan(this.T); scan(this.S);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rad = Math.hypot(x1 - x0, z1 - z0) / 2 + 0.12, circ = (r, w) => { const p = []; for (let k = 0; k <= 72; k++) { const a = k / 72 * PI * 2; p.push([cx + Math.cos(a) * r, y0, cz + Math.sin(a) * r]); } this.poly(p, w); };
    circ(rad, 1.1); circ(rad * 0.97, 0.5); circ(rad * 0.62, 0.35); circ(rad * 0.3, 0.25);
    for (let k = 0; k < 24; k++) { const a = k / 24 * PI * 2, r0 = k % 6 === 0 ? 0.3 : 0.9; this.line([cx + Math.cos(a) * rad * r0, y0, cz + Math.sin(a) * rad * r0], [cx + Math.cos(a) * rad * 0.97, y0, cz + Math.sin(a) * rad * 0.97], k % 6 === 0 ? 0.3 : 0.6); }
    return this;
  }
  build(N, fit = [4.5, 2.6]) {
    const nt = this.TW.length, ns = this.SW.length, cum = new Float64Array(nt + ns); let tot = 0;
    for (let i = 0; i < nt; i++) cum[i] = (tot += this.TW[i]); for (let i = 0; i < ns; i++) cum[nt + i] = (tot += this.SW[i]);
    const pos = new Float32Array(N * 3), tint = new Float32Array(N), bb = new THREE.Box3();
    for (let i = 0; i < N; i++) {
      const k = R() * tot; let lo = 0, hi = nt + ns - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < k) lo = mid + 1; else hi = mid; }
      let x, y, z;
      if (lo < nt) { let u = R(), v = R(); if (u + v > 1) { u = 1 - u; v = 1 - v; } const T = this.T, j = lo * 9, q = 1 - u - v; x = T[j] * q + T[j + 3] * u + T[j + 6] * v; y = T[j + 1] * q + T[j + 4] * u + T[j + 7] * v; z = T[j + 2] * q + T[j + 5] * u + T[j + 8] * v; tint[i] = this.TT[lo]; }
      else { const j = (lo - nt) * 6, S = this.S, u = R(); x = S[j] + (S[j + 3] - S[j]) * u; y = S[j + 1] + (S[j + 4] - S[j + 1]) * u; z = S[j + 2] + (S[j + 5] - S[j + 2]) * u; tint[i] = this.ST[lo - nt]; }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; bb.expandByPoint(_a.set(x, y, z));
    }
    const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()), s = Math.min(fit[0] / Math.max(sz.x, sz.z), fit[1] / sz.y);
    for (let i = 0; i < N; i++) { pos[i * 3] = (pos[i * 3] - c.x) * s; pos[i * 3 + 1] = (pos[i * 3 + 1] - c.y) * s; pos[i * 3 + 2] = (pos[i * 3 + 2] - c.z) * s; }
    return { pos, tint, xf: p => [(p[0] - c.x) * s, (p[1] - c.y) * s, (p[2] - c.z) * s] };
  }
}

/* ---------- geometry helpers ---------- */
const cyl = (r, h, seg = 28, open = true, r2 = r) => new THREE.CylinderGeometry(r2, r, h, seg, 1, open);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const sph = (r) => new THREE.SphereGeometry(r, 28, 18);
const dome = (r) => new THREE.SphereGeometry(r, 28, 10, 0, PI * 2, 0, PI / 2);
const tor = (Rr, r) => new THREE.TorusGeometry(Rr, r, 6, 40);
const ring = (r0, r1) => new THREE.RingGeometry(r0, r1, 36);
const UP = [-PI / 2, 0, 0];          // rotate XY-plane geometry (ring/torus) to lie flat
const AX = [0, 0, PI / 2];           // rotate a Y-axis cylinder to run along X
const AZ = [PI / 2, 0, 0];           // ... along Z
function pipeGeo(pts, r, bend = r * 3) {
  const P = pts.map(p => new THREE.Vector3(...p)), path = new THREE.CurvePath(); let prev = P[0];
  for (let i = 1; i < P.length - 1; i++) {
    const d1 = P[i].clone().sub(P[i - 1]).normalize(), d2 = P[i + 1].clone().sub(P[i]).normalize();
    const a = P[i].clone().addScaledVector(d1, -bend), b = P[i].clone().addScaledVector(d2, bend);
    path.add(new THREE.LineCurve3(prev, a)); path.add(new THREE.QuadraticBezierCurve3(a, P[i], b)); prev = b;
  }
  path.add(new THREE.LineCurve3(prev, P[P.length - 1]));
  return new THREE.TubeGeometry(path, Math.max(24, Math.round(path.getLength() * 26)), r, 12, false);
}
function rod(m, a, b, r, o = {}) {       // straight cylinder between two points
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), e = new THREE.Euler().setFromQuaternion(q);
  return m.add(cyl(r, d.length(), 10), { p: A.add(B).multiplyScalar(0.5).toArray(), r: [e.x, e.y, e.z], ...o });
}
function extr(pts, depth) { const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 }); g.translate(0, 0, -depth / 2); return g; }
function stadium(L, H, depth) { const s = new THREE.Shape(), r = H / 2; s.moveTo(-L / 2 + r, -r); s.lineTo(L / 2 - r, -r); s.absarc(L / 2 - r, 0, r, -PI / 2, PI / 2, false); s.lineTo(-L / 2 + r, r); s.absarc(-L / 2 + r, 0, r, PI / 2, PI * 1.5, false); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 12 }); g.translate(0, 0, -depth / 2); return g; }
// flange with bolt circle; axis 'x' | 'y' | 'z'
function flange(m, p, axis, rp, w = 1) {
  const Rf = rp * 1.75, rot = axis === 'x' ? AX : axis === 'z' ? AZ : [0, 0, 0];
  m.add(cyl(Rf, rp * 0.5, 28, false), { p, r: rot, w: 1.3 * w, e: 2 });
  for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2, u = Math.cos(a) * rp * 1.38, v = Math.sin(a) * rp * 1.38; const q = axis === 'x' ? [p[0], p[1] + u, p[2] + v] : axis === 'z' ? [p[0] + u, p[1] + v, p[2]] : [p[0] + u, p[1], p[2] + v]; m.add(cyl(rp * 0.13, rp * 0.9, 6, false), { p: q, r: rot, w: 2 * w }); }
}
function gateValve(m, p, axis, rp) {      // body + bonnet + yoke + rising stem + handwheel, flanged both ends
  m.push(p, axis === 'z' ? [0, PI / 2, 0] : [0, 0, 0]);
  m.add(sph(rp * 1.7), { s: [1.15, 1, 0.9] }).add(cyl(rp * 1.05, rp * 2.2, 20), { p: [0, rp * 2.2, 0] }).add(cyl(rp * 1.6, rp * 0.4, 20, false), { p: [0, rp * 3.3, 0], e: 2 });
  [-1, 1].forEach(s => rod(m, [s * rp * 0.8, rp * 3.4, 0], [s * rp * 0.8, rp * 6.2, 0], rp * 0.2, { w: 2 }));
  m.add(box(rp * 2.2, rp * 0.4, rp * 0.6), { p: [0, rp * 6.3, 0], e: 2 }); rod(m, [0, rp * 3.3, 0], [0, rp * 7.6, 0], rp * 0.16, { w: 3 });
  m.add(tor(rp * 2.3, rp * 0.2), { p: [0, rp * 7.2, 0], r: UP, w: 2.5 });
  for (let k = 0; k < 3; k++) { const a = k / 3 * PI; rod(m, [Math.cos(a) * rp * 2.3, rp * 7.2, Math.sin(a) * rp * 2.3], [-Math.cos(a) * rp * 2.3, rp * 7.2, -Math.sin(a) * rp * 2.3], rp * 0.13, { w: 2.5 }); }
  flange(m, [-rp * 2.2, 0, 0], 'x', rp); flange(m, [rp * 2.2, 0, 0], 'x', rp);
  return m.pop();
}
function person(m, p, ry = 0, s = 0.27, weld = false) {
  m.push(p, [0, ry, 0], s);
  [-0.1, 0.1].forEach(x => m.add(cyl(0.065, 0.8, 10), { p: [x, 0.4, 0], w: 2.1 }));
  m.add(new THREE.CapsuleGeometry(0.17, 0.36, 4, 12), { p: [0, 1.12, 0], s: [1, 1, 0.7], w: 2.1 });
  if (weld) { rod(m, [-0.24, 1.3, 0], [-0.1, 1.12, 0.42], 0.05, { w: 2.1 }); rod(m, [0.24, 1.3, 0], [0.08, 1.15, 0.45], 0.05, { w: 2.1 }); rod(m, [0.08, 1.15, 0.45], [0.02, 1.0, 0.82], 0.014, { w: 4 }); m.add(box(0.26, 0.3, 0.1), { p: [0, 1.55, 0.13], e: 3, w: 2.1 }); m.add(box(0.16, 0.06, 0.02), { p: [0, 1.58, 0.185], e: 2, w: 1 }); }
  else [-0.25, 0.25].forEach(x => m.add(cyl(0.05, 0.55, 8), { p: [x, 1.1, 0.05], r: [0.25, 0, x * 0.5], w: 2.1 }));
  m.add(sph(0.11), { p: [0, 1.56, 0], w: 2.1 }).add(dome(0.13), { p: [0, 1.6, 0], w: 2 }).add(ring(0.1, 0.19), { p: [0, 1.61, 0.03], r: UP, w: 2 });
  return m.pop();
}
function cloud(m, c, r, w, t = 1, sc = [1, 1, 1]) { return m.add(sph(r), { p: c, s: sc, w: w * 0.12, t }).add(sph(r * 0.4), { p: c, s: sc, w: w * 0.5, t }); }
// welding arc: a tiny bright orange / yellow spark at the joint (tint 3)
function arc(m, c, dir = 1) {
  m.add(sph(0.009), { p: c, w: 5, t: 3 });
  for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2 + 0.3, l = k % 2 ? 0.022 : 0.04; m.line(c, [c[0] + Math.cos(a) * l, c[1] + Math.sin(a) * l, c[2]], 0.35, 3); }     // small arc-flash star
  for (let k = 0; k < 5; k++) { const a = R() * PI * 2, v = 0.05 + R() * 0.07; m.line([c[0] + Math.cos(a) * v * 0.5, c[1] - 0.01, c[2] - dir * 0.02], [c[0] + Math.cos(a) * v, c[1] - 0.03 - R() * 0.05, c[2] - dir * (0.03 + R() * 0.04)], 0.12, 3); }   // a few short sparks
}
function column(m, x, z, r, y0, h, plats) {
  m.push([x, 0, z]);
  m.add(cyl(r, h, 36), { p: [0, y0 + h / 2 + 0.25, 0] }).add(dome(r), { p: [0, y0 + h + 0.25, 0], s: [1, 0.55, 1] }).add(cyl(r * 1.08, 0.25, 30, true, r), { p: [0, y0 + 0.125, 0] }).add(ring(r * 0.9, r * 1.35), { p: [0, y0 + 0.005, 0], r: UP, w: 2 });
  for (let y = y0 + 0.5; y < y0 + h + 0.2; y += 0.28) m.add(tor(r + 0.004, 0.005), { p: [0, y, 0], r: UP, w: 1.5 });
  plats.forEach((y, i) => {
    const a0 = i * 1.9;
    m.add(new THREE.RingGeometry(r, r + 0.2, 30, 1, a0, PI * 1.5), { p: [0, y, 0], r: UP, w: 1.6, e: 2 });
    [0.07, 0.14].forEach(o => m.add(new THREE.TorusGeometry(r + 0.2, 0.006, 5, 36, PI * 1.5), { p: [0, y + o, 0], r: [-PI / 2, 0, a0], w: 3 }));
    for (let k = 0; k <= 8; k++) { const a = -(a0 + k / 8 * PI * 1.5); m.line([Math.cos(a) * (r + 0.2), y, Math.sin(a) * (r + 0.2)], [Math.cos(a) * (r + 0.2), y + 0.14, Math.sin(a) * (r + 0.2)], 1.2); m.line([Math.cos(a) * r, y - 0.16, Math.sin(a) * r], [Math.cos(a) * (r + 0.19), y, Math.sin(a) * (r + 0.19)], 0.8); }
    m.add(cyl(r * 0.3, 0.1, 14), { p: [0, y + 0.22, r + 0.03], r: AZ, w: 1.5 }).add(new THREE.CircleGeometry(r * 0.36, 16), { p: [0, y + 0.22, r + 0.085], w: 2 });
  });
  [-0.035, 0.035].forEach(o => m.line([o, y0, -(r + 0.04)], [o, y0 + h + 0.25, -(r + 0.04)], 1.2));
  for (let y = y0 + 0.1; y < y0 + h + 0.2; y += 0.09) m.line([-0.035, y, -(r + 0.04)], [0.035, y, -(r + 0.04)], 0.6);
  return m.pop();
}

/* ---------- 0 · Why PMI: refinery ---------- */
function refinery() {
  const m = new Model(), g = -1.5;
  column(m, -0.25, 0, 0.27, g, 2.75, [g + 1.0, g + 1.75, g + 2.45]);
  column(m, 0.5, 0.15, 0.19, g, 1.9, [g + 0.9, g + 1.6]);
  m.add(pipeGeo([[-0.25, 1.62, 0], [-0.25, 1.82, 0], [-0.78, 1.82, 0], [-0.78, -0.86, 0], [-0.78, -0.86, 0.75]], 0.045, 0.14), { w: 1.3 }); flange(m, [-0.25, 1.68, 0], 'y', 0.045);
  m.add(pipeGeo([[0.5, 0.78, 0.15], [0.5, 0.95, 0.15], [0.9, 0.95, 0.15], [0.9, -0.5, 0.15], [0.9, -0.5, 0.75]], 0.035, 0.11), { w: 1.3 });
  // sphere on legs
  m.push([-1.4, 0, -0.1]); m.add(sph(0.48), { p: [0, -0.72, 0] }).add(tor(0.482, 0.006), { p: [0, -0.72, 0], r: UP, w: 2 }).add(ring(0, 0.16), { p: [0, -0.235, 0], r: UP, w: 2 }).add(tor(0.16, 0.006), { p: [0, -0.13, 0], r: UP, w: 3 });
  for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2, b = (k + 1) / 8 * PI * 2, x = Math.cos(a) * 0.43, z = Math.sin(a) * 0.43; rod(m, [x, g, z], [x, -0.72, z], 0.022, { w: 1.6 }); m.line([x, g, z], [Math.cos(b) * 0.43, -1.05, Math.sin(b) * 0.43], 0.8); m.line([x, -1.05, z], [Math.cos(b) * 0.43, g, Math.sin(b) * 0.43], 0.8); } m.pop();
  // storage tank
  m.push([1.5, 0, 0.1]); m.add(cyl(0.48, 0.8, 44), { p: [0, g + 0.4, 0] }).add(new THREE.ConeGeometry(0.49, 0.1, 44, 1, true), { p: [0, g + 0.85, 0] }).add(tor(0.48, 0.008), { p: [0, g + 0.8, 0], r: UP, w: 2 });
  [0.07, 0.13].forEach(o => m.add(tor(0.48, 0.005), { p: [0, g + 0.8 + o, 0], r: UP, w: 3 })); [0.27, 0.53].forEach(o => m.add(tor(0.481, 0.004), { p: [0, g + o, 0], r: UP }));
  for (let k = 0; k < 16; k++) { const a = k / 16 * PI * 2; m.line([Math.cos(a) * 0.48, g + 0.8, Math.sin(a) * 0.48], [Math.cos(a) * 0.48, g + 0.93, Math.sin(a) * 0.48]); }
  const hx = []; for (let k = 0; k <= 30; k++) { const a = 0.6 + 1.4 * k / 30; hx.push([Math.cos(a) * 0.53, g + 0.8 * k / 30, Math.sin(a) * 0.53]); } m.poly(hx, 2.5).poly(hx.map(p => [p[0], p[1] + 0.12, p[2]]), 2); m.pop();
  // flare
  rod(m, [1.05, g, -0.75], [1.05, 1.7, -0.75], 0.03, { w: 1.6 }); m.add(cyl(0.05, 0.16, 12), { p: [1.05, 1.78, -0.75] });
  [0, 2.1, 4.2].forEach(a => m.line([1.05, 0.9, -0.75], [1.05 + Math.cos(a) * 0.9, g, -0.75 + Math.sin(a) * 0.9], 0.6));
  m.add(sph(0.09), { p: [1.07, 1.98, -0.75], s: [1, 2.0, 1], w: 3, t: 1 }).add(sph(0.045), { p: [1.09, 2.14, -0.75], s: [1, 2.4, 1], w: 5, t: 1 });
  // pipe rack
  for (let x = -1.9; x <= 1.91; x += 0.63) { [0.58, 0.92].forEach(z => m.add(box(0.035, 0.75, 0.035), { p: [x, g + 0.375, z], e: 1.5, w: 0.5 })); [g + 0.42, g + 0.75].forEach(y => m.add(box(0.03, 0.035, 0.42), { p: [x, y, 0.75], e: 1.5, w: 0.5 })); }
  [[0.6, 0.03], [0.68, 0.045], [0.78, 0.03], [0.88, 0.04]].forEach(([z, r]) => m.add(cyl(r, 3.8, 12), { p: [0, g + 0.44 + r, z], r: AX }));
  [[0.62, 0.035], [0.74, 0.03], [0.86, 0.045]].forEach(([z, r]) => m.add(cyl(r, 3.8, 12), { p: [0, g + 0.77 + r, z], r: AX }));
  [[g + 0.42, 0.58], [g + 0.75, 0.92]].forEach(([y, z]) => m.line([-1.9, y, z], [1.9, y, z], 1.2));
  return { m, hot: { enter: [2.2, 0.2, 0], a: [-0.25, 2.25, 0], b: [-2.2, -0.2, 0], c: [2.2, -1.2, 0.3] } };
}

/* ---------- 1 · Mechanical: code vessel, piping, welder ---------- */
function mechanical() {
  const m = new Model(), g = -1.5, cy = -0.6, r = 0.5;
  m.add(cyl(r, 1.9, 44), { p: [0, cy, 0], r: AX });
  [-1, 1].forEach(s => { m.add(dome(r), { p: [s * 0.95, cy, 0], r: [0, 0, -s * PI / 2], s: [1, 0.5, 1] }); m.add(tor(r + 0.004, 0.007), { p: [s * 0.95, cy, 0], r: [0, PI / 2, 0], w: 3 }); m.add(tor(r + 0.004, 0.006), { p: [s * 0.32, cy, 0], r: [0, PI / 2, 0], w: 2 }); });
  m.line([-0.95, cy + r * 0.72, r * 0.7], [0.95, cy + r * 0.72, r * 0.7], 1);
  [-0.6, 0.6].forEach(x => { m.add(new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.2, 24, 1, true, PI * 0.62, PI * 0.76), { p: [x, cy, 0], r: AX, w: 1.5, e: 2 }); m.add(extr([[-0.42, 0], [0.42, 0], [0.42, 0.45], [0.3, 0.55], [-0.3, 0.55], [-0.42, 0.45]], 0.04), { p: [x, g + 0.04, 0], r: [0, PI / 2, 0], e: 2 }); m.add(box(0.26, 0.04, 0.95), { p: [x, g + 0.02, 0], e: 2 }); });
  // manway with davit, nozzles
  m.add(cyl(0.125, 0.16, 24), { p: [-0.5, cy + r + 0.06, 0] }); flange(m, [-0.5, cy + r + 0.15, 0], 'y', 0.125, 0.7); m.add(new THREE.CircleGeometry(0.215, 24), { p: [-0.5, cy + r + 0.2, 0], r: UP, w: 1.2 });
  m.add(pipeGeo([[-0.76, cy + r - 0.1, 0], [-0.76, cy + r + 0.38, 0], [-0.5, cy + r + 0.38, 0]], 0.014, 0.07), { w: 3 }); m.line([-0.5, cy + r + 0.38, 0], [-0.5, cy + r + 0.21, 0], 1.5);
  m.add(cyl(0.085, 0.25, 16), { p: [0.3, cy + r + 0.1, 0] }); flange(m, [0.3, cy + r + 0.22, 0], 'y', 0.085);
  m.add(cyl(0.06, 0.25, 14), { p: [0, cy - r - 0.1, 0] }); flange(m, [0, cy - r - 0.24, 0], 'y', 0.06);
  m.add(cyl(0.075, 0.22, 14), { p: [-1.3, cy, 0], r: AX }); flange(m, [-1.42, cy, 0], 'x', 0.075);
  rod(m, [0.75, cy - 0.25, r + 0.09], [0.75, cy + 0.3, r + 0.09], 0.02, { w: 3 }); [-0.25, 0.3].forEach(o => m.line([0.75, cy + o, r - 0.05], [0.75, cy + o, r + 0.09], 2));
  // process line: up from the nozzle, across through a gate valve, down and out
  const py = 0.72; m.add(pipeGeo([[0.3, cy + r + 0.25, 0], [0.3, py, 0], [1.45, py, 0], [1.45, g + 0.38, 0], [2.0, g + 0.38, 0]], 0.085, 0.24));
  gateValve(m, [0.85, py, 0], 'x', 0.085); flange(m, [2.0, g + 0.38, 0], 'x', 0.085);
  [[0.3, 0.42, 0, 'y'], [1.45, 0.2, 0, 'y'], [1.2, py, 0, 'x'], [1.75, g + 0.38, 0, 'x']].forEach(([x, y, z, ax]) => m.add(tor(0.09, 0.008), { p: [x, y, z], r: ax === 'y' ? UP : [0, PI / 2, 0], w: 3 }));
  m.add(box(0.05, 0.3, 0.05), { p: [1.6, g + 0.15, 0], e: 2 }).add(box(0.2, 0.03, 0.2), { p: [1.6, g + 0.015, 0], e: 2 });
  // welder working the girth seam
  person(m, [1.75, g, 0.47], PI, 0.5, true); arc(m, [1.75, g + 0.49, 0.05]);
  m.add(box(0.3, 0.3, 0.44), { p: [0.75, g + 0.17, 1.0], e: 2.5 }); m.poly([[0.9, g + 0.25, 0.9], [1.2, g + 0.02, 0.8], [1.55, g + 0.02, 0.7], [1.72, g + 0.55, 0.3]], 2);
  return { m, hot: { enter: [2.3, 0.3, 0], a: [0.85, 1.7, 0], b: [-1.9, -0.2, 0.3], c: [0.5, -1.75, 1.0] } };
}

/* ---------- 2 · Civil: excavator, footing with rebar, spoil pile ---------- */
function civilWork() {
  const m = new Model(), g = -1.5;
  m.push([-0.7, 0, 0]);
  [-0.38, 0.38].forEach(z => { m.add(stadium(1.5, 0.32, 0.26), { p: [0, g + 0.16, z], e: 2 }); [-0.59, 0.59].forEach(x => m.add(cyl(0.12, 0.27, 16, false), { p: [x, g + 0.16, z], r: AZ, w: 0.8, e: 1.5 })); for (let x = -0.4; x <= 0.41; x += 0.2) m.add(cyl(0.05, 0.27, 10, false), { p: [x, g + 0.07, z], r: AZ, w: 0.8 }); for (let x = -0.7; x <= 0.71; x += 0.07) m.line([x, g + 0.325, z - 0.13], [x, g + 0.325, z + 0.13], 0.5); });
  m.add(box(0.55, 0.1, 0.5), { p: [0, g + 0.3, 0], e: 1 }).add(cyl(0.2, 0.08, 20), { p: [0, g + 0.38, 0] });
  m.add(box(1.05, 0.34, 0.8), { p: [-0.12, g + 0.6, 0], e: 2.5 }).add(box(0.5, 0.1, 0.62), { p: [-0.36, g + 0.82, 0], e: 2 });
  m.add(new THREE.CylinderGeometry(0.42, 0.42, 0.36, 20, 1, false, PI * 1.0, PI), { p: [-0.62, g + 0.62, 0], s: [0.5, 1, 0.95], e: 2 });
  m.add(box(0.4, 0.52, 0.32), { p: [0.2, g + 1.03, 0.24], e: 3 }); m.poly([[0.4, g + 0.85, 0.09], [0.4, g + 1.27, 0.09], [0.4, g + 1.27, 0.39], [0.4, g + 0.85, 0.39]], 2, true).poly([[0.02, g + 0.95, 0.4], [0.38, g + 0.95, 0.4], [0.38, g + 1.26, 0.4], [0.02, g + 1.26, 0.4]], 2, true);
  rod(m, [-0.5, g + 0.86, -0.25], [-0.5, g + 1.1, -0.25], 0.025, { w: 2 });
  const bz = -0.1;
  m.add(extr([[0.12, g + 0.72], [0.3, g + 0.7], [1.08, g + 1.82], [1.88, g + 1.62], [1.86, g + 1.76], [1.04, g + 2.02]], 0.14), { p: [0, 0, bz], e: 2.5 });
  m.add(extr([[1.78, g + 1.86], [1.93, g + 1.72], [1.62, g + 0.62], [1.5, g + 0.66]], 0.11), { p: [0, 0, bz], e: 2.5 });
  // bucket: curved back away from the machine, open side and teeth facing the cab (it digs by curling toward the machine)
  m.add(extr([[1.49, g + 0.7], [1.64, g + 0.66], [1.94, g + 0.52], [2.02, g + 0.24], [1.88, g + 0.06], [1.62, g + 0.12], [1.76, g + 0.24], [1.8, g + 0.42], [1.62, g + 0.54]], 0.36), { p: [0, 0, bz], e: 2.5 });
  for (let k = 0; k < 4; k++) m.add(new THREE.ConeGeometry(0.03, 0.1, 6), { p: [1.59, g + 0.09, bz - 0.14 + k * 0.093], r: [0, 0, 1.9], w: 2 });
  rod(m, [0.42, g + 0.78, bz], [0.82, g + 1.42, bz], 0.035, { w: 1.6 }); rod(m, [1.08, g + 2.02, bz], [1.8, g + 1.9, bz], 0.03, { w: 1.6 }); rod(m, [1.84, g + 1.7, bz], [1.6, g + 0.8, bz + 0.0], 0.026, { w: 1.6 });
  m.add(cyl(0.05, 0.2, 10, false), { p: [1.87, g + 1.7, bz], r: AZ, w: 2 }).add(cyl(0.05, 0.2, 10, false), { p: [0.2, g + 0.74, bz], r: AZ, w: 2 });
  m.pop();
  // spoil pile under the bucket, footing with rebar cage and formwork
  m.add(new THREE.ConeGeometry(0.45, 0.34, 20, 4, true), { p: [0.7, g + 0.17, 0.62], w: 1.2 }).add(new THREE.ConeGeometry(0.28, 0.2, 16, 3, true), { p: [1.05, g + 0.1, 0.9], w: 1.2 });
  m.push([1.5, 0, -1.0]); m.add(box(0.95, 0.14, 0.95), { p: [0, g + 0.07, 0], e: 2.5 }).add(box(0.5, 0.3, 0.5), { p: [0, g + 0.29, 0], e: 2.5 });
  for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) if (i % 3 === 0 || k % 3 === 0) m.line([-0.18 + i * 0.12, g + 0.44, -0.18 + k * 0.12], [-0.18 + i * 0.12, g + 0.95, -0.18 + k * 0.12], 1.6);
  [0.6, 0.75, 0.9].forEach(y => m.poly([[-0.18, g + y, -0.18], [0.18, g + y, -0.18], [0.18, g + y, 0.18], [-0.18, g + y, 0.18]], 1.2, true));
  for (let i = 0; i < 6; i++) { m.line([-0.45 + i * 0.18, g + 0.145, -0.45], [-0.45 + i * 0.18, g + 0.145, 0.45], 0.5); m.line([-0.45, g + 0.145, -0.45 + i * 0.18], [0.45, g + 0.145, -0.45 + i * 0.18], 0.5); } m.pop();
  // concrete mixer truck backing up to a formed slab, chute out
  m.push([-0.55, 0, 1.5]);
  m.add(box(1.95, 0.07, 0.34), { p: [0, g + 0.27, 0], e: 2 });
  [-0.72, 0.36, 0.64].forEach(x => [-0.21, 0.21].forEach(z => { m.add(cyl(0.135, 0.1, 18), { p: [x, g + 0.135, z], r: AZ, e: 1.5 }); m.add(cyl(0.06, 0.11, 10), { p: [x, g + 0.135, z], r: AZ, w: 0.8 }); }));
  m.add(box(0.44, 0.48, 0.5), { p: [-0.74, g + 0.55, 0], e: 3 }).add(box(0.1, 0.2, 0.5), { p: [-1.0, g + 0.4, 0], e: 2 });
  m.poly([[-0.97, g + 0.52, -0.21], [-0.97, g + 0.75, -0.21], [-0.97, g + 0.75, 0.21], [-0.97, g + 0.52, 0.21]], 2, true).poly([[-0.9, g + 0.52, 0.255], [-0.62, g + 0.52, 0.255], [-0.62, g + 0.75, 0.255], [-0.9, g + 0.75, 0.255]], 1.5, true);
  m.add(cyl(0.085, 0.3, 14), { p: [-0.36, g + 0.4, 0], r: AZ, w: 1.2 });
  m.push([0.12, g + 0.74, 0], [0, 0, 0.2]);
  m.add(new THREE.LatheGeometry([[0.1, -0.62], [0.27, -0.42], [0.345, -0.05], [0.33, 0.22], [0.2, 0.52], [0.14, 0.62]].map(q => new THREE.Vector2(q[0], q[1])), 30), { r: [0, 0, -PI / 2], w: 1.3 });
  [[-0.42, 0.275], [-0.05, 0.35], [0.22, 0.335], [0.52, 0.205]].forEach(([x, rr]) => m.add(tor(rr, 0.007), { p: [x, 0, 0], r: [0, PI / 2, 0], w: 3 }));
  for (let k = 0; k < 3; k++) { const pts = []; for (let j = 0; j <= 20; j++) { const u = j / 20, x = -0.4 + u * 0.9, rr = 0.28 + 0.07 * Math.sin(u * PI), a = u * PI * 1.3 + k * PI * 2 / 3; pts.push([x, Math.cos(a) * rr, Math.sin(a) * rr]); } m.poly(pts, 1.2); }
  m.pop();
  m.add(box(0.1, 0.62, 0.3), { p: [0.9, g + 0.6, 0], e: 2 }).add(new THREE.CylinderGeometry(0.17, 0.07, 0.2, 14, 1, true), { p: [0.93, g + 1.0, 0], w: 1.5, e: 1 });
  m.add(new THREE.CylinderGeometry(0.07, 0.055, 0.62, 12, 1, true, 0, PI), { p: [1.22, g + 0.44, 0.06], r: [0, 0.2, 1.05], w: 2.2, e: 2 });
  m.pop();
  m.push([1.42, 0, 1.6]); m.add(box(1.0, 0.09, 0.62), { p: [0, g + 0.045, 0], e: 3 });
  for (let i = 0; i <= 6; i++) m.line([-0.48 + i * 0.16, g + 0.1, -0.29], [-0.48 + i * 0.16, g + 0.1, 0.29], 0.7); for (let i = 0; i <= 4; i++) m.line([-0.48, g + 0.1, -0.28 + i * 0.14], [0.48, g + 0.1, -0.28 + i * 0.14], 0.7);
  [[-0.52, -0.33], [0.52, -0.33], [0.52, 0.33], [-0.52, 0.33]].forEach(([x, z]) => m.line([x, g, z], [x, g + 0.2, z], 1.5)); m.pop();
  person(m, [1.55, g, 1.02], 0.4, 0.3);
  return { m, hot: { enter: [2.2, 0.6, 0], a: [0.5, 1.0, 0], b: [2.2, -0.7, -0.3], c: [-2.2, -0.6, 0.4] } };
}

/* ---------- 3 · Soft craft: scaffold around a vessel being insulated and coated ---------- */
function softCraft() {
  const m = new Model(), g = -1.5, r = 0.5, h = 0.92, top = 1.6;
  m.add(cyl(r, 1.3, 40), { p: [0, g + 0.65 + 0.2, 0] }).add(cyl(r + 0.06, 1.75, 40), { p: [0, 0.6, 0] }).add(dome(r + 0.06), { p: [0, 1.475, 0], s: [1, 0.5, 1] }).add(ring(r, r + 0.06), { p: [0, -0.275, 0], r: UP, w: 3 }).add(cyl(r * 1.05, 0.2, 30), { p: [0, g + 0.1, 0] });
  for (let y = -0.1; y < 1.45; y += 0.22) m.add(tor(r + 0.064, 0.006), { p: [0, y, 0], r: UP, w: 2.5 });
  for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; m.line([Math.cos(a) * (r + 0.063), -0.27, Math.sin(a) * (r + 0.063)], [Math.cos(a) * (r + 0.063), 1.47, Math.sin(a) * (r + 0.063)], 0.5); }
  const G = [-h, 0, h], levels = [g + 0.55, g + 1.1, g + 1.65, g + 2.2, g + 2.75], decks = [g + 1.1, g + 2.2];
  G.forEach(x => G.forEach(z => { if (x === 0 && z === 0) return; rod(m, [x, g, z], [x, top, z], 0.017, { w: 2.2 }); m.add(box(0.1, 0.012, 0.1), { p: [x, g + 0.006, z], e: 2 }); levels.forEach(y => m.add(cyl(0.035, 0.012, 8, false), { p: [x, y, z], w: 2 })); }));
  levels.forEach(y => [-h, h].forEach(s => { rod(m, [-h, y, s], [h, y, s], 0.014, { w: 2 }); rod(m, [s, y, -h], [s, y, h], 0.014, { w: 2 }); }));
  decks.forEach(y => { [-1, 1].forEach(s => { m.add(box(2 * h + 0.2, 0.025, 0.3), { p: [0, y + 0.02, s * (h - 0.15)], e: 1.5, w: 1.3 }); m.add(box(0.3, 0.025, 2 * h - 0.4), { p: [s * (h - 0.15), y + 0.02, 0], e: 1.5, w: 1.3 }); for (let k = -3; k <= 3; k++) m.line([k * 0.28, y + 0.034, s * (h - 0.3)], [k * 0.28, y + 0.034, s * h], 0.3); });
    [[-h, -h, h, -h], [h, -h, h, h], [h, h, -h, h], [-h, h, -h, -h]].forEach(([x0, z0, x1, z1]) => { [0.27, 0.5].forEach(o => rod(m, [x0, y + o, z0], [x1, y + o, z1], 0.012, { w: 2 })); m.line([x0, y + 0.08, z0], [x1, y + 0.08, z1], 1.5); }); });
  [[-h, g, 0, g + 1.1], [0, g + 1.1, h, g + 2.2], [-h, g + 2.2, 0, top]].forEach(([x0, y0, x1, y1]) => { rod(m, [x0, y0, h], [x1, y1, h], 0.011, { w: 2 }); rod(m, [h, y0, -x0], [h, y1, -x1], 0.011, { w: 2 }); });
  [-0.09, 0.09].forEach(o => m.line([-h - 0.03, g, 0.35 + o], [-h - 0.03, g + 2.5, 0.35 + o], 1.6)); for (let y = g + 0.1; y < g + 2.5; y += 0.1) m.line([-h - 0.03, y, 0.26], [-h - 0.03, y, 0.44], 0.7);
  // insulator fitting cladding, painter spraying the lower shell
  person(m, [-0.3, g + 2.235, h - 0.16], PI * 0.9, 0.3);
  m.add(new THREE.CylinderGeometry(r + 0.075, r + 0.075, 0.42, 20, 1, true, -0.9, 1.5), { p: [0, 0.75, 0], w: 3, e: 3 });
  // abrasive blaster on the first deck, front face: red hood and cape (so he reads against the dark shell), nozzle aimed down at the shell; blasted band shows red
  const bx = 0.22, by = g + 1.135, bz = h - 0.12;
  m.push([bx, by, bz], [0, PI, 0], 0.3);
  [-0.1, 0.1].forEach(x => m.add(cyl(0.065, 0.8, 10), { p: [x, 0.4, 0], w: 5 }));
  m.add(new THREE.CapsuleGeometry(0.17, 0.36, 4, 12), { p: [0, 1.12, 0], s: [1, 1, 0.7], w: 5 });
  rod(m, [-0.24, 1.3, 0], [-0.06, 1.05, 0.36], 0.05, { w: 5 }); rod(m, [0.24, 1.3, 0], [0.06, 1.12, 0.3], 0.05, { w: 5 });
  m.add(new THREE.CylinderGeometry(0.13, 0.25, 0.34, 16, 1, true), { p: [0, 1.42, 0], w: 6, t: 1 }).add(dome(0.14), { p: [0, 1.56, 0], w: 6, t: 1 }).add(box(0.2, 0.1, 0.04), { p: [0, 1.57, 0.12], e: 3, w: 1 });   // blast hood with cape, visor
  m.add(new THREE.CylinderGeometry(0.045, 0.03, 0.42, 12, 1, false), { p: [0, 0.96, 0.52], r: [PI / 2 + 0.55, 0, 0], w: 7, e: 3 });     // venturi nozzle
  m.pop();
  const tip = [bx, by + 0.25, bz - 0.165], hit = [bx, by + 0.12, r + 0.07];
  for (let k = 0; k < 14; k++) { const a = k / 14 * PI * 2, sp = 0.05; m.line(tip, [hit[0] + Math.cos(a) * sp, hit[1] + Math.sin(a) * sp, hit[2]], 0.5); }   // abrasive stream
  cloud(m, [hit[0], hit[1] - 0.04, hit[2] + 0.05], 0.12, 1.6, 0, [1.2, 1.1, 0.8]);                                              // rebound dust
  m.add(new THREE.CylinderGeometry(r + 0.065, r + 0.065, 0.3, 24, 1, true, Math.atan2(bx, r) - 0.45, 0.9), { p: [0, by + 0.1, 0], w: 0.7, t: 1 });   // blasted band
  // blast hose from the nozzle over the rail and down to the pot; air hose from the compressor to the pot
  const pot = [0.55, g, h + 0.5], cmp = [-0.35, g, h + 0.62];
  m.add(pipeGeo([[bx + 0.03, by + 0.3, bz + 0.02], [bx + 0.1, by + 0.46, h + 0.06], [bx + 0.18, by + 0.2, h + 0.2], [bx + 0.25, g + 0.05, h + 0.24], [pot[0] - 0.05, g + 0.015, pot[2] - 0.3], [pot[0], g + 0.07, pot[2] - 0.06]], 0.014, 0.08), { w: 7 });
  m.add(pipeGeo([[cmp[0] + 0.32, g + 0.12, cmp[2] + 0.1], [cmp[0] + 0.45, g + 0.015, cmp[2] + 0.12], [pot[0] - 0.3, g + 0.015, pot[2] + 0.12], [pot[0] - 0.12, g + 0.48, pot[2] + 0.1]], 0.016, 0.08), { w: 6 });
  // blast pot: vertical vessel on three legs, dished top with fill cup, cone bottom into the metering valve
  m.push(pot);
  m.add(cyl(0.14, 0.32, 24), { p: [0, 0.4, 0], e: 2 }).add(dome(0.14), { p: [0, 0.56, 0], s: [1, 0.45, 1] }).add(new THREE.ConeGeometry(0.14, 0.14, 24, 1, true), { p: [0, 0.17, 0], r: [PI, 0, 0] });
  m.add(cyl(0.05, 0.05, 16), { p: [0, 0.64, 0], e: 2 }).add(tor(0.08, 0.008), { p: [0, 0.63, 0], r: UP, w: 2 });
  [0, 2.1, 4.2].forEach(a => rod(m, [Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12], [Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17], 0.01, { w: 2 }));
  m.add(box(0.07, 0.06, 0.07), { p: [0, 0.07, 0], e: 2 }).add(cyl(0.035, 0.12, 12), { p: [0.1, 0.48, -0.12], e: 1.5 });   // metering valve, moisture separator
  m.pop();
  // tow-behind air compressor: canopy, wheels, tow bar
  m.push(cmp, [0, PI / 2, 0]);
  m.add(box(0.36, 0.3, 0.62), { p: [0, 0.27, 0], e: 3, w: 1.4 }).add(box(0.37, 0.04, 0.63), { p: [0, 0.43, 0], e: 2 });
  for (let k = -2; k <= 2; k++) m.line([0.181, 0.2, k * 0.09], [0.181, 0.36, k * 0.09], 0.6);
  [-1, 1].forEach(sx => m.add(tor(0.09, 0.03), { p: [sx * 0.21, 0.09, 0], r: [0, PI / 2, 0], w: 2 }));
  rod(m, [0, 0.14, -0.31], [0, 0.1, -0.62], 0.012, { w: 2.5 }); m.add(tor(0.03, 0.008), { p: [0, 0.1, -0.64], r: UP, w: 2 }); rod(m, [0, 0.1, -0.55], [0, 0, -0.55], 0.01, { w: 2 });
  m.pop();
  return { m, hot: { enter: [2.0, 0.3, 0], a: [1.7, 1.2, 0.4], b: [-1.8, 0.2, 0.6], c: [1.6, -1.0, 0.9] } };
}

/* ---------- 4 · Industrial cleaning: vacuum truck and hydroblast crew ---------- */
function cleaning() {
  const m = new Model(), g = -1.5, wy = g + 0.24;
  m.add(box(3.1, 0.09, 0.5), { p: [-0.1, g + 0.46, 0], e: 2 }).add(box(0.1, 0.16, 0.95), { p: [1.52, g + 0.32, 0], e: 2 });
  [1.08, -0.72, -1.2].forEach(x => [-0.41, 0.41].forEach(z => { m.add(tor(0.16, 0.08), { p: [x, wy, z], w: 2.4 }).add(cyl(0.24, 0.17, 24), { p: [x, wy, z], r: AZ, w: 1.6, e: 2 }).add(new THREE.CircleGeometry(0.11, 16), { p: [x, wy, z + Math.sign(z) * 0.09], w: 2 }); for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; m.line([x, wy, z + Math.sign(z) * 0.09], [x + Math.cos(a) * 0.1, wy + Math.sin(a) * 0.1, z + Math.sign(z) * 0.09], 0.4); } }));
  [-0.72, -1.2].forEach(x => m.add(new THREE.CylinderGeometry(0.29, 0.29, 0.92, 16, 1, true, -PI / 2 + 0.2, PI - 0.4), { p: [x, wy, 0], r: [PI / 2, 0, 0], w: 0.7, e: 1.5 }));
  // cab
  m.add(extr([[0.75, g + 0.5], [1.5, g + 0.5], [1.5, g + 0.95], [1.4, g + 1.42], [0.75, g + 1.42]], 0.92), { e: 3 });
  m.poly([[1.47, g + 1.02, -0.38], [1.47, g + 1.02, 0.38], [1.41, g + 1.36, 0.38], [1.41, g + 1.36, -0.38]], 2.5, true);
  [-0.465, 0.465].forEach(z => { m.poly([[0.86, g + 1.0, z], [1.36, g + 1.0, z], [1.32, g + 1.36, z], [0.86, g + 1.36, z]], 2, true); m.poly([[0.84, g + 0.56, z], [1.38, g + 0.56, z], [1.38, g + 1.38, z], [0.84, g + 1.38, z]], 1, true); m.add(box(0.04, 0.2, 0.1), { p: [1.38, g + 1.2, z * 1.22], e: 2 }); });
  m.add(cyl(0.035, 0.75, 10), { p: [0.68, g + 1.3, 0.38] }).add(box(0.3, 0.42, 0.8), { p: [0.52, g + 0.72, 0], e: 2 });
  // debris tank with dished heads, rear door, bands, top manway
  const tx = -0.62, ty = g + 1.03, tr = 0.45;
  m.add(cyl(tr, 1.75, 44), { p: [tx, ty, 0], r: AX });
  [-1, 1].forEach(s => m.add(dome(tr), { p: [tx + s * 0.875, ty, 0], r: [0, 0, -s * PI / 2], s: [1, 0.35, 1] }));
  [-0.86, -0.4, 0.1, 0.6, 0.86].forEach(o => m.add(tor(tr + 0.006, 0.01), { p: [tx + o, ty, 0], r: [0, PI / 2, 0], w: 2.5 }));
  m.add(tor(tr * 0.72, 0.014), { p: [tx - 1.01, ty, 0], r: [0, PI / 2, 0], w: 3 }); for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; m.add(box(0.05, 0.05, 0.05), { p: [tx - 0.9, ty + Math.cos(a) * (tr + 0.02), Math.sin(a) * (tr + 0.02)], e: 2 }); }
  m.add(cyl(0.15, 0.1, 18), { p: [tx + 0.3, ty + tr + 0.03, 0] }).add(new THREE.CircleGeometry(0.15, 18), { p: [tx + 0.3, ty + tr + 0.08, 0], r: UP, w: 2 });
  [-0.3, 0.3].forEach(z => m.add(box(1.6, 0.14, 0.05), { p: [tx, g + 0.56, z], e: 1.5 }));
  // boom and suction hose down to a sump
  m.add(cyl(0.1, 0.16, 14), { p: [tx - 0.45, ty + tr + 0.06, 0] });
  m.add(pipeGeo([[tx - 0.45, ty + tr + 0.1, 0], [tx - 0.45, ty + tr + 0.42, 0], [tx - 0.45, ty + tr + 0.42, 1.05], [tx - 0.45, g + 0.12, 1.05]], 0.065, 0.2));
  for (let y = g + 0.2; y < ty + tr + 0.3; y += 0.07) m.add(tor(0.068, 0.006), { p: [tx - 0.45, y, 1.05], r: UP, w: 2 });
  m.add(ring(0.12, 0.3), { p: [tx - 0.45, g + 0.005, 1.05], r: UP, w: 2, e: 2 }).add(cyl(0.12, 0.1, 16), { p: [tx - 0.45, g - 0.05, 1.05] });
  // hydroblast crew: lance, hose from the truck, jet hitting a pipe flange
  person(m, [0.55, g, 1.15], PI / 2, 0.3); rod(m, [0.62, g + 0.32, 1.15], [1.05, g + 0.26, 1.15], 0.012, { w: 3 });
  m.poly([[0.3, g + 0.5, 0.3], [0.2, g + 0.02, 0.7], [0.45, g + 0.02, 1.0], [0.6, g + 0.3, 1.13]], 2);
  m.add(cyl(0.11, 0.7, 16), { p: [1.75, g + 0.26, 1.15], r: AX }); flange(m, [1.4, g + 0.26, 1.15], 'x', 0.11); m.add(box(0.08, 0.15, 0.3), { p: [1.8, g + 0.075, 1.15], e: 2 });
  m.add(new THREE.ConeGeometry(0.1, 0.32, 14, 4, true), { p: [1.21, g + 0.26, 1.15], r: [0, 0, PI / 2], w: 2.2, t: 2 }); cloud(m, [1.37, g + 0.28, 1.15], 0.13, 2.5, 2, [0.35, 1.2, 1.2]);
  return { m, hot: { enter: [2.2, 0.5, 0], a: [-0.6, 0.6, 0], b: [2.1, -0.9, 1.1], c: [-2.2, -0.5, 0.6] } };
}

/* ---------- 5 · Pipeline: mainline valve, pig launcher, field weld ---------- */
function pipeline() {
  const m = new Model(), g = -1.5, y = g + 0.42, r = 0.13;
  m.add(cyl(r, 3.2, 28), { p: [0.5, y, 0], r: AX });
  for (let x = -0.95; x <= 2.0; x += 0.59) m.add(tor(r + 0.004, 0.008), { p: [x, y, 0], r: [0, PI / 2, 0], w: 3 });
  for (let x = -1.7; x <= 1.9; x += 0.6) { m.add(box(0.14, 0.27, 0.5), { p: [x, g + 0.135, 0], e: 2 }); m.add(new THREE.CylinderGeometry(r + 0.015, r + 0.015, 0.14, 16, 1, true, PI * 0.7, PI * 0.6), { p: [x, y, 0], r: AX, w: 1.5 }); }
  // pig launcher: oversize barrel, eccentric reducer, quick-opening closure, kicker line
  m.add(cyl(0.2, 0.65, 28), { p: [-1.55, y, 0], r: AX }).add(new THREE.CylinderGeometry(r, 0.2, 0.2, 28, 1, true), { p: [-1.12, y, 0], r: [0, 0, -PI / 2] });
  m.add(cyl(0.24, 0.07, 28, false), { p: [-1.9, y, 0], r: AX, e: 2, w: 1.4 }).add(dome(0.2), { p: [-1.93, y, 0], r: [0, 0, PI / 2], s: [1, 0.4, 1] }); rod(m, [-1.92, y + 0.24, -0.26], [-1.92, y + 0.24, 0.1], 0.02, { w: 3 });
  m.add(pipeGeo([[-1.5, y, 0.2], [-1.5, y, 0.55], [-0.75, y, 0.55], [-0.75, y, 0.13]], 0.05, 0.14)); gateValve(m, [-1.12, y, 0.55], 'x', 0.05);
  rod(m, [-1.6, y + 0.2, 0], [-1.6, y + 0.48, 0], 0.03, { w: 2 }); m.add(cyl(0.05, 0.06, 12, false), { p: [-1.6, y + 0.5, 0], w: 2 });
  // mainline valve with bypass and blowdowns
  gateValve(m, [0.35, y, 0], 'x', r);
  m.add(pipeGeo([[-0.25, y + r, 0], [-0.25, y + 0.55, 0], [-0.25, y + 0.55, -0.42], [0.95, y + 0.55, -0.42], [0.95, y + 0.55, 0], [0.95, y + r, 0]], 0.04, 0.11)); gateValve(m, [0.35, y + 0.55, -0.42], 'x', 0.04);
  [-0.6, 1.35].forEach(x => { rod(m, [x, y + r, 0], [x, y + 0.62, 0], 0.04, { w: 1.6 }); m.add(sph(0.065), { p: [x, y + 0.42, 0] }); rod(m, [x, y + 0.42, 0], [x, y + 0.42, 0.14], 0.012, { w: 3 }); m.add(cyl(0.06, 0.03, 12, false), { p: [x, y + 0.63, 0], w: 2 }); });
  // station fence, markers
  const F = [[-0.85, 0.75], [1.6, 0.75], [1.6, -0.75], [-0.85, -0.75]];
  F.forEach((p, i) => { const q = F[(i + 1) % 4]; if (i !== 0) [0.3, 0.6].forEach(o => m.line([p[0], g + o, p[1]], [q[0], g + o, q[1]], 0.9)); for (let k = 0; k <= 4; k++) { const x = p[0] + (q[0] - p[0]) * k / 4, z = p[1] + (q[1] - p[1]) * k / 4; if (i !== 0) m.line([x, g, z], [x, g + 0.62, z], 0.9); } });
  [[-1.9, -0.6], [2.05, -0.6]].forEach(([x, z]) => { rod(m, [x, g, z], [x, g + 0.55, z], 0.014, { w: 2 }); m.add(box(0.02, 0.14, 0.11), { p: [x, g + 0.52, z], e: 2 }); });
  // field weld at the tie-in
  person(m, [1.98, g, 0.52], PI, 0.5, true); arc(m, [1.98, g + 0.51, 0.1]);
  m.add(box(0.3, 0.3, 0.44), { p: [1.1, g + 0.17, 1.05], e: 2.5 }); m.poly([[1.25, g + 0.25, 0.95], [1.5, g + 0.02, 0.85], [1.8, g + 0.02, 0.75], [1.95, g + 0.55, 0.35]], 2);
  m.add(cyl(r, 0.5, 28), { p: [2.3, y, 0], r: AX }); m.add(box(0.14, 0.27, 0.5), { p: [2.35, g + 0.135, 0], e: 2 });
  return { m, hot: { enter: [2.3, 0.6, 0], a: [0.2, 1.25, 0], b: [-1.7, 0.75, 0.3], c: [2.2, -0.35, 0.5] } };
}

/* ---------- 6 · Facility services: building, guard gate, grounds ---------- */
function facility() {
  const m = new Model(), g = -1.5, W = 2.3, H = 0.85, D = 1.15, bx = -0.35;
  m.add(box(W, H, D), { p: [bx, g + H / 2, 0], e: 3.5, w: 0.55 }).add(box(W + 0.08, 0.05, D + 0.08), { p: [bx, g + H + 0.025, 0], e: 3, w: 0.3 });
  const fz = D / 2 + 0.003, rect = (x, y, w, h, z, wt = 1.8) => m.poly([[x - w / 2, y - h / 2, z], [x + w / 2, y - h / 2, z], [x + w / 2, y + h / 2, z], [x - w / 2, y + h / 2, z]], wt, true);
  for (let i = 0; i < 7; i++) { const x = bx - W / 2 + 0.22 + i * 0.31; if (i === 3) { rect(x, g + 0.26, 0.24, 0.5, fz, 2.2); m.line([x, g + 0.02, fz], [x, g + 0.5, fz], 1.2); m.add(box(0.4, 0.02, 0.22), { p: [x, g + 0.56, fz + 0.1], e: 2 }); continue; } [0.24, 0.62].forEach(y => { rect(x, g + y, 0.2, 0.2, fz); m.line([x, g + y - 0.1, fz], [x, g + y + 0.1, fz], 0.6); }); }
  for (let i = 0; i < 3; i++) [0.24, 0.62].forEach(y => { const z = -0.32 + i * 0.32; m.poly([[bx + W / 2 + 0.003, g + y - 0.1, z - 0.1], [bx + W / 2 + 0.003, g + y - 0.1, z + 0.1], [bx + W / 2 + 0.003, g + y + 0.1, z + 0.1], [bx + W / 2 + 0.003, g + y + 0.1, z - 0.1]], 1.8, true); });
  [[bx - 0.6, -0.15], [bx + 0.35, 0.1]].forEach(([x, z]) => { m.add(box(0.42, 0.2, 0.34), { p: [x, g + H + 0.15, z], e: 2.5 }); m.add(tor(0.1, 0.008), { p: [x, g + H + 0.252, z], r: UP, w: 2.5 }); m.line([x - 0.1, g + H + 0.252, z], [x + 0.1, g + H + 0.252, z]).line([x, g + H + 0.252, z - 0.1], [x, g + H + 0.252, z + 0.1]); });
  rod(m, [bx + 0.9, g + H + 0.05, -0.3], [bx + 0.9, g + H + 0.4, -0.3], 0.03, { w: 2 });
  // guard booth and barrier arm
  m.add(box(0.36, 0.5, 0.36), { p: [1.55, g + 0.25, 0.95], e: 3, w: 0.8 }).add(box(0.5, 0.035, 0.5), { p: [1.55, g + 0.52, 0.95], e: 2.5 }); rect(1.55, g + 0.34, 0.26, 0.18, 0.95 + 0.183);
  m.add(box(0.07, 0.24, 0.07), { p: [1.2, g + 0.12, 1.3], e: 2 }); rod(m, [1.2, g + 0.22, 1.3], [0.05, g + 0.5, 1.3], 0.014, { w: 3 }); for (let k = 1; k < 6; k++) m.add(cyl(0.02, 0.05, 6), { p: [1.2 - k * 0.19, g + 0.22 + k * 0.047, 1.3], r: [0, 0, 1.33], w: 3 });
  person(m, [1.3, g, 0.95], -PI / 2, 0.3);
  // grounds: walkway, lawn, trees, hedges, light pole, flag
  m.add(new THREE.PlaneGeometry(0.3, 0.8), { p: [bx + 0.08, g + 0.004, D / 2 + 0.4], r: UP, w: 0.6, e: 1.5 }).add(new THREE.CircleGeometry(2.05, 40), { p: [0.1, g + 0.001, 0.25], r: UP, w: 0.09 });
  [[-1.95, -0.2, 0.32], [-1.85, 0.75, 0.22], [1.25, -0.7, 0.34], [1.85, -0.25, 0.24]].forEach(([x, z, cr]) => { rod(m, [x, g, z], [x, g + cr * 1.7, z], 0.03, { w: 1.6 }); m.add(new THREE.IcosahedronGeometry(cr, 2), { p: [x, g + cr * 2.2, z], s: [1, 1.15, 1], w: 0.55 }).add(new THREE.IcosahedronGeometry(cr * 0.7, 1), { p: [x + cr * 0.4, g + cr * 1.8, z + cr * 0.2], w: 0.55 }); });
  for (let k = 0; k < 5; k++) if (k !== 2) m.add(sph(0.09), { p: [bx - 0.75 + k * 0.38, g + 0.07, D / 2 + 0.16], s: [1.7, 0.9, 1], w: 1.2 });
  rod(m, [0.75, g, 1.0], [0.75, g + 1.25, 1.0], 0.016, { w: 2 }); m.line([0.75, g + 1.25, 1.0], [0.5, g + 1.28, 1.0], 2).add(box(0.14, 0.03, 0.07), { p: [0.5, g + 1.27, 1.0], e: 2 });
  rod(m, [-1.2, g, 0.72], [-1.2, g + 1.5, 0.72], 0.012, { w: 2 }); m.add(new THREE.PlaneGeometry(0.34, 0.2, 6, 2), { p: [-1.02, g + 1.38, 0.72], w: 2, e: 1.5 });
  return { m, hot: { enter: [2.2, 0.6, 0], a: [-0.4, 0.75, 0], b: [2.2, -0.6, 1.0], c: [-2.2, -0.2, 0.9] } };
}

/* ---------- 7 · Locations: Gulf Coast map ---------- */
/* ---------- Safety: worker in full PPE climbing a caged ladder, spotter at the base ---------- */
// a worker built from joints: red coveralls (tint 1), hard hat with brim and ridge, safety glasses, blue ear muffs (tint 2)
function worker(m, base, ry, J) {
  m.push(base, [0, ry, 0]);
  const limb = (a, b, r, t = 1, w = 2.4) => { rod(m, a, b, r, { w, t }); m.add(sph(r), { p: b, w: w * 0.6, t }); };
  limb(J.hipL, J.kneeL, 0.06); limb(J.kneeL, J.footL, 0.05); limb(J.hipR, J.kneeR, 0.06); limb(J.kneeR, J.footR, 0.05);
  [J.footL, J.footR].forEach(f => m.add(box(0.1, 0.07, 0.2), { p: [f[0], f[1] - 0.02, f[2] + (J.toe || 0.05)], w: 2.6 }));
  m.add(new THREE.CapsuleGeometry(0.15, 0.32, 4, 12), { p: J.chest, r: J.lean || [0, 0, 0], s: [1, 1, 0.72], w: 2.4, t: 1 });
  [[J.shL, J.elL, J.hdL], [J.shR, J.elR, J.hdR]].forEach(([a, b, c]) => { limb(a, b, 0.045); limb(b, c, 0.04); m.add(sph(0.045), { p: c, w: 2.5 }); });
  // reflective bands on the coveralls
  [[J.elL, J.hdL], [J.elR, J.hdR], [J.kneeL, J.footL], [J.kneeR, J.footR]].forEach(([a, b]) => { const q = a.map((v, k) => v + (b[k] - v) * 0.45); m.add(sph(0.055), { p: q, s: [1, 0.35, 1], w: 3 }); });
  const h = J.head, hr = 0.105;
  m.add(sph(hr), { p: h, w: 2.4 });
  m.push(h, J.tilt || [0, 0, 0]);
  m.add(dome(hr * 1.18), { p: [0, 0.035, 0], s: [1, 0.9, 1.12], w: 3 });                                           // hard hat shell
  m.add(new THREE.TorusGeometry(hr * 1.12, 0.012, 6, 24, PI), { p: [0, 0.035, 0], r: [0, PI / 2, 0], s: [1, 0.92, 1.12], w: 3.5 });   // ridge
  m.add(ring(hr * 1.12, hr * 1.42), { p: [0, 0.035, 0.03], r: UP, s: [1, 1.28, 1], w: 3 });                            // brim with front peak
  m.add(box(0.17, 0.035, 0.012), { p: [0, -0.005, hr * 0.98], e: 3, w: 3 });                                         // safety glasses
  [-1, 1].forEach(sx => m.add(cyl(0.045, 0.045, 14), { p: [sx * hr * 1.02, -0.02, 0], r: AX, w: 4, t: 2 }));           // ear muffs
  m.pop();
  return m.pop();
}
function safety() {
  const m = new Model(), g = -1.5, top = g + 3.6, R = 0.22;
  // fixed ladder with safety cage up to a platform
  [-R, R].forEach(x => rod(m, [x, g, 0], [x, top + 1.05, 0], 0.025, { w: 2.4 }));
  for (let y = g + 0.3; y < top + 0.05; y += 0.3) rod(m, [-R, y, 0], [R, y, 0], 0.014, { w: 2 });
  for (let y = g + 2.05; y <= top + 1.0; y += 0.5) m.add(new THREE.TorusGeometry(0.4, 0.016, 6, 40, PI * 1.62), { p: [0, y, 0.37], r: [PI / 2, 0, -PI * 0.31 + PI], w: 2.2 });
  [-0.5, -0.2, 0.2, 0.5].forEach(a => { const x = Math.sin(a * 2.2) * 0.4, z = 0.37 + Math.cos(a * 2.2) * 0.4; rod(m, [x, g + 2.05, z], [x, top + 1.0, z], 0.01, { w: 1.6 }); });
  // platform: grating, toe plate, top and mid rails, self-closing gate at the ladder
  m.add(box(1.8, 0.04, 1.3), { p: [0, top, -0.65], e: 3, w: 0.5 }); for (let k = 1; k < 12; k++) m.line([-0.9 + k * 0.15, top + 0.021, -1.3], [-0.9 + k * 0.15, top + 0.021, 0], 0.5);
  [[-0.9, -1.3], [0.9, -1.3], [0.9, 0], [-0.9, 0]].forEach(([x, z]) => { rod(m, [x, g, z], [x, top + 1.05, z], 0.03, { w: 2 }); m.add(box(0.16, 0.03, 0.16), { p: [x, g + 0.015, z], e: 2 }); });
  const rail = (a, b) => [1.05, 0.53].forEach(o => rod(m, [a[0], top + o, a[1]], [b[0], top + o, b[1]], 0.016, { w: 2 }));
  rail([-0.9, 0], [-0.9, -1.3]); rail([-0.9, -1.3], [0.9, -1.3]); rail([0.9, -1.3], [0.9, 0]); rail([-0.9, 0], [-R - 0.05, 0]); rail([R + 0.05, 0], [0.9, 0]);
  [[-0.9, -1.3, 0.9, -1.3], [0.9, -1.3, 0.9, 0], [-0.9, 0, -0.9, -1.3]].forEach(([x0, z0, x1, z1]) => m.add(box(Math.abs(x1 - x0) || 0.01, 0.1, Math.abs(z1 - z0) || 0.01), { p: [(x0 + x1) / 2, top + 0.07, (z0 + z1) / 2], e: 2, w: 0.4 }));
  rod(m, [-R + 0.02, top + 0.95, -0.05], [R - 0.02, top + 0.95, -0.25], 0.014, { w: 3 }); rod(m, [-R + 0.02, top + 0.5, -0.05], [R - 0.02, top + 0.5, -0.25], 0.014, { w: 3 });
  // process piping behind the structure, on supports
  [[g + 2.2, -1.75, 0.11], [g + 2.6, -1.75, 0.08]].forEach(([y, z, r]) => m.add(cyl(r, 4.2, 18), { p: [0, y, z], r: AX, w: 0.8 }));
  m.add(cyl(0.09, 3.2, 18), { p: [1.6, g + 1.6, -1.3], w: 0.8 });
  [-1.7, 1.2].forEach(x => { rod(m, [x, g, -1.75], [x, g + 2.75, -1.75], 0.035, { w: 2 }); m.add(box(0.18, 0.03, 0.18), { p: [x, g + 0.015, -1.75], e: 2 }); [g + 2.08, g + 2.51].forEach(y => m.add(box(0.06, 0.04, 0.42), { p: [x, y, -1.75], e: 2 })); });   // pipe supports
  m.add(box(0.22, 0.03, 0.22), { p: [1.6, g + 0.015, -1.3], e: 2 });
  // climber: three points of contact, hard hat, glasses, ear muffs, red coveralls
  worker(m, [0, g + 0.45, 0.3], PI, { hipL: [-0.1, 0.95, 0], hipR: [0.1, 0.95, 0], kneeL: [-0.12, 1.2, 0.3], footL: [-0.12, 0.79, 0.3], kneeR: [0.11, 0.52, 0.12], footR: [0.11, 0.17, 0.28],
    chest: [0, 1.22, 0.07], lean: [0.2, 0, 0], shL: [-0.19, 1.42, 0.1], elL: [-0.27, 1.38, 0.3], hdL: [-0.21, 1.58, 0.3], shR: [0.19, 1.42, 0.1], elR: [0.25, 1.7, 0.2], hdR: [0.19, 1.96, 0.3],
    head: [0, 1.64, 0.06], tilt: [-0.25, 0.5, 0] });
  // spotter at the base, looking up, clipboard
  worker(m, [1.05, g, 0.95], -2.5, { hipL: [-0.1, 0.92, 0], hipR: [0.1, 0.92, 0], kneeL: [-0.11, 0.48, 0.02], footL: [-0.12, 0.06, 0], kneeR: [0.11, 0.48, 0.02], footR: [0.12, 0.06, 0],
    chest: [0, 1.2, 0], shL: [-0.2, 1.42, 0], elL: [-0.24, 1.15, 0.1], hdL: [-0.08, 1.05, 0.25], shR: [0.2, 1.42, 0], elR: [0.24, 1.15, 0.05], hdR: [0.12, 1.02, 0.22],
    head: [0, 1.62, 0.02], tilt: [-0.45, 0, 0] });
  m.push([1.05, g, 0.95], [0, -2.5, 0]); m.add(box(0.24, 0.32, 0.015), { p: [0.02, 1.08, 0.27], r: [-0.9, 0, 0], e: 3, w: 2.5 }); m.pop();
  return { m, hot: { enter: [2.2, 0.6, 0], a: [-0.5, 0.6, 0.6], b: [1.6, -0.8, 1.0], c: [0, 1.6, -0.8] } };
}

/* ---------- Quality: weld under inspection on a spool, code vessel with nameplate ---------- */
function quality() {
  const m = new Model(), g = -1.5, y = g + 0.75, rp = 0.2;
  m.add(pipeGeo([[-1.7, y, 0.2], [0.95, y, 0.2], [0.95, y + 1.0, 0.2]], rp, 0.4), { w: 1 });
  flange(m, [-1.7, y, 0.2], 'x', rp); flange(m, [0.95, y + 1.0, 0.2], 'y', rp);
  m.add(tor(rp + 0.006, 0.028), { p: [-0.35, y, 0.2], r: [0, PI / 2, 0], w: 6, t: 1 });                                  // girth weld being inspected
  m.add(tor(rp + 0.006, 0.02), { p: [0.55, y, 0.2], r: [0, PI / 2, 0], w: 3 });
  [-1.25, 0.35].forEach(x => { rod(m, [x, g, 0.2], [x, y - rp, 0.2], 0.03, { w: 2 }); m.add(box(0.3, 0.03, 0.3), { p: [x, g + 0.015, 0.2], e: 2 }); m.add(new THREE.CylinderGeometry(rp + 0.03, rp + 0.03, 0.12, 16, 1, true, PI * 0.6, PI * 0.8), { p: [x, y, 0.2], r: AX, w: 2 }); });
  // inspector at the weld with a light
  person(m, [-0.35, g, 0.95], PI, 0.32);
  rod(m, [-0.35 + 0.06, g + 0.42, 0.95 - 0.05], [-0.33, g + 0.5, 0.62], 0.014, { w: 4 }); m.add(cyl(0.02, 0.09, 10), { p: [-0.33, g + 0.51, 0.58], r: AZ, w: 4 });
  for (let k = 0; k < 6; k++) m.line([-0.33, g + 0.51, 0.53], [-0.35 + (k - 2.5) * 0.03, y - 0.05 + (k % 2) * 0.1, 0.2 + rp + 0.02], 0.4, 1);
  // code vessel behind on saddles, with nameplate
  const vy = g + 0.55, vz = -1.05;
  m.add(cyl(0.42, 1.7, 36), { p: [0, vy, vz], r: AX }).add(dome(0.42), { p: [0.85, vy, vz], r: [0, 0, -PI / 2], s: [1, 0.5, 1] }).add(dome(0.42), { p: [-0.85, vy, vz], r: [0, 0, PI / 2], s: [1, 0.5, 1] });
  [-0.5, 0.5].forEach(x => m.add(box(0.12, 0.2, 0.7), { p: [x, g + 0.1, vz], e: 2.5 }));
  m.add(box(0.3, 0.2, 0.01), { p: [0.15, vy + 0.08, vz + 0.43], r: [-0.2, 0, 0], e: 4, w: 2.5 }); for (let k = 0; k < 4; k++) m.line([0.04, vy + 0.13 - k * 0.04, vz + 0.445], [0.26, vy + 0.13 - k * 0.04, vz + 0.445], 1.2);
  m.add(cyl(0.08, 0.22, 16), { p: [-0.3, vy + 0.52, vz] }); flange(m, [-0.3, vy + 0.62, vz], 'y', 0.08);
  return { m, hot: { enter: [2.2, 0.6, 0], a: [-0.4, 0.3, 0.6], b: [0.2, -0.5, -1.0], c: [1.8, 0.7, 0.2] } };
}

/* ---------- Experience: crawler crane setting a pipe module on its pad ---------- */
function experience() {
  const m = new Model(), g = -1.5;
  [-0.45, 0.45].forEach(z => { m.add(box(1.6, 0.22, 0.3), { p: [-1.1, g + 0.11, z], e: 3, w: 1 }); for (let k = 0; k < 12; k++) m.line([-1.85 + k * 0.135, g + 0.22, z - 0.15], [-1.85 + k * 0.135, g + 0.22, z + 0.15], 0.6); });
  m.add(box(1.05, 0.38, 0.8), { p: [-1.15, g + 0.42, 0], e: 3, w: 1 }).add(box(0.36, 0.34, 0.3), { p: [-0.7, g + 0.78, 0.25], e: 3, w: 1.2 }).add(box(0.36, 0.42, 0.78), { p: [-1.6, g + 0.82, 0], e: 3, w: 1 });
  const P0 = new THREE.Vector3(-0.8, g + 0.65, 0), P1 = new THREE.Vector3(0.75, g + 2.85, 0), ax = P1.clone().sub(P0), L = ax.length(), dir = ax.clone().normalize(), nrm = new THREE.Vector3(-dir.y, dir.x, 0);
  const C = [[0.13, 0.1], [-0.13, 0.1], [0.13, -0.1], [-0.13, -0.1]].map(([zz, nn]) => t => P0.clone().addScaledVector(dir, t).addScaledVector(nrm, nn).add(new THREE.Vector3(0, 0, zz)).toArray());
  C.forEach(c => rod(m, c(0), c(L), 0.014, { w: 2.2 }));
  for (let k = 0; k < 16; k++) { const t0 = k / 16 * L, t1 = (k + 1) / 16 * L; [[0, 1], [2, 3], [0, 2], [1, 3]].forEach(([a, b]) => m.line(C[a](k % 2 ? t0 : t1), C[b](k % 2 ? t1 : t0), 1.3)); }
  m.line([-1.6, g + 1.05, 0], P1.toArray(), 1.2).line([-1.6, g + 1.05, 0.05], [-0.6, g + 1.95, 0.05], 0.8);                        // pendant lines
  const hook = [P1.x, g + 1.7, 0]; m.line(P1.toArray(), hook, 2.2).line([P1.x + 0.04, P1.y, 0], [hook[0] + 0.04, hook[1], 0], 2.2); m.add(box(0.12, 0.16, 0.08), { p: hook, e: 3, w: 2 });
  // module: steel frame with piping inside, hanging over its pad
  const mx = P1.x, my = g + 0.95, W = 1.0, H = 0.5, D = 0.7;
  m.add(box(W, H, D), { p: [mx, my, 0], e: 5, w: 0 }); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => m.line(hook, [mx + a * W / 2, my + H / 2, b * D / 2], 1.6));
  m.add(new THREE.PlaneGeometry(W, D), { p: [mx, my - H / 2, 0], r: UP, w: 0.3 });
  [[-0.12, 0.06], [0.1, 0.05], [0.0, 0.04]].forEach(([zz, rr], k) => m.add(cyl(rr, W * 0.96, 14), { p: [mx, my - 0.12 + k * 0.13, zz * 2], r: AX }));
  m.add(cyl(0.12, 0.3, 20), { p: [mx + 0.25, my - 0.08, 0.15] }); gateValve(m, [mx - 0.2, my + 0.14, 0.0], 'x', 0.035);
  m.add(box(1.25, 0.06, 0.95), { p: [mx, g + 0.03, 0], e: 3, w: 0.8 }); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => m.add(cyl(0.012, 0.08, 6), { p: [mx + a * 0.45, g + 0.09, b * 0.3], w: 3 }));
  // riggers on the tag lines
  person(m, [1.75, g, 0.75], -2.2, 0.3); person(m, [-0.1, g, 0.95], 2.4, 0.3);
  m.line([mx + W / 2, my - H / 2, D / 2], [1.68, g + 0.35, 0.7], 1.2).line([mx - W / 2, my - H / 2, D / 2], [-0.04, g + 0.35, 0.88], 1.2);
  return { m, hot: { enter: [2.2, 0.7, 0], a: [0.7, 0.2, 0.6], b: [-1.6, -0.6, 0.6], c: [0.6, 1.4, 0] } };
}

/* ---------- Careers: the crew in front of the job trailer ---------- */
function careers() {
  const m = new Model(), g = -1.5, ty = g + 0.25, TW = 2.6, TH = 0.95, TD = 0.85, tz = -1.0;
  m.add(box(TW, TH, TD), { p: [0, ty + TH / 2, tz], e: 4, w: 0.6 }).add(box(TW + 0.06, 0.04, TD + 0.06), { p: [0, ty + TH + 0.02, tz], e: 2.5 });
  [-1.1, -0.4, 0.4, 1.1].forEach(x => m.add(box(0.14, 0.25, 0.14), { p: [x, g + 0.125, tz], e: 2 }));
  const fz = tz + TD / 2 + 0.004, rect = (x, y, w, h) => m.poly([[x - w / 2, y - h / 2, fz], [x + w / 2, y - h / 2, fz], [x + w / 2, y + h / 2, fz], [x - w / 2, y + h / 2, fz]], 2, true);
  [-0.95, -0.45, 0.55, 1.05].forEach(x => { rect(x, ty + 0.6, 0.34, 0.26); m.line([x, ty + 0.47, fz], [x, ty + 0.73, fz], 0.8); });
  rect(0.05, ty + 0.4, 0.26, 0.66); m.add(box(0.5, 0.03, 0.3), { p: [0.05, ty + 0.0, fz + 0.18], e: 2 }); [0.08, 0.16].forEach((y, k) => m.add(box(0.4, 0.025, 0.12), { p: [0.05, g + y, fz + 0.38 + k * -0.1], e: 2 }));
  m.add(box(0.7, 0.18, 0.02), { p: [-0.7, ty + 0.88 + 0.12, fz], e: 3, w: 2, t: 1 });                                     // company sign
  // crew in a shallow arc (one welder, hood down), gang box
  [[-1.4, 0.35, 0.35], [-0.7, 0.62, 0.15], [0, 0.72, 0], [0.7, 0.62, -0.15], [1.4, 0.35, -0.35]].forEach(([x, z, ry], k) => person(m, [x, g, z], ry, 0.36, k === 3));
  m.add(box(0.6, 0.32, 0.36), { p: [1.85, g + 0.16, 0.9], e: 3, w: 1 }).add(box(0.62, 0.04, 0.38), { p: [1.85, g + 0.34, 0.9], e: 2 });
  return { m, hot: { enter: [2.2, 0.6, 0], a: [0, 0.5, 0.7], b: [-1.2, 0.9, -1.0], c: [1.9, -0.6, 0.9] } };
}

export const CITIES = [['Port Lavaca', -96.63, 28.61, 1], ['Corpus Christi', -97.40, 27.80], ['Victoria', -97.00, 28.81], ['Freeport', -95.36, 28.95], ['Deer Park', -95.12, 29.70], ['Houston', -95.37, 29.76], ['Lake Charles', -93.22, 30.23], ['Baton Rouge', -91.15, 30.45], ['Mobile', -88.04, 30.69], ['Clarendon, Jamaica', -77.25, 17.95]];
const PX = lon => (lon + 92) * 0.19, PY = lat => (lat - 27.2) * 0.19 * 1.13;
// Jamaica is far off the Gulf Coast frame, so it is drawn as an enlarged inset in the Gulf
const JM = { lo: -89.3, la: 25.3, k: 2.3 }, LL = (lo, la) => (lo > -80 && la < 20) ? [PX(JM.lo + (lo + 77.3) * JM.k), PY(JM.la + (la - 18.1) * JM.k)] : [PX(lo), PY(la)];
function gulfMap(N) {
  const pos = new Float32Array(N * 3), tint = new Float32Array(N); let i = 0;
  const polys = GULF.filter(o => !(o.s === 'FL' && o.r.length < 20)).map(o => { const r = o.r.map(p => o.s === 'JM' ? LL(p[0], p[1]) : [PX(p[0]), PY(p[1])]); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, len = 0; r.forEach((p, k) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); if (k) len += Math.hypot(p[0] - r[k - 1][0], p[1] - r[k - 1][1]); }); return { r, x0, x1, y0, y1, len, area: (x1 - x0) * (y1 - y0), s: o.s }; });
  const inside = (r, x, y) => { let c = false; for (let a = 0, b = r.length - 1; a < r.length; b = a++) if ((r[a][1] > y) !== (r[b][1] > y) && x < (r[b][0] - r[a][0]) * (y - r[a][1]) / (r[b][1] - r[a][1]) + r[a][0]) c = !c; return c; };
  const put = (x, y, z, t) => { if (i >= N) return; pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; tint[i++] = t; };
  const nCity = Math.floor(N * 0.02), nEdge = Math.floor(N * 0.3), nFill = N - nCity - nEdge - Math.floor(N * 0.012);
  const totL = polys.reduce((s, p) => s + p.len, 0), totA = polys.reduce((s, p) => s + p.area * (p.s === 'JM' ? 3 : 1), 0);
  polys.forEach(p => { const n = Math.round(nEdge * p.len / totL); for (let k = 0; k < n; k++) { const j = 1 + ((R() * (p.r.length - 1)) | 0), u = R(), a = p.r[j - 1], b = p.r[j]; put(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, (R() - 0.5) * 0.05, 0); } });
  polys.forEach(p => { const n = Math.round(nFill * p.area * (p.s === 'JM' ? 3 : 1) / totA); let k = 0, guard = 0; while (k < n && guard++ < n * 40) { const x = p.x0 + R() * (p.x1 - p.x0), y = p.y0 + R() * (p.y1 - p.y0); if (inside(p.r, x, y)) { put(x, y, (R() - 0.5) * 0.03, 0); k++; } } });
  const per = Math.floor(nCity / CITIES.length);
  CITIES.forEach(([, lo, la, hq]) => { for (let k = 0; k < per; k++) { const a = R() * PI * 2, rr = Math.sqrt(R()) * (hq ? 0.045 : 0.032); const q = LL(lo, la); put(q[0] + Math.cos(a) * rr, q[1] + Math.sin(a) * rr, 0.03, 1); } });
  { const x0 = PX(JM.lo - 3.5), x1 = PX(JM.lo + 3.5), y0 = PY(JM.la - 1.7), y1 = PY(JM.la + 1.9), n = Math.floor(N * 0.012); for (let k = 0; k < n; k++) { const u = R(), e = (R() * 4) | 0; put(e < 2 ? x0 + (x1 - x0) * u : e === 2 ? x0 : x1, e === 0 ? y0 : e === 1 ? y1 : y0 + (y1 - y0) * u, 0.02, 0); } }
  while (i < N) { const j = (R() * i) | 0; put(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2], tint[j]); }
  const bx0 = PX(-100.4), bx1 = PX(-85.6), by0 = PY(23.4), by1 = PY(33.7);      // frame the working coast; west Texas and Florida run past the edges
  const c = [(bx0 + bx1) / 2, (by0 + by1) / 2, 0], s = Math.min(4.3 / (bx1 - bx0), 3.0 / (by1 - by0));
  for (let k = 0; k < N; k++) { pos[k * 3] = (pos[k * 3] - c[0]) * s; pos[k * 3 + 1] = (pos[k * 3 + 1] - c[1]) * s; pos[k * 3 + 2] *= s; }
  const xf = p => [(p[0] - c[0]) * s, (p[1] - c[1]) * s, p[2] * s];
  // which state a point of the finished map lies in (model x, y), for tap-to-zoom; the Jamaica inset box counts as JM
  const state = (x, y) => { const X = x / s + c[0], Y = y / s + c[1]; if (X > PX(JM.lo - 3.5) && X < PX(JM.lo + 3.5) && Y > PY(JM.la - 1.7) && Y < PY(JM.la + 1.9)) return 'JM'; for (const q of polys) if (X >= q.x0 && X <= q.x1 && Y >= q.y0 && Y <= q.y1 && inside(q.r, X, Y)) return q.s; return null; };
  return { pos, tint, xf, state, city: (lo, la) => xf([...LL(lo, la), 0.04]) };
}

const BUILDERS = [refinery, mechanical, civilWork, softCraft, cleaning, pipeline, facility, safety, quality, experience, careers];
export function buildAll(N) {
  const out = BUILDERS.map(fn => { const { m, hot } = fn(), b = m.ground().build(N); const H = {}; for (const k in hot) H[k] = hot[k]; return { pos: b.pos, tint: b.tint, hot: H }; });
  const g = gulfMap(N); out.push({ pos: g.pos, tint: g.tint, city: g.city, state: g.state, hot: { enter: [2.2, 0.9, 0], a: g.city(-95.9, 26.3), b: g.city(-99.4, 23.2) }, flat: true });
  return out;
}
