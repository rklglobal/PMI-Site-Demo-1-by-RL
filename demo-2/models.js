import * as THREE from 'three';
import { GULF } from './gulf.js?v=9';

/* Surface-sampled point clouds: models are built from real meshes, then particles are
   scattered over their triangles (area-weighted) and along feature edges. */
const PI = Math.PI, R = Math.random;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export class Model {
  constructor() { this.wm = 1; this.T = []; this.TW = []; this.TT = []; this.S = []; this.SW = []; this.ST = []; this.stack = [new THREE.Matrix4()]; }
  push(p = [0, 0, 0], r = [0, 0, 0], s = 1) { const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(s, s, s)); this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m)); return this; }
  pop() { this.stack.pop(); return this; }
  add(geo, { p = [0, 0, 0], r = [0, 0, 0], s = 1, w = 1, t = 0, e = 0, ea = 25 } = {}) {
    const sc = Array.isArray(s) ? s : [s, s, s];
    const m = this.stack[this.stack.length - 1].clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...sc)));
    if (w > 0) {
      w *= this.wm;
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
  _seg(a, b, w, t) { this.S.push(a.x, a.y, a.z, b.x, b.y, b.z); this.SW.push(a.distanceTo(b) * 0.035 * w * this.wm); this.ST.push(t); }
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
    return { pos, tint, cs: [c.x, c.y, c.z, s], xf: p => [(p[0] - c.x) * s, (p[1] - c.y) * s, (p[2] - c.z) * s] };
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
  // abrasive blaster on the first deck, front face: plain (untinted) hood and cape, no red on the worker, nozzle aimed down at the shell; blasted band shows red
  const bx = 0.22, by = g + 1.135, bz = h - 0.12;
  m.push([bx, by, bz], [0, PI, 0], 0.3);
  [-0.1, 0.1].forEach(x => m.add(cyl(0.065, 0.8, 10), { p: [x, 0.4, 0], w: 5 }));
  m.add(new THREE.CapsuleGeometry(0.17, 0.36, 4, 12), { p: [0, 1.12, 0], s: [1, 1, 0.7], w: 5 });
  rod(m, [-0.24, 1.3, 0], [-0.06, 1.05, 0.36], 0.05, { w: 5 }); rod(m, [0.24, 1.3, 0], [0.06, 1.12, 0.3], 0.05, { w: 5 });
  m.add(new THREE.CylinderGeometry(0.13, 0.25, 0.34, 16, 1, true), { p: [0, 1.42, 0], w: 6 }).add(dome(0.14), { p: [0, 1.56, 0], w: 6 }).add(box(0.2, 0.1, 0.04), { p: [0, 1.57, 0.12], e: 3, w: 1 });   // blast hood with cape, visor
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
  const m = new Model(), g = -1.5, FH = 0.6, BW = 2.8, BD = 1.1, bx = -0.55, bz = -0.95, fz = bz + BD / 2 + 0.004;
  // two-storey office building: curtain wall with mullions and spandrel bands, glass lobby atrium, canopy, parapet, rooftop units
  m.add(box(BW, 2 * FH, BD), { p: [bx, g + FH, bz], e: 3.5, w: 0.22 });
  m.add(box(BW + 0.05, 0.08, BD + 0.05), { p: [bx, g + 2 * FH + 0.04, bz], e: 2.5, w: 0.4 });
  [FH, 2 * FH - 0.04].forEach(y => m.add(box(BW + 0.01, 0.07, 0.02), { p: [bx, g + y, fz], e: 2, w: 1 }));
  for (let x = bx - BW / 2 + 0.2; x < bx + BW / 2 - 0.1; x += 0.2) { if (Math.abs(x - bx) < 0.42) continue; m.line([x, g + 0.02, fz + 0.005], [x, g + 2 * FH, fz + 0.005], 1.3); }
  for (let z = bz - BD / 2 + 0.2; z < bz + BD / 2; z += 0.2) [-1, 1].forEach(sx => m.line([bx + sx * (BW / 2 + 0.004), g, z], [bx + sx * (BW / 2 + 0.004), g + 2 * FH, z], 1));
  const ax = bx, aw = 0.8, ah = 2 * FH + 0.35, azf = fz + 0.16;
  m.add(box(aw, ah, 0.32), { p: [ax, g + ah / 2, fz], e: 4, w: 0.3 });                                          // atrium
  for (let k = 1; k < 8; k++) m.line([ax - aw / 2 + k * aw / 8, g + 0.38, azf + 0.002], [ax - aw / 2 + k * aw / 8, g + ah, azf + 0.002], 1.4);
  for (let y = 0.38; y < ah; y += 0.22) m.line([ax - aw / 2, g + y, azf + 0.002], [ax + aw / 2, g + y, azf + 0.002], 0.9);
  m.add(box(1.1, 0.04, 0.5), { p: [ax, g + 0.38, azf + 0.22], e: 3, w: 1.2 }); [-0.45, 0.45].forEach(o => rod(m, [ax + o, g, azf + 0.42], [ax + o, g + 0.36, azf + 0.42], 0.014, { w: 2.5 }));   // entrance canopy on columns
  m.poly([[ax - 0.18, g, azf + 0.004], [ax - 0.18, g + 0.3, azf + 0.004], [ax + 0.18, g + 0.3, azf + 0.004], [ax + 0.18, g, azf + 0.004]], 2.2); m.line([ax, g, azf + 0.004], [ax, g + 0.3, azf + 0.004], 1.5);   // doors
  [[bx - 0.9, bz - 0.1], [bx + 0.75, bz + 0.15]].forEach(([x, z]) => { m.add(box(0.42, 0.2, 0.32), { p: [x, g + 2 * FH + 0.18, z], e: 2.5, w: 0.6 }); m.add(tor(0.1, 0.008), { p: [x, g + 2 * FH + 0.282, z], r: UP, w: 2.5 }); });
  m.add(box(0.34, 0.26, 0.3), { p: [bx + 1.1, g + 2 * FH + 0.21, bz - 0.25], e: 2.5, w: 0.5 });
  // grounds: walk, lawn with mowing stripes (half done), hedges, trees, flagpoles, monument sign
  m.add(new THREE.PlaneGeometry(0.42, 1.45), { p: [ax, g + 0.003, azf + 0.95], r: UP, w: 0.35, e: 1.5 });
  const L0 = -2.35, L1 = ax - 0.3, Z0 = fz + 0.25, Z1 = 1.65;
  m.add(new THREE.PlaneGeometry(L1 - L0, Z1 - Z0), { p: [(L0 + L1) / 2, g + 0.001, (Z0 + Z1) / 2], r: UP, w: 0.05 });
  for (let z = Z0 + 0.06; z < Z1; z += 0.12) m.line([L0, g + 0.004, z], [z < 1.05 ? L1 : -1.45, g + 0.004, z], 0.5);
  m.add(new THREE.PlaneGeometry(1.25, Z1 - Z0), { p: [ax + 0.95, g + 0.001, (Z0 + Z1) / 2], r: UP, w: 0.05 });
  for (let k = 0; k < 9; k++) { const x = bx - BW / 2 + 0.1 + k * 0.3; if (Math.abs(x - ax) < 0.5) continue; m.add(sph(0.08), { p: [x, g + 0.06, fz + 0.12], s: [1.9, 0.85, 1], w: 1 }); }
  const tree = (x, z, cr) => { rod(m, [x, g, z], [x, g + cr * 1.6, z], 0.025, { w: 1.6 }); m.add(new THREE.IcosahedronGeometry(cr, 2), { p: [x, g + cr * 2.2, z], s: [1, 1.15, 1], w: 0.45 }).add(new THREE.IcosahedronGeometry(cr * 0.55, 1), { p: [x, g + cr * 2.2, z], w: 0.6 }); };
  [[-2.25, -0.1, 0.3], [-2.2, 1.35, 0.24], [ax + 1.55, 1.45, 0.22], [bx + BW / 2 + 0.3, bz - 0.35, 0.28]].forEach(([x, z, c]) => tree(x, z, c));
  [-0.3, 0, 0.3].forEach((o, k) => { rod(m, [ax + 0.55 + o, g, 1.05], [ax + 0.55 + o, g + 1.2 - Math.abs(o) * 0.3, 1.05], 0.008, { w: 2.5 }); m.add(new THREE.PlaneGeometry(0.22, 0.13, 4, 2), { p: [ax + 0.66 + o, g + 1.12 - Math.abs(o) * 0.3, 1.05], w: 2, e: 1, t: k === 1 ? 1 : 0 }); });
  m.add(box(0.62, 0.2, 0.1), { p: [ax + 0.75, g + 0.1, 1.6], e: 3, w: 1 }).add(box(0.5, 0.07, 0.012), { p: [ax + 0.75, g + 0.13, 1.656], w: 3, t: 1 });
  // parking lot and drive with gate booth
  const P0 = 1.0, P1 = 2.35, PZ0 = -1.5, PZ1 = 0.25;
  m.add(new THREE.PlaneGeometry(P1 - P0, PZ1 - PZ0), { p: [(P0 + P1) / 2, g + 0.002, (PZ0 + PZ1) / 2], r: UP, w: 0.12 });
  for (let k = 0; k <= 6; k++) { const z = PZ0 + 0.1 + k * 0.26; m.line([P0, g + 0.005, z], [P0 + 0.5, g + 0.005, z], 1.2); m.line([P1 - 0.5, g + 0.005, z], [P1, g + 0.005, z], 1.2); }
  m.add(new THREE.PlaneGeometry(0.5, 1.45), { p: [1.7, g + 0.002, 0.95], r: UP, w: 0.12 });
  const car = (x, z, ry) => { m.push([x, g, z], [0, ry, 0]); m.add(box(0.4, 0.1, 0.18), { p: [0, 0.08, 0], e: 3, w: 1.1 }).add(box(0.22, 0.08, 0.16), { p: [-0.02, 0.17, 0], e: 3, w: 1.1 }); [[-0.13, 1], [0.13, 1], [-0.13, -1], [0.13, -1]].forEach(([a, b]) => m.add(tor(0.035, 0.014), { p: [a, 0.04, b * 0.09], w: 2 })); m.pop(); };
  car(P0 + 0.25, PZ0 + 0.23, 0); car(P0 + 0.25, PZ0 + 0.75, 0); car(P1 - 0.25, PZ0 + 0.49, 0); car(P1 - 0.25, PZ0 + 1.27, 0);
  [[P0 + 0.68, -1.1], [P0 + 0.68, -0.1]].forEach(([x, z]) => { rod(m, [x, g, z], [x, g + 0.75, z], 0.01, { w: 2 }); m.add(box(0.14, 0.03, 0.06), { p: [x + 0.05, g + 0.76, z], e: 2 }); });
  m.add(box(0.3, 0.42, 0.3), { p: [2.2, g + 0.21, 1.2], e: 3, w: 0.6 }).add(box(0.4, 0.03, 0.4), { p: [2.2, g + 0.44, 1.2], e: 2.5 });
  m.poly([[2.051, g + 0.2, 1.1], [2.051, g + 0.34, 1.1], [2.051, g + 0.34, 1.3], [2.051, g + 0.2, 1.3]], 2, true);
  m.add(box(0.06, 0.16, 0.06), { p: [1.98, g + 0.08, 1.5], e: 2 }); for (let k = 0; k < 6; k++) rod(m, [1.98 - k * 0.09, g + 0.15, 1.5], [1.98 - (k + 1) * 0.09, g + 0.15, 1.5], 0.009, { w: 3, t: k % 2 });   // barrier arm, striped
  // people, drawn in a person-scale frame (1 unit = a 5'9" worker) with extra particle weight so they read at this scale
  const S = 0.2, crew = (x, z, ry, J) => { m.push([x, g, z], [0, 0, 0], S); m.wm = 22; worker(m, [0, 0, 0], ry, J); m.wm = 1; m.pop(); };
  // armed guard at the booth: cap, duty belt, sidearm, radio
  crew(1.95, 1.18, -1.3, { suit: 0, hat: 'cap', muffs: false, glasses: false, belt: true, hipL: [-0.1, 0.92, 0], hipR: [0.1, 0.92, 0], kneeL: [-0.12, 0.48, 0.02], footL: [-0.14, 0.06, 0], kneeR: [0.12, 0.48, 0.02], footR: [0.14, 0.06, 0],
    chest: [0, 1.2, 0], shL: [-0.2, 1.42, 0], elL: [-0.25, 1.15, 0.04], hdL: [-0.17, 0.98, 0.1], shR: [0.2, 1.42, 0], elR: [0.25, 1.15, 0.03], hdR: [0.2, 0.98, 0.08], head: [0, 1.62, 0.02] });
  // janitor pushing a cart with mop bucket at the entrance
  crew(ax + 0.42, azf + 0.75, -PI / 2, { suit: 0, hat: 'none', muffs: false, glasses: false, hipL: [-0.1, 0.92, 0], hipR: [0.1, 0.92, 0], kneeL: [-0.11, 0.5, 0.12], footL: [-0.12, 0.06, 0.2], kneeR: [0.11, 0.48, -0.06], footR: [0.12, 0.06, -0.2],
    chest: [0, 1.2, 0.05], lean: [0.15, 0, 0], shL: [-0.2, 1.42, 0.06], elL: [-0.22, 1.2, 0.3], hdL: [-0.17, 1.05, 0.5], shR: [0.2, 1.42, 0.06], elR: [0.22, 1.2, 0.3], hdR: [0.17, 1.05, 0.5], head: [0, 1.62, 0.08] });
  m.push([ax + 0.42 - 0.2 * S * 4.2, g, azf + 0.75], [0, -PI / 2, 0], S); m.wm = 22;
  m.add(box(0.5, 0.55, 0.9), { p: [0, 0.4, 1.1], e: 3, w: 1.2 }); m.add(cyl(0.2, 0.3, 14), { p: [0, 0.3, 1.85], w: 1.5, t: 2 }); rod(m, [0.05, 0.2, 1.85], [0.12, 1.3, 1.95], 0.02, { w: 3 }); rod(m, [-0.25, 1.05, 0.6], [0.25, 1.05, 0.6], 0.02, { w: 3 });
  [[-0.22, 0.75], [0.22, 0.75], [-0.22, 1.5], [0.22, 1.5]].forEach(([a, b]) => m.add(tor(0.06, 0.025), { p: [a, 0.07, b], r: [0, PI / 2, 0], w: 2 }));
  m.wm = 1; m.pop();
  // groundskeeper on a zero-turn mower on the half-cut lawn: deck, big drive wheels, casters, seat, roll bar; cap, glasses, ear muffs
  const mx = -1.62, mz = 1.13; m.push([mx, g, mz], [0, PI / 2, 0], S); m.wm = 22;
  m.add(box(1.4, 0.18, 1.1), { p: [0, 0.2, 0.35], e: 3, w: 1.2 });
  m.add(box(1.0, 0.35, 0.85), { p: [0, 0.55, -0.35], e: 3, w: 1.2 }); m.add(box(0.55, 0.12, 0.5), { p: [0, 0.78, -0.3], e: 2.5 }).add(box(0.55, 0.5, 0.1), { p: [0, 1.05, -0.58], e: 2.5 });
  [-1, 1].forEach(sx => { m.add(tor(0.27, 0.11), { p: [sx * 0.6, 0.36, -0.5], r: [0, PI / 2, 0], w: 2.2 }); m.add(tor(0.1, 0.05), { p: [sx * 0.55, 0.13, 0.85], r: [0, PI / 2, 0], w: 2.2 }); rod(m, [sx * 0.3, 0.9, 0.0], [sx * 0.3, 0.9, 0.35], 0.03, { w: 3 }); });
  m.poly([[-0.55, 0.6, -0.75], [-0.55, 1.75, -0.75], [0.55, 1.75, -0.75], [0.55, 0.6, -0.75]], 3);
  m.wm = 1; m.pop();
  crew(mx, mz, PI / 2, { suit: 0, hat: 'cap', hipL: [-0.12, 0.85, -0.3], hipR: [0.12, 0.85, -0.3], kneeL: [-0.15, 0.95, 0.12], footL: [-0.15, 0.4, 0.28], kneeR: [0.15, 0.95, 0.12], footR: [0.15, 0.4, 0.28],
    chest: [0, 1.15, -0.28], shL: [-0.2, 1.38, -0.25], elL: [-0.3, 1.08, -0.05], hdL: [-0.3, 0.95, 0.12], shR: [0.2, 1.38, -0.25], elR: [0.3, 1.08, -0.05], hdR: [0.3, 0.95, 0.12], head: [0, 1.58, -0.22] });
  for (let k = 0; k < 10; k++) { const a = R() * PI; m.line([mx + 0.22, g + 0.04, mz + (R() - 0.5) * 0.18], [mx + 0.3 + R() * 0.12, g + 0.02 + R() * 0.05, mz + (R() - 0.5) * 0.3], 0.25); }   // clippings out the chute
  return { m, hot: { enter: [2.3, 0.8, 0], a: [-1.6, 0.4, 1.2], b: [1.9, 0.2, 1.3], c: [-0.6, 1.5, -0.6] } };
}

/* ---------- 7 · Locations: Gulf Coast map ---------- */
/* ---------- Safety: worker in full PPE climbing a caged ladder, spotter at the base ---------- */
// a worker built from joints: red coveralls (tint 1), hard hat with brim and ridge, safety glasses, blue ear muffs (tint 2)
function worker(m, base, ry, J) {
  m.push(base, [0, ry, 0]);
  const suit = J.suit === undefined ? 1 : J.suit, limb = (a, b, r, t = suit, w = 2.4) => { rod(m, a, b, r, { w, t }); m.add(sph(r), { p: b, w: w * 0.6, t }); };
  limb(J.hipL, J.kneeL, 0.06); limb(J.kneeL, J.footL, 0.05); limb(J.hipR, J.kneeR, 0.06); limb(J.kneeR, J.footR, 0.05);
  [J.footL, J.footR].forEach(f => m.add(box(0.1, 0.07, 0.26), { p: [f[0], f[1] - 0.02, f[2] + (J.toe || 0.08)], e: 2, w: 2.6 }));
  m.add(box(0.31, 0.15, 0.17), { p: [(J.hipL[0] + J.hipR[0]) / 2, (J.hipL[1] + J.hipR[1]) / 2 + 0.03, (J.hipL[2] + J.hipR[2]) / 2], e: 2, w: 2.4, t: suit });      // pelvis: wider than deep, so the hips visibly turn with the body
  m.add(new THREE.CapsuleGeometry(0.15, 0.32, 4, 12), { p: J.chest, r: J.lean || [0, 0, 0], s: [1, 1, 0.72], w: 2.4, t: suit });
  [[J.shL, J.elL, J.hdL], [J.shR, J.elR, J.hdR]].forEach(([a, b, c]) => { limb(a, b, 0.045); limb(b, c, 0.04); m.add(sph(0.045), { p: c, w: 2.5 }); });
  // reflective bands on the coveralls
  [[J.elL, J.hdL], [J.elR, J.hdR], [J.kneeL, J.footL], [J.kneeR, J.footR]].forEach(([a, b]) => { const q = a.map((v, k) => v + (b[k] - v) * 0.45); m.add(sph(0.055), { p: q, s: [1, 0.35, 1], w: 3 }); });
  if (J.belt) { m.add(tor(0.16, 0.022), { p: [0, 0.96, 0], r: UP, s: [1, 0.75, 1], w: 4 }); m.add(box(0.06, 0.16, 0.08), { p: [0.19, 0.88, 0.02], e: 3, w: 5 }).add(box(0.05, 0.06, 0.09), { p: [0.19, 0.98, 0.04], r: [0.3, 0, 0], w: 5 }); m.add(box(0.05, 0.08, 0.03), { p: [-0.16, 1.4, 0.1], e: 2, w: 4 }); }   // duty belt, holstered sidearm, shoulder radio
  const h = J.head, hr = 0.105;
  m.add(sph(hr), { p: h, w: 2.4 });
  m.push(h, J.tilt || [0, 0, 0]);
  const hat = J.hat || 'hard';
  if (hat === 'hard') {
    m.add(dome(hr * 1.18), { p: [0, 0.035, 0], s: [1, 0.9, 1.12], w: 3 });                                           // hard hat shell
    m.add(new THREE.TorusGeometry(hr * 1.12, 0.012, 6, 24, PI), { p: [0, 0.035, 0], r: [0, PI / 2, 0], s: [1, 0.92, 1.12], w: 3.5 });   // ridge
    m.add(ring(hr * 1.12, hr * 1.42), { p: [0, 0.035, 0.03], r: UP, s: [1, 1.28, 1], w: 3 });                            // brim with front peak
  } else if (hat === 'cap') { m.add(dome(hr * 1.08), { p: [0, 0.02, 0], s: [1, 0.75, 1.05], w: 3 }).add(new THREE.CircleGeometry(hr * 0.7, 16, 0, PI), { p: [0, 0.02, hr * 0.9], r: [-PI / 2 + 0.12, 0, 0], w: 3.5 }); }
  if (J.glasses !== false) m.add(box(0.17, 0.035, 0.012), { p: [0, -0.005, hr * 0.98], e: 3, w: 3 });                 // safety glasses
  if (J.muffs !== false) [-1, 1].forEach(sx => m.add(cyl(0.045, 0.045, 14), { p: [sx * hr * 1.02, -0.02, 0], r: AX, w: 4 }));   // ear muffs
  m.pop();
  return m.pop();
}
// text drawn into particles: render to a canvas, turn each row of lit pixels into a short line segment
function text(m, str, cx, cy, z, h, t = 0, w = 1, font = '900 100px Impact, "Arial Black", sans-serif', maxW = 0) {      // maxW: shrink to fit a board whatever font the device falls back to
  const c = document.createElement('canvas'), x = c.getContext('2d'); x.font = font; const tw = Math.ceil(x.measureText(str).width) + 8; c.width = tw; c.height = 120;
  x.font = font; x.fillStyle = '#000'; x.textBaseline = 'middle'; x.fillText(str, 4, 62); const d = x.getImageData(0, 0, tw, 120).data, k = maxW ? Math.min(h / 100, maxW / tw) : h / 100;
  for (let yy = 0; yy < 120; yy += 2) { let run = -1; for (let xx = 0; xx <= tw; xx++) { const on = xx < tw && d[(yy * tw + xx) * 4 + 3] > 128; if (on && run < 0) run = xx; if (!on && run >= 0) { m.line([cx + (run - tw / 2) * k, cy + (62 - yy) * k, z], [cx + (xx - tw / 2) * k, cy + (62 - yy) * k, z], w, t); run = -1; } } }
}
/* ---------- Safety: pre-job toolbox talk at the SAFETY FIRST board ---------- */
function safety() {
  const m = new Model(), g = -1.5, bz = -1.3, by = g + 1.45, BW = 3.2, BH = 1.3;
  // site board on two posts, red border, two-line sign
  [-1.35, 1.35].forEach(x => { rod(m, [x, g, bz - 0.04], [x, by + BH / 2, bz - 0.04], 0.045, { w: 2 }); m.add(box(0.22, 0.04, 0.22), { p: [x, g + 0.02, bz - 0.04], e: 2 }); });
  m.add(box(BW, BH, 0.05), { p: [0, by, bz - 0.06], e: 4, w: 0.12 });
  m.poly([[-BW / 2 + 0.06, by - BH / 2 + 0.06, bz - 0.03], [BW / 2 - 0.06, by - BH / 2 + 0.06, bz - 0.03], [BW / 2 - 0.06, by + BH / 2 - 0.06, bz - 0.03], [-BW / 2 + 0.06, by + BH / 2 - 0.06, bz - 0.03]], 5, true, 1);
  text(m, 'SAFETY', 0, by + 0.26, bz - 0.025, 0.62, 1, 1.25, undefined, 2.8);
  text(m, 'FIRST', 0, by - 0.33, bz - 0.025, 0.5, 0, 1.25, undefined, 2.8);
  // foreman beside the board pointing at it, crew of five in a half circle listening: hard hats, glasses
  const plain = { suit: 0, muffs: false };
  worker(m, [1.95, g, bz + 0.35], -0.5, { ...plain, hipL: [-0.1, 0.92, 0], hipR: [0.1, 0.92, 0], kneeL: [-0.12, 0.48, 0.02], footL: [-0.14, 0.06, 0], kneeR: [0.12, 0.48, 0.02], footR: [0.14, 0.06, 0],
    chest: [0, 1.2, 0], shL: [-0.2, 1.42, 0], elL: [-0.45, 1.6, -0.1], hdL: [-0.68, 1.78, -0.2], shR: [0.2, 1.42, 0], elR: [0.25, 1.15, 0.05], hdR: [0.2, 1.0, 0.15], head: [0, 1.62, 0.02], tilt: [0, -0.5, 0] });
  m.push([1.95, g, bz + 0.35], [0, -0.5, 0]); m.add(box(0.22, 0.3, 0.015), { p: [0.22, 1.02, 0.2], r: [-0.8, 0, 0], e: 3, w: 2.5 }); m.pop();   // JSA on a clipboard
  const stand = (x, z, ry, tilt) => worker(m, [x, g, z], ry, { ...plain, hipL: [-0.1, 0.92, 0], hipR: [0.1, 0.92, 0], kneeL: [-0.11, 0.48, 0.02], footL: [-0.13, 0.06, 0], kneeR: [0.11, 0.48, 0.02], footR: [0.13, 0.06, 0],
    chest: [0, 1.2, 0], shL: [-0.2, 1.42, 0], elL: [-0.23, 1.14, 0.02], hdL: [-0.18, 0.92, 0.06], shR: [0.2, 1.42, 0], elR: [0.23, 1.14, 0.02], hdR: [0.18, 0.92, 0.06], head: [0, 1.62, 0.02], tilt: tilt || [-0.12, 0, 0] });
  [[-1.75, 0.15, PI - 0.7], [-0.9, 0.75, PI - 0.3], [0, 0.95, PI], [0.9, 0.75, PI + 0.3], [1.65, 0.2, PI + 0.65]].forEach(([x, z, ry]) => stand(x, z, ry));
  return { m, hot: { enter: [2.3, 0.7, 0], a: [-1.9, 0.5, 0.6], b: [2.2, -0.4, 0.4], c: [0, 1.4, -1.2] } };
}

/* ---------- Quality: weld under inspection on a spool, code vessel with nameplate ---------- */
function quality() {
  const m = new Model(), g = -1.5, y = g + 0.75, rp = 0.2;
  m.add(pipeGeo([[-1.7, y, 0.2], [0.95, y, 0.2], [0.95, y + 1.0, 0.2]], rp, 0.4), { w: 1 });
  flange(m, [-1.7, y, 0.2], 'x', rp); flange(m, [0.95, y + 1.0, 0.2], 'y', rp);
  m.add(tor(rp + 0.006, 0.028), { p: [-0.35, y, 0.2], r: [0, PI / 2, 0], w: 6 });                                       // girth weld being inspected
  m.add(tor(rp + 0.006, 0.02), { p: [0.55, y, 0.2], r: [0, PI / 2, 0], w: 3 });
  [-1.25, 0.35].forEach(x => { rod(m, [x, g, 0.2], [x, y - rp, 0.2], 0.03, { w: 2 }); m.add(box(0.3, 0.03, 0.3), { p: [x, g + 0.015, 0.2], e: 2 }); m.add(new THREE.CylinderGeometry(rp + 0.03, rp + 0.03, 0.12, 16, 1, true, PI * 0.6, PI * 0.8), { p: [x, y, 0.2], r: AX, w: 2 }); });
  // inspector at the weld with his checklist: clipboard in both hands, looking at the joint; red ticks are the only red in the scene
  const ib = [-0.95, g, 0.78], iry = PI - 0.75;
  worker(m, ib, iry, { suit: 0, muffs: false, hipL: [-0.1, 0.92, 0], hipR: [0.1, 0.92, 0], kneeL: [-0.12, 0.5, 0.15], footL: [-0.13, 0.06, 0.2], kneeR: [0.12, 0.49, 0.0], footR: [0.14, 0.06, -0.14],
    chest: [0, 1.2, 0.03], lean: [0.12, 0, 0], shL: [-0.2, 1.4, 0.06], elL: [-0.23, 1.14, 0.14], hdL: [-0.13, 1.02, 0.28], shR: [0.2, 1.4, 0.06], elR: [0.23, 1.14, 0.14], hdR: [0.13, 1.02, 0.28],
    head: [0, 1.6, 0.08], tilt: [0.55, 0, 0] });
  m.push(ib, [0, iry, 0]); m.push([0, 1.1, 0.33], [0.93, 0, 0]);
  m.add(box(0.26, 0.34, 0.012), { e: 3, w: 2.5 }).add(box(0.1, 0.03, 0.02), { p: [0, 0.16, -0.008], e: 2, w: 3 });
  [0.08, 0.02, -0.04, -0.1].forEach((v, k) => { m.line([0.04, v, -0.008], [-0.1, v, -0.008], 1.5); if (k < 3) m.poly([[0.1, v, -0.009], [0.085, v - 0.015, -0.009], [0.06, v + 0.02, -0.009]], 2.5, false, 1); });
  m.pop(); m.pop();
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
  // the PMI hiring rep (red PMI triangle on his chest, hard hat in his other hand to give the new hire) shakes hands with the recruit, crew lined up behind, JOIN THE TEAM banner
  const m = new Model(), g = -1.5, bz = -1.25, by = g + 2.3, BW = 3.5, BH = 0.78;
  [-1.6, 1.6].forEach(x => { rod(m, [x, g, bz], [x, by + BH / 2, bz], 0.04, { w: 2 }); m.add(box(0.22, 0.04, 0.22), { p: [x, g + 0.02, bz], e: 2 }); });
  m.add(box(BW, BH, 0.04), { p: [0, by, bz], e: 4, w: 0.1 });
  m.poly([[-BW / 2 + 0.05, by - BH / 2 + 0.05, bz + 0.03], [BW / 2 - 0.05, by - BH / 2 + 0.05, bz + 0.03], [BW / 2 - 0.05, by + BH / 2 - 0.05, bz + 0.03], [-BW / 2 + 0.05, by + BH / 2 - 0.05, bz + 0.03]], 5, true, 1);
  text(m, 'JOIN THE TEAM', 0, by - 0.01, bz + 0.035, 0.4, 1, 1.25, undefined, 3.1);
  const legs = { hipL: [-0.1, 0.92, 0], hipR: [0.1, 0.92, 0], kneeL: [-0.11, 0.48, 0.02], footL: [-0.13, 0.06, 0], kneeR: [0.11, 0.48, 0.02], footR: [0.13, 0.06, 0], chest: [0, 1.2, 0], shL: [-0.2, 1.42, 0], shR: [0.2, 1.42, 0], head: [0, 1.62, 0.02], muffs: false };
  const down = { elL: [-0.23, 1.14, 0.02], hdL: [-0.18, 0.92, 0.06] }, shake = { elR: [0.17, 1.2, 0.2], hdR: [0.02, 1.06, 0.43] };
  worker(m, [-0.43, g, 0.55], PI / 2, { ...legs, ...down, ...shake, suit: 0 });                                   // foreman
  worker(m, [0.43, g, 0.55], -PI / 2, { ...legs, ...shake, elL: [-0.25, 1.15, 0.06], hdL: [-0.24, 0.95, 0.2], suit: 0, hat: 'none', glasses: false });   // PMI hiring rep, in normal clothes
  m.push([0.43, g, 0.55], [0, -PI / 2, 0]); m.add(new THREE.CircleGeometry(0.075, 3), { p: [-0.075, 1.31, 0.118], r: [0, 0, PI / 2], w: 9, t: 1 }); m.poly([[-0.075, 1.385, 0.12], [-0.14, 1.273, 0.12], [-0.01, 1.273, 0.12]], 4, true, 1); m.add(dome(0.125), { p: [-0.26, 0.86, 0.22], s: [1, 0.9, 1.12], w: 3 }).add(ring(0.118, 0.15), { p: [-0.26, 0.86, 0.24], r: UP, s: [1, 1.28, 1], w: 3 }); m.pop();   // the hard hat he's handing over
  [[-1.55, -0.3, 0.3], [-0.85, -0.5, 0.12], [0.85, -0.5, -0.12], [1.55, -0.3, -0.3]].forEach(([x, z, ry]) => worker(m, [x, g, z], ry, { ...legs, ...down, elR: [0.23, 1.14, 0.02], hdR: [0.18, 0.92, 0.06], suit: 0 }));
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

/* ---------- refinery for the opening section: large enough to fly through at walking height ---------- */
function plant() {
  const m = new Model(), g = 0;
  const at = (x, z, ry, fn) => { m.push([x, 0, z], [0, ry, 0]); fn(); m.pop(); };
  const ball = r => new THREE.SphereGeometry(r, 10, 7);
  // light pipe run: straight rods with a small ball at each corner (far fewer triangles than a swept tube)
  const pipe = (pts, r, w = 1) => { for (let i = 1; i < pts.length; i++) { rod(m, pts[i - 1], pts[i], r, { w });
      const a = new THREE.Vector3(...pts[i - 1]), b = new THREE.Vector3(...pts[i]), d = b.clone().sub(a).normalize(), u = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize(), v = new THREE.Vector3().crossVectors(d, u);
      for (let k = 0; k < 4; k++) { const an = k / 4 * PI * 2 + 0.4, o = u.clone().multiplyScalar(Math.cos(an) * r).addScaledVector(v, Math.sin(an) * r); m.line(a.clone().add(o).toArray(), b.clone().add(o).toArray(), 0.6); }
      [a, b].forEach(c => { const q = []; for (let k = 0; k <= 8; k++) { const an = k / 8 * PI * 2; q.push(c.clone().addScaledVector(u, Math.cos(an) * r * 1.05).addScaledVector(v, Math.sin(an) * r * 1.05).toArray()); } m.poly(q, 0.8); }); }
    for (let i = 1; i < pts.length - 1; i++) m.add(ball(r * 1.08), { p: pts[i], w }); };
  // vertical shell outline: staves and hoops, so a column or stack reads crisply
  const staves = (x, z, r, y0, y1, n = 12) => { for (let k = 0; k < n; k++) { const a = k / n * PI * 2; m.line([x + Math.cos(a) * r, y0, z + Math.sin(a) * r], [x + Math.cos(a) * r, y1, z + Math.sin(a) * r], 0.7); } for (let y = y0; y <= y1 + 0.01; y += 0.28) { const q = []; for (let k = 0; k <= 24; k++) { const a = k / 24 * PI * 2; q.push([x + Math.cos(a) * r * 1.01, y, z + Math.sin(a) * r * 1.01]); } m.poly(q, 0.7); } };
  const col = (x, z, r, h, plats) => { column(m, x, z, r, g, h, plats); staves(x, z, r, g + 0.25, g + h + 0.25); for (let k = 0; k < 6; k++) { const q = [], a = k / 6 * PI; for (let j = 0; j <= 10; j++) { const b = j / 10 * PI; q.push([x + Math.cos(a) * Math.cos(b) * r, g + h + 0.25 + Math.sin(b) * r * 0.55, z + Math.sin(a) * Math.cos(b) * r]); } m.poly(q, 0.7); } };
  const valve = (p, rp, ry = 0) => { m.push(p, [0, ry, 0]); m.add(ball(rp * 1.7), { s: [1.15, 1, 0.9], w: 1.4 }).add(cyl(rp * 1.05, rp * 2.2, 12), { p: [0, rp * 2.2, 0], w: 1.4 }).add(cyl(rp * 1.6, rp * 0.4, 14, false), { p: [0, rp * 3.3, 0], e: 2 });
    rod(m, [0, rp * 3.3, 0], [0, rp * 7.4, 0], rp * 0.18, { w: 3 }); m.add(new THREE.TorusGeometry(rp * 2.3, rp * 0.2, 5, 20), { p: [0, rp * 7.2, 0], r: UP, w: 2.5 }); for (let k = 0; k < 2; k++) { const a = k * PI / 2; m.line([Math.cos(a) * rp * 2.3, rp * 7.2, Math.sin(a) * rp * 2.3], [-Math.cos(a) * rp * 2.3, rp * 7.2, -Math.sin(a) * rp * 2.3], 2); }
    [-1, 1].forEach(sg => m.add(cyl(rp * 1.75, rp * 0.5, 16, false), { p: [sg * rp * 2.2, 0, 0], r: AX, w: 1.3, e: 2 })); m.pop(); };
  // long straight pipe along local x: a light surface fill plus crisp lengthwise lines and hoops, so it reads as pipe rather than noise
  const run = (L, r, y, z, axisZ) => { m.push([0, y, z], axisZ ? [0, PI / 2, 0] : [0, 0, 0]); m.add(new THREE.CylinderGeometry(r, r, L, 12, 1, true), { r: AX, w: 0.14 }); for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2 + 0.3; m.line([-L / 2, Math.cos(a) * r, Math.sin(a) * r], [L / 2, Math.cos(a) * r, Math.sin(a) * r], 0.7); }
    for (let x = -L / 2 + 0.4; x < L / 2; x += 0.75) { const c = []; for (let k = 0; k <= 10; k++) { const a = k / 10 * PI * 2; c.push([x, Math.cos(a) * r * 1.03, Math.sin(a) * r * 1.03]); } m.poly(c, r > 0.07 ? 1.2 : 0.7); } m.pop(); };
  // pipe rack along local x, centred on z = 0
  const rack = (L, hw, ys, top) => {
    const n = Math.round(L / 1.5);
    for (let i = 0; i <= n; i++) { const x = -L / 2 + i * L / n;
      [-hw, hw].forEach(z => { m.add(box(0.08, top, 0.08), { p: [x, top / 2, z], e: 1.8, w: 0.6 }); m.add(box(0.22, 0.04, 0.22), { p: [x, 0.02, z], e: 1.5, w: 0.6 }); });
      ys.forEach(y => { m.add(box(0.07, 0.09, hw * 2), { p: [x, y, 0], e: 1.8, w: 0.6 }); [-1, 1].forEach(sg => m.line([x, y - 0.32, sg * hw], [x, y, sg * (hw - 0.32)], 1)); });
      if (i < n && i % 2 === 0) [-hw, hw].forEach(z => { const x1 = x + L / n; m.line([x, ys[0], z], [x1, top, z], 0.8); m.line([x1, ys[0], z], [x, top, z], 0.8); });
    }
    [...ys, top].forEach(y => [-hw, hw].forEach(z => m.line([-L / 2, y, z], [L / 2, y, z], 1.8)));
    ys.forEach((y, t) => { let z = -hw + 0.14, k = t * 3; while (z < hw - 0.16) { const r = [0.05, 0.075, 0.04, 0.06, 0.09, 0.045][k++ % 6]; run(L, r, y + 0.045 + r, z + r); z += r * 2 + 0.07; } });
  };
  // centrifugal pump on a base: motor, casing, valved suction, discharge rising to H and running d toward local -z
  const pump = (H, d, H2 = H + 0.65) => { m.add(box(0.56, 0.07, 0.26), { p: [0, 0.035, 0], e: 2, w: 0.8 }).add(cyl(0.095, 0.28, 16), { p: [-0.13, 0.2, 0], r: AX, w: 1.5, e: 1.5 }).add(cyl(0.095, 0.01, 16, false), { p: [-0.27, 0.2, 0], r: AX, w: 1.5 }); for (let k = 0; k < 5; k++) m.add(new THREE.TorusGeometry(0.098, 0.006, 4, 16), { p: [-0.23 + k * 0.045, 0.2, 0], r: [0, PI / 2, 0], w: 2 });
    m.add(new THREE.SphereGeometry(0.105, 16, 10), { p: [0.15, 0.2, 0], s: [0.55, 1, 1], w: 1.6 }).add(cyl(0.107, 0.02, 16), { p: [0.15, 0.2, 0], r: AX, w: 1, e: 2 }).add(cyl(0.03, 0.12, 8), { p: [0.04, 0.2, 0], r: AX, w: 1.5 });
    pipe([[0.15, 0.3, 0], [0.15, H, 0], [0.15, H, -d]], 0.036, 1.2); m.add(cyl(0.063, 0.02, 14, false), { p: [0.15, 0.36, 0], w: 1.5, e: 2 }); pipe([[0.25, 0.2, 0], [0.62, 0.2, 0], [0.62, H2, 0], [0.62, H2, -d]], 0.042, 1.2); valve([0.44, 0.2, 0], 0.026); };
  const hvessel = (L, r, y) => { m.add(new THREE.CylinderGeometry(r, r, L, 30, 4, true), { p: [0, y, 0], r: AX, w: 0.8 }); [-1, 1].forEach(sg => m.add(new THREE.SphereGeometry(r, 20, 12), { p: [sg * L / 2, y, 0], s: [0.45, 1, 1], w: 0.8 })); [-0.3, 0.3].forEach(o => { m.add(box(0.08, y - r * 0.6, r * 1.5), { p: [o * L, (y - r * 0.6) / 2, 0], e: 2, w: 0.6 }); m.add(new THREE.TorusGeometry(r + 0.004, 0.007, 5, 28), { p: [o * L, y, 0], r: [0, PI / 2, 0], w: 2 }); });
    for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; m.line([-L / 2, y + Math.cos(a) * r, Math.sin(a) * r], [L / 2, y + Math.cos(a) * r, Math.sin(a) * r], 0.9); } [-1, 1].forEach(sg => { for (let k = 0; k < 4; k++) { const q = []; for (let j = 0; j <= 8; j++) { const b = -PI / 2 + j / 8 * PI, a = k / 4 * PI; q.push([sg * (L / 2 + Math.cos(b) * r * 0.45), y + Math.sin(b) * r * Math.cos(a), Math.sin(b) * r * Math.sin(a)]); } m.poly(q, 0.9); } });
    m.add(cyl(r * 0.2, r * 0.5, 12), { p: [-L * 0.2, y + r + r * 0.2, 0], w: 1.2 }).add(cyl(r * 0.33, r * 0.08, 14, false), { p: [-L * 0.2, y + r + r * 0.45, 0], w: 1.5, e: 2 }); m.line([-L / 2 - r * 0.45, y, 0], [-L / 2 - r * 0.45, y, 0.001], 1); };
  const exch = () => { [0.5, 1.08].forEach(y => { hvessel(1.6, 0.23, y); [-0.62, 0.62].forEach(x => m.add(cyl(0.3, 0.05, 20, false), { p: [x, y, 0], r: AX, w: 1.3, e: 2 })); }); pipe([[0.4, 0.73, 0], [0.4, 0.85, 0]], 0.05, 1.2); };
  const sphereTank = Rr => { const cy = Rr + 0.75; m.add(new THREE.SphereGeometry(Rr, 40, 26), { p: [0, cy, 0], w: 0.45 }).add(new THREE.TorusGeometry(Rr + 0.004, 0.008, 5, 60), { p: [0, cy, 0], r: UP, w: 2 }).add(new THREE.TorusGeometry(Rr * 0.3, 0.008, 5, 30), { p: [0, cy + Rr + 0.1, 0], r: UP, w: 3 }).add(ring(0, Rr * 0.3), { p: [0, cy + Rr - 0.02, 0], r: UP, w: 1.5 });
    for (let k = 0; k < 8; k++) { const q = [], a = k / 8 * PI; for (let j = 0; j <= 36; j++) { const b = j / 36 * PI * 2; q.push([Math.cos(a) * Math.cos(b) * Rr, cy + Math.sin(b) * Rr, Math.sin(a) * Math.cos(b) * Rr]); } m.poly(q, 0.8); } [-0.5, 0.5].forEach(o => { const q = [], rr = Math.sqrt(1 - o * o) * Rr; for (let j = 0; j <= 40; j++) { const b = j / 40 * PI * 2; q.push([Math.cos(b) * rr, cy + o * Rr, Math.sin(b) * rr]); } m.poly(q, 0.8); });
    for (let k = 0; k < 10; k++) { const a = k / 10 * PI * 2, b = (k + 1) / 10 * PI * 2, lx = Math.cos(a) * Rr * 0.92, lz = Math.sin(a) * Rr * 0.92; pipe([[lx, 0, lz], [lx, cy, lz]], 0.035, 1.4); m.line([lx, 0, lz], [Math.cos(b) * Rr * 0.92, 0.75, Math.sin(b) * Rr * 0.92], 0.8); m.line([lx, 0.75, lz], [Math.cos(b) * Rr * 0.92, 0, Math.sin(b) * Rr * 0.92], 0.8); }
    const st = []; for (let k = 0; k <= 30; k++) { const a = -0.4 + k / 30 * 1.9, y = (cy + Rr * 0.75) * k / 30, rr = Math.max(Rr * 0.92, Math.sqrt(Math.max(0, Rr * Rr - (y - cy) * (y - cy))) + 0.07); st.push([Math.cos(a) * rr, y, Math.sin(a) * rr]); } m.poly(st, 2).poly(st.map(q => [q[0], q[1] + 0.13, q[2]]), 1.5); pipe([[0, cy - Rr, 0], [0, 0.3, 0], [0, 0.3, -Rr - 0.5]], 0.05, 1); valve([0, 0.3, -Rr - 0.2], 0.03, PI / 2); };
  // shell plating: nc courses (horizontal seams all round) and np plates per course, vertical seams offset half a plate on alternate courses (brick pattern)
  const courses = (x, z, r, h, nc, np, w) => { for (let c = 0; c <= nc; c++) { const q = [], y = h * c / nc; for (let k = 0; k <= 48; k++) { const a = k / 48 * PI * 2; q.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]); } m.poly(q, w); }
    for (let c = 0; c < nc; c++) for (let k = 0; k < np; k++) { const a = (k + (c % 2) / 2) / np * PI * 2; m.line([x + Math.cos(a) * r, h * c / nc, z + Math.sin(a) * r], [x + Math.cos(a) * r, h * (c + 1) / nc, z + Math.sin(a) * r], w); } };
  const tank = (r, h) => { m.add(new THREE.CylinderGeometry(r, r, h, 56, 3, true), { p: [0, h / 2, 0], w: 0.4 }).add(new THREE.ConeGeometry(r + 0.01, 0.2, 56, 1, true), { p: [0, h + 0.1, 0], w: 0.5 }).add(new THREE.TorusGeometry(r, 0.01, 5, 64), { p: [0, h, 0], r: UP, w: 2.5 }); [0.09, 0.17].forEach(o => m.add(new THREE.TorusGeometry(r, 0.006, 4, 64), { p: [0, h + o, 0], r: UP, w: 3 })); courses(0, 0, r + 0.003, h, 6, 10, 0.8);
    m.add(new THREE.TorusGeometry(r + 0.05, 0.012, 5, 64), { p: [0, h * 0.86, 0], r: UP, w: 2 });      // wind girder
    { const a = -PI / 3, cx = Math.cos(a) * (r + 0.012), cz = Math.sin(a) * (r + 0.012), tx = -Math.sin(a), tz = Math.cos(a); m.poly([[cx - tx * 0.26, 0.14, cz - tz * 0.26], [cx + tx * 0.26, 0.14, cz + tz * 0.26], [cx + tx * 0.26, 0.66, cz + tz * 0.26], [cx - tx * 0.26, 0.66, cz - tz * 0.26]], 2, true); }      // reinforcing plate round the shell manway
    m.add(cyl(0.07, 0.16, 12), { p: [r * 0.45, h + 0.2, 0], w: 1.5 }).add(cyl(0.11, 0.02, 14, false), { p: [r * 0.45, h + 0.29, 0], w: 1.5, e: 2 }).add(cyl(0.2, 0.08, 16), { p: [-r * 0.4, h + 0.17, r * 0.3], w: 1.5, e: 2 });      // roof nozzle and roof manway
    for (let k = 0; k < 28; k++) { const a = k / 28 * PI * 2; m.line([Math.cos(a) * r, h, Math.sin(a) * r], [Math.cos(a) * r, h + 0.17, Math.sin(a) * r], 1); }
    const hx = []; for (let k = 0; k <= 40; k++) { const a = -2.2 + 1.5 * k / 40; hx.push([Math.cos(a) * (r + 0.07), h * k / 40, Math.sin(a) * (r + 0.07)]); } m.poly(hx, 2.5).poly(hx.map(q => [q[0], q[1] + 0.14, q[2]]), 2); for (let k = 0; k <= 40; k += 4) m.line(hx[k], [hx[k][0], hx[k][1] + 0.14, hx[k][2]], 1);
    pipe([[0, 0.22, -r], [0, 0.22, -r - 0.42]], 0.06, 1); valve([0, 0.22, -r - 0.2], 0.034, PI / 2); m.add(cyl(0.16, 0.06, 16, false), { p: [r * 0.5, 0.4, -r * 0.87], r: [PI / 2, 0, 0.5], w: 1.5, e: 2 }); };
  const heater = () => { [[-0.6, -0.5], [0.6, -0.5], [0.6, 0.5], [-0.6, 0.5]].forEach(([x, z]) => m.add(box(0.08, 0.4, 0.08), { p: [x, 0.2, z], e: 1.5, w: 0.6 }));
    m.add(new THREE.BoxGeometry(1.35, 1.5, 1.15, 3, 3, 3), { p: [0, 1.15, 0], e: 3.5, w: 0.3 }).add(box(0.8, 0.6, 0.8), { p: [0, 2.2, 0], e: 3, w: 0.4 }).add(new THREE.CylinderGeometry(0.17, 0.17, 3.2, 22, 6, true), { p: [0, 4.3, 0], w: 0.9, e: 1.5 }).add(cyl(0.27, 0.36, 22, true, 0.17), { p: [0, 2.68, 0], w: 1 }).add(new THREE.TorusGeometry(0.175, 0.012, 5, 24), { p: [0, 5.9, 0], r: UP, w: 3 });
    staves(0, 0, 0.17, 2.7, 5.9, 10); [3.4, 4.4, 5.3].forEach(y => m.add(new THREE.TorusGeometry(0.174, 0.007, 4, 24), { p: [0, y, 0], r: UP, w: 2 })); for (let k = 0; k < 5; k++) m.add(cyl(0.06, 0.16, 10), { p: [-0.44 + k * 0.22, 0.32, 0], w: 1.5 });
    [0.8, 1.15, 1.5].forEach(y => { m.line([-0.675, y, 0.58], [0.675, y, 0.58], 0.7); m.line([-0.675, y, -0.58], [0.675, y, -0.58], 0.7); }); [-0.3, 0.3].forEach(x => m.add(new THREE.CircleGeometry(0.07, 12), { p: [x, 1.0, 0.585], w: 2 })); m.poly([[-0.68, 1.9, -0.6], [0.68, 1.9, -0.6], [0.68, 1.9, 0.6], [-0.68, 1.9, 0.6]], 1.5, true); };
  const structure = (hw, H, levels) => { [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]].forEach(([x, z], i, A) => { m.add(box(0.08, H, 0.08), { p: [x, H / 2, z], e: 1.8, w: 0.5 }); const n = A[(i + 1) % 4]; levels.forEach((y, li) => { m.line([x, y, z], [n[0], y, n[1]], 1.8); m.line([x, y + 0.16, z], [n[0], y + 0.16, n[1]], 1); m.line([x, li ? levels[li - 1] : 0, z], [n[0], y, n[1]], 0.7); }); }); };
  const shelter = () => { [[-1.6, -0.75], [0, -0.75], [1.6, -0.75], [1.6, 0.75], [0, 0.75], [-1.6, 0.75]].forEach(([x, z]) => m.add(box(0.08, 1.6, 0.08), { p: [x, 0.8, z], e: 1.5, w: 0.6 }));
    [-1, 1].forEach(sg => m.add(new THREE.BoxGeometry(3.5, 0.03, 0.95, 6, 1, 2), { p: [0, 1.82, sg * 0.42], r: [sg * 0.48, 0, 0], e: 2.5, w: 0.4 })); m.poly([[-1.6, 1.6, -0.75], [1.6, 1.6, -0.75], [1.6, 1.6, 0.75], [-1.6, 1.6, 0.75]], 1.6, true);
    [-0.8, 0.8].forEach(x => { m.add(cyl(0.24, 0.9, 22), { p: [x, 0.5, 0], r: AX, w: 1 }).add(box(1.1, 0.14, 0.6), { p: [x, 0.07, 0], e: 2, w: 0.6 }); [-0.25, 0.25].forEach(o => m.add(cyl(0.12, 0.55, 14), { p: [x + o, 0.5, 0.36], r: AZ, w: 1.2 })); m.add(cyl(0.19, 0.4, 18), { p: [x + 0.62, 0.5, 0], r: AX, w: 1 }); pipe([[x, 0.74, 0], [x, 1.3, 0], [x, 1.3, -0.95], [x, 0.3, -0.95]], 0.05, 1); }); pipe([[-1.9, 0.3, -0.95], [1.9, 0.3, -0.95]], 0.065, 1); [-1.9, 1.9].forEach(x => m.add(cyl(0.11, 0.03, 14, false), { p: [x, 0.3, -0.95], r: AX, w: 1.3, e: 2 })); };
  const coolingTower = () => { m.add(new THREE.BoxGeometry(3.2, 1.3, 1.5, 6, 2, 2), { p: [0, 0.8, 0], e: 3.5, w: 0.25 }).add(box(3.4, 0.14, 1.7), { p: [0, 0.07, 0], e: 2.5, w: 0.4 }); for (let y = 0.3; y < 1.4; y += 0.11) { m.line([-1.6, y, 0.76], [1.6, y, 0.76], 0.6); m.line([-1.6, y, -0.76], [1.6, y, -0.76], 0.6); }
    [-1.05, 0, 1.05].forEach(x => { m.add(cyl(0.38, 0.45, 26, true, 0.46), { p: [x, 1.68, 0], w: 1 }).add(new THREE.TorusGeometry(0.46, 0.01, 5, 30), { p: [x, 1.9, 0], r: UP, w: 2.5 }); for (let k = 0; k < 3; k++) { const a = k * PI / 3; m.line([x - Math.cos(a) * 0.38, 1.6, -Math.sin(a) * 0.38], [x + Math.cos(a) * 0.38, 1.6, Math.sin(a) * 0.38], 0.9); } }); [-0.53, 0.53].forEach(x => m.line([x, 0.14, 0.76], [x, 1.45, 0.76], 1)); };
  // pipe bridge over a road: portal truss of span S along local z; its pipes run from zN to zS and drop at either end to the ground-level lines they tie into
  const bridge = (S, y, zN, zS, dropN, dropS) => { [-S / 2, S / 2].forEach(z => { m.add(box(0.08, y + 0.5, 0.08), { p: [0, (y + 0.5) / 2, z], e: 1.8, w: 0.6 }); m.add(box(0.08, y + 0.5, 0.08), { p: [0.7, (y + 0.5) / 2, z], e: 1.8, w: 0.6 }); m.line([0, y, z], [0.7, y + 0.5, z], 0.8); m.line([0.7, y, z], [0, y + 0.5, z], 0.8); });
    [0, 0.7].forEach(x => [y, y + 0.5].forEach(yy => m.line([x, yy, -S / 2], [x, yy, S / 2], 1.8))); for (let z = -S / 2; z < S / 2 - 0.01; z += S / 4) { m.line([0, y, z], [0.7, y, z + S / 4], 0.7); m.line([0, y + 0.5, z], [0, y, z + S / 4], 0.7); }
    [[0.12, 0.06], [0.3, 0.085], [0.48, 0.05], [0.6, 0.04]].forEach(([x, r], i) => { const yy = y + 0.05 + r, a = zN - i * 0.05, b = zS + i * 0.05; m.push([x, 0, (a + b) / 2]); run(b - a, r, yy, 0, true); m.pop(); if (dropN) pipe([[x, yy, a], [x, 0.33, a]], r, 1); if (dropS) pipe([[x, yy, b], [x, 0.33, b]], r, 1); }); };
  const pole = () => { pipe([[0, 0, 0], [0, 1.9, 0]], 0.022, 2); m.add(cyl(0.05, 0.04, 10, false), { p: [0, 0.02, 0], w: 1.5, e: 2 }); m.line([0, 1.9, 0], [0, 1.95, 0.3], 2); m.line([0.012, 1.9, 0], [0.012, 1.95, 0.3], 2); m.add(box(0.06, 0.03, 0.16), { p: [0, 1.94, 0.3], e: 2.5, w: 1 }); };
  const hoop = (x, y, z, r, w = 0.7) => { const q = []; for (let k = 0; k <= 20; k++) { const a = k / 20 * PI * 2; q.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]); } m.poly(q, w); };
  const bgCol = (x, z, r, h) => { m.add(new THREE.CylinderGeometry(r, r, h, 12, 1, true), { p: [x, h / 2 + 0.25, z], w: 0.25 }); staves(x, z, r, 0.25, h + 0.25, 10); [0.35, 0.62, 0.86].forEach(f => { hoop(x, h * f, z, r + 0.22); hoop(x, h * f + 0.14, z, r + 0.22); }); for (let k = 0; k < 5; k++) { const q = [], a = k / 5 * PI; for (let j = 0; j <= 8; j++) { const b = j / 8 * PI; q.push([x + Math.cos(a) * Math.cos(b) * r, h + 0.25 + Math.sin(b) * r * 0.55, z + Math.sin(a) * Math.cos(b) * r]); } m.poly(q, 0.7); } m.line([x, 0, z - r - 0.04], [x, h + 0.25, z - r - 0.04], 0.8); };
  const bgTank = (x, z, r, h) => { m.add(new THREE.CylinderGeometry(r, r, h, 20, 1, true), { p: [x, h / 2, z], w: 0.12 }); courses(x, z, r, h, 6, 10, 0.6); hoop(x, h * 0.86, z, r + 0.05, 0.6); hoop(x, h + 0.15, z, r, 0.5); [0, 1, 2, 3].forEach(k => m.line([x + Math.cos(k * PI / 2) * r, h, z + Math.sin(k * PI / 2) * r], [x, h + 0.22, z], 0.4)); };
  const bgSphere = (x, z, Rr) => { const cy = Rr + 0.8; m.add(new THREE.SphereGeometry(Rr, 14, 10), { p: [x, cy, z], w: 0.15 }); for (let k = 0; k < 6; k++) { const q = [], a = k / 6 * PI; for (let j = 0; j <= 28; j++) { const b = j / 28 * PI * 2; q.push([x + Math.cos(a) * Math.cos(b) * Rr, cy + Math.sin(b) * Rr, z + Math.sin(a) * Math.cos(b) * Rr]); } m.poly(q, 0.7); } hoop(x, cy, z, Rr); for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; m.line([x + Math.cos(a) * Rr * 0.92, 0, z + Math.sin(a) * Rr * 0.92], [x + Math.cos(a) * Rr * 0.92, cy, z + Math.sin(a) * Rr * 0.92], 0.8); } };
  const bgRack = (L, hw) => { for (let x = -L / 2; x <= L / 2 + 0.01; x += 1.5) { [-hw, hw].forEach(z => m.line([x, 0, z], [x, 2.3, z], 1)); [1.35, 2.0].forEach(y => m.line([x, y, -hw], [x, y, hw], 1)); } [1.35, 2.0, 2.3].forEach(y => [-hw, hw].forEach(z => m.line([-L / 2, y, z], [L / 2, y, z], 1))); [1.45, 2.1].forEach(y => { for (let k = 0; k < 7; k++) m.line([-L / 2, y + (k % 3) * 0.03, -hw + 0.15 + k * (hw * 2 - 0.3) / 6], [L / 2, y + (k % 3) * 0.03, -hw + 0.15 + k * (hw * 2 - 0.3) / 6], 0.9); }); };
  const bgHeater = (x, z) => { m.add(box(1.35, 1.5, 1.15), { p: [x, 1.15, z], e: 3, w: 0.12 }).add(box(0.8, 0.6, 0.8), { p: [x, 2.2, z], e: 3, w: 0.12 }); staves(x, z, 0.17, 2.5, 5.9, 8); [[-0.6, -0.5], [0.6, -0.5], [0.6, 0.5], [-0.6, 0.5]].forEach(([a, b]) => m.line([x + a, 0, z + b], [x + a, 0.4, z + b], 1)); };
  const drop = (x, zEq, yEq, yT, sg, r = 0.045) => pipe([[x, yEq, zEq], [x, yT + 0.12, zEq], [x, yT + 0.12, sg * 0.75]], r, 1);

  // ---- ground: paving joints, road edges, battery limit
  for (let x = -36; x <= 36.01; x += 1.5) m.line([x, g, -25.5], [x, g, 39], 0.3); for (let z = -25.5; z <= 39.01; z += 1.5) m.line([-36, g, z], [36, g, z], 0.3);
  m.poly([[-19.5, g, -6], [19.5, g, -6], [19.5, g, 17], [-19.5, g, 17]], 1.2, true);
  [[-12.4, 2.0, 12.4, 2.0], [-12.4, 2.72, 12.4, 2.72], [-12.4, -2.0, 12.4, -2.0], [-12.4, -2.72, 12.4, -2.72], [-12, 9.45, 12, 9.45], [-12, 10.95, 12, 10.95], [12.85, 1.5, 12.85, 8.7], [14.35, 1.5, 14.35, 8.7], [-12.85, 1.5, -12.85, 15.2], [-14.35, 1.5, -14.35, 16.4], [-11.5, 16.15, 0.2, 16.15], [-12.4, 17.65, 0.8, 17.65], [0.75, 11.4, 0.75, 15.4], [2.1, 11.6, 2.1, 16.2]].forEach(([a, b, c, d]) => m.line([a, g + 0.01, b], [c, g + 0.01, d], 1.1));

  // ================= LEG 1: under the main pipe rack (west to east along z = 0) =================
  at(0, 0, 0, () => rack(34.5, 0.9, [1.35, 2.0], 2.35));
  at(5, 0, 0, () => { m.add(new THREE.BoxGeometry(6.2, 0.22, 2.1, 12, 1, 2), { p: [0, 2.82, 0], e: 3, w: 0.3 }); for (let x = -3; x <= 3.01; x += 1.5) [-0.9, 0.9].forEach(z => m.line([x, 2.35, z], [x, 2.71, z], 1.4)); [-2.25, -0.75, 0.75, 2.25].forEach(x => { m.add(new THREE.TorusGeometry(0.62, 0.014, 5, 36), { p: [x, 2.68, 0], r: UP, w: 2.5 }); for (let k = 0; k < 4; k++) { const a = k * PI / 4; m.line([x - Math.cos(a) * 0.6, 2.64, -Math.sin(a) * 0.6], [x + Math.cos(a) * 0.6, 2.64, Math.sin(a) * 0.6], 0.9); } }); for (let x = -3; x <= 3.01; x += 0.25) m.line([x, 2.94, -1.0], [x, 2.94, 1.0], 0.3); });      // fin-fan coolers on the rack
  [-10.5, -8.2, -6, 3, 5.2, 7.5, 9.8].forEach(x => at(x, 1.55, 0, () => pump(1.47, 0.85, 2.12))); [-8.2, -5.9, -3.7, 5.3, 7.5, 9.8].forEach(x => at(x, -1.55, PI, () => pump(1.47, 0.85, 2.12)));
  // south process row
  col(-10.6, 3.5, 0.48, 5.6, [1.7, 3.1, 4.5]); pipe([[-10.6, 6.15, 3.5], [-10.6, 6.5, 3.5], [-9.8, 6.5, 3.5], [-9.8, 2.14, 3.5], [-9.8, 2.14, 0.75]], 0.075, 1.1);
  col(-8.3, 3.4, 0.31, 3.8, [1.5, 2.8]); pipe([[-8.3, 4.25, 3.4], [-8.3, 4.5, 3.4], [-7.75, 4.5, 3.4], [-7.75, 1.47, 3.4], [-7.75, 1.47, 0.75]], 0.05, 1.1);
  at(-5.6, 3.75, 0, () => { structure(0.95, 1.5, [1.42]); m.push([0, 1.5, 0]); hvessel(2.1, 0.4, 0.62); m.pop(); }); drop(-5.2, 3.75, 2.56, 2.0, 1);
  at(-3.0, 3.1, 0, exch); drop(-3.4, 3.1, 1.3, 1.35, 1); at(-0.6, 3.1, 0, exch); drop(-0.2, 3.1, 1.3, 2.0, 1);
  col(1.9, 3.5, 0.36, 4.4, [1.6, 3.0]); pipe([[1.9, 4.85, 3.5], [1.9, 5.1, 3.5], [2.6, 5.1, 3.5], [2.6, 2.14, 3.5], [2.6, 2.14, 0.75]], 0.055, 1.1);
  at(4.6, 3.2, 0, () => hvessel(2.0, 0.36, 0.78)); drop(4.2, 3.2, 1.2, 1.35, 1);
  [7.2].forEach(x => { col(x, 3.6, 0.5, 2.7, [1.9]); at(x, 3.6, 0, () => structure(0.85, 3.5, [1.9, 3.5])); drop(x - 0.3, 2.75, 3.1, 2.0, 1, 0.06); });
  // north process row
  at(-10.3, -3.2, 0, () => hvessel(2.2, 0.42, 0.85)); drop(-10.7, -3.2, 1.3, 1.35, -1);
  col(-7.6, -3.5, 0.42, 4.9, [1.7, 3.2]); pipe([[-7.6, 5.4, -3.5], [-7.6, 5.7, -3.5], [-6.9, 5.7, -3.5], [-6.9, 2.14, -3.5], [-6.9, 2.14, -0.75]], 0.065, 1.1);
  col(-5.1, -3.4, 0.29, 3.4, [1.5, 2.6]); pipe([[-5.1, 3.85, -3.4], [-5.1, 4.1, -3.4], [-4.6, 4.1, -3.4], [-4.6, 1.47, -3.4], [-4.6, 1.47, -0.75]], 0.045, 1.1);
  [-2.3, 0.7].forEach(x => { at(x, -3.5, 0, heater); pipe([[x, 2.0, -2.9], [x, 2.14, -2.9], [x, 2.14, -0.75]], 0.06, 1); });
  at(3.5, -3.1, 0, exch); drop(3.1, -3.1, 1.3, 1.35, -1);
  col(6.1, -3.5, 0.38, 4.1, [1.6, 2.9]); pipe([[6.1, 4.55, -3.5], [6.1, 4.8, -3.5], [6.8, 4.8, -3.5], [6.8, 2.14, -3.5], [6.8, 2.14, -0.75]], 0.055, 1.1);
  at(8.9, -3.2, 0, () => hvessel(2.3, 0.45, 0.9)); drop(8.5, -3.2, 1.4, 2.0, -1);
  col(11.2, -3.3, 0.27, 3.0, [1.4, 2.3]);

  // ================= LEG 2: east road (north to south along x = 13.6) =================
  at(15.75, 3.0, PI / 2, shelter); at(15.75, 6.6, 0, heater); col(15.6, 9.0, 0.34, 3.8, [1.5, 2.7]);
  col(11.3, 3.2, 0.5, 2.7, [1.9]); at(11.3, 3.2, 0, () => structure(0.85, 3.5, [1.9, 3.5])); at(11.9, 5.9, PI / 2, exch); at(11.9, 8.1, PI / 2, () => hvessel(1.7, 0.34, 0.75));
  // ================= LEG 3: tank farm road (east to west along z = 10.2) =================
  [9.4, 6.4, 3.4].forEach(x => at(x, 12.95, 0, () => sphereTank(1.15))); pipe([[9.4, 0.3, 11.3], [3.4, 0.3, 11.3]], 0.06, 0.8);
  [-1.6, -5.6, -9.6].forEach(x => at(x, 13.4, 0, () => tank(1.6, 2.1))); m.poly([[0.6, 0.18, 11.25], [-11.8, 0.18, 11.25], [-11.8, 0.18, 15.6], [0.6, 0.18, 15.6]], 2.5, true); pipe([[-1.6, 0.22, 11.4], [-9.6, 0.22, 11.4]], 0.07, 0.8);
  [8.6, 4.2].forEach(x => at(x, 7.6, 0, () => { [-0.62, 0, 0.62].forEach(z => { m.push([0, 0, z]); hvessel(2.9, 0.26, 0.62); m.pop(); }); pipe([[0, 0.9, 0.62], [0, 1.2, 0.62], [0, 1.2, 1.2], [0, 0.36, 1.2]], 0.04, 1); }));      // LPG bullets, outlet down to the sleeper pipeway
  at(-5.6, 8.0, 0, () => rack(9, 0.6, [1.25, 1.75], 2.0)); [-8.2, -5.2, -2.6].forEach(x => at(x, 9.0, 0, () => pump(1.37, 0.55, 1.87)));
  { const n = 8; m.push([5.6, 0, 0]); for (let k = 0; k < 4; k++) run(9.5, 0.05 + (k % 2) * 0.02, 0.27 + (k % 2) * 0.02, 9.05 - k * 0.17); m.pop(); for (let i = 0; i <= n; i++) m.add(box(0.12, 0.2, 0.8), { p: [0.85 + i * 9.5 / n, 0.1, 8.8], e: 2, w: 0.6 }); }      // sleeper pipeway beside the road
  [7.6, 4.4].forEach(x => at(x, 10.2, 0, () => bridge(3.2, 1.75, -1.4, 1.1, true, true)));
  [-3.4, -7.0, -10.6].forEach(x => at(x, 19.6, 0, () => sphereTank(1.25))); pipe([[-10.6, 0.3, 17.85], [-3.4, 0.3, 17.85]], 0.06, 0.8); [1.9, 5.9, 9.9].forEach(x => at(x, 19.9, 0, () => tank(1.7, 2.3))); m.poly([[-0.2, 0.18, 17.75], [12.0, 0.18, 17.75], [12.0, 0.18, 22.2], [-0.2, 0.18, 22.2]], 2.5, true); pipe([[1.9, 0.22, 17.78], [9.9, 0.22, 17.78]], 0.07, 0.8);
  [-10, -6, -2].forEach(x => at(x, 16.05, 0, pole)); at(-6.8, 10.2, 0, () => bridge(3.2, 1.75, -2.4, 1.2, false, true));
  // ================= LEG 4: west road (south to north along x = -13.6) =================
  at(-15.95, 7.6, PI / 2, coolingTower); at(-15.95, 3.6, PI / 2, coolingTower); pipe([[-15.1, 0.35, 7.6], [-14.7, 0.35, 7.6], [-14.7, 0.35, 3.6], [-15.1, 0.35, 3.6]], 0.08, 0.9);
  at(-11.9, 7.7, PI / 2, exch); at(-11.9, 5.4, PI / 2, () => hvessel(1.7, 0.36, 0.78));
  // flare, far corner
  pipe([[-17.6, g, -3.6], [-17.6, g + 8.2, -3.6]], 0.06, 1.5); m.add(cyl(0.1, 0.34, 12), { p: [-17.6, g + 8.35, -3.6], w: 1.5 }); [0.4, 2.5, 4.6].forEach(a => m.line([-17.6, g + 5.5, -3.6], [-17.6 + Math.cos(a) * 2.6, g, -3.6 + Math.sin(a) * 2.6], 0.7));
  m.add(sph(0.22), { p: [-17.55, g + 8.85, -3.6], s: [1, 2.0, 1], w: 3, t: 1 }).add(sph(0.11), { p: [-17.5, g + 9.3, -3.6], s: [1, 2.4, 1], w: 5, t: 1 });
  // ---- the rest of the refinery, beyond the flown loop
  at(0, -9.5, 0, () => bgRack(33, 0.9)); [[-14, 5.2, 0.4], [-10.5, 7.4, 0.5], [-7, 4.0, 0.32], [-3, 6.2, 0.42], [1, 3.6, 0.3], [5, 8.0, 0.5], [9, 5.0, 0.36], [13, 6.6, 0.44]].forEach(([x, h, r]) => bgCol(x, -12.2, r, h)); [-12, -6, 0, 6, 12].forEach(x => at(x, -7.3, 0, () => hvessel(2.2, 0.4, 0.85))); [-8.8, 3.2, 11].forEach(x => bgHeater(x, -15));
  at(0, -18.5, 0, () => bgRack(30, 0.9)); [[-12, 8.6, 0.55], [-8, 6.0, 0.4], [-4, 9.4, 0.5], [0, 5.4, 0.36], [4, 7.6, 0.46], [8, 10.2, 0.56], [12, 6.4, 0.4]].forEach(([x, h, r]) => bgCol(x, -21, r, h));
  [21.5, 26, 30.5].forEach(x => [-3, 3.2, 9.4, 15.6].forEach(z => bgTank(x, z, 1.9, 2.4))); at(19.3, 6, PI / 2, () => bgRack(24, 0.7));
  [-10.8, -7.2, -3.6, 0, 3.6, 7.2, 10.8].forEach(x => bgSphere(x, 25.6, 1.35)); [-12, -7.2, -2.4, 2.4, 7.2, 12].forEach(x => bgTank(x, 30.4, 2.1, 2.7)); [-9.6, -4.8, 0, 4.8, 9.6].forEach(x => bgTank(x, 35.4, 2.1, 2.7));
  at(-20.6, 5, PI / 2, () => bgRack(22, 0.9)); [[-2.5, 6.4, 0.42], [1.5, 4.4, 0.34], [5.5, 8.8, 0.52], [9.5, 5.6, 0.38], [13.5, 7.2, 0.46]].forEach(([z, h, r]) => bgCol(-23.4, z, r, h)); [0, 6, 12].forEach(z => bgHeater(-27, z)); [[-30, -1, 11, 0.3], [-30.5, 9, 9.5, 0.28], [22, -14, 10.5, 0.3], [-16, -24, 12, 0.32]].forEach(([x, z, h, r]) => bgCol(x, z, r, h));
  // light poles and crew
  for (let x = -11; x <= 11; x += 5.5) at(x, 11.3, PI, pole); [-7.05, -4.8, 6.4, 8.65].forEach(x => at(x, -1.2, 0, pole)); [3, 7].forEach(z => at(14.8, z, -PI / 2, pole)); [5.6, 8.4].forEach(z => at(-12.5, z, PI / 2, pole));
  [[-9.2, 1.2, 1.9], [-4.4, -1.15, 0.4], [1.6, 1.2, 2.6], [6.3, -1.2, -0.5], [12.6, 4.0, 1.2], [14.5, 7.0, -1.8], [5.0, 9.6, 0.3], [-2.0, 10.9, 2.8], [-9.0, 9.7, -0.6], [-14.4, 5.0, 1.4], [-12.9, 2.0, -2.0]].forEach(([x, z, ry]) => person(m, [x, g, z], ry, 0.27));
  // flight path at eye height: down the pump alley beside the main rack, across under the rack, along the far alley, down the east road, along the tank farm road, south through the gap between the spheres and the tank dike, west down the aisle between the two rows of tanks and spheres, and back up the west road
  const way = [[-9, 2.35], [-6.5, 2.35], [-4.6, 2.25], [-3.17, 1.9], [-1.5, 0.9], [0, 0], [1.5, -0.9], [3.17, -1.9], [4.6, -2.25], [6.5, -2.35], [9, -2.35], [11.3, -2.2], [12.85, -1.45], [13.55, 0.3], [13.6, 2.6], [13.6, 5], [13.55, 7], [13.1, 8.7], [12.0, 9.8], [10.3, 10.2], [8, 10.2], [5.6, 10.2], [3.5, 10.4], [2.1, 11.2], [1.5, 12.6], [1.42, 14.2], [1.2, 15.6], [0.2, 16.6], [-1.6, 16.9], [-4.5, 16.9], [-7.5, 16.9], [-10.4, 16.85], [-12.4, 16.1], [-13.4, 14.5], [-13.6, 12.2], [-13.6, 9.5], [-13.6, 7], [-13.6, 5.2], [-13.35, 3.7], [-12.4, 2.75], [-10.9, 2.38]].map(([x, z]) => [x, g + 0.5, z]);
  return { m, way, noGround: true, hot: { enter: [2.2, 0.2, 0], a: [-0.8, 0.5, 0.4], b: [0, 0.3, 0], c: [0.8, 0.5, -0.4] } };
}

// Turns a model into "slabs" along a closed flight path so particles can be drawn only where the camera is about to be.
// Every triangle and line is cut into pieces no longer than the slab length and filed under the nearest point of the path.
export function makeTour(m, way, cs, step = 0.5) {
  const curve = new THREE.CatmullRomCurve3(way.map(p => new THREE.Vector3(...p)), true, 'centripetal'), len = curve.getLength(), K = Math.round(len / step), v = new THREE.Vector3();
  const P = new Float32Array(K * 3), D = new Float32Array(K * 3); for (let k = 0; k < K; k++) { curve.getPointAt(k / K, v); P.set([v.x, v.y, v.z], k * 3); curve.getTangentAt(k / K, v); D.set([v.x, v.y, v.z], k * 3); }
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; const scan = A => { for (let i = 0; i < A.length; i += 3) { x0 = Math.min(x0, A[i]); x1 = Math.max(x1, A[i]); z0 = Math.min(z0, A[i + 2]); z1 = Math.max(z1, A[i + 2]); } }; scan(m.T); scan(m.S);
  const cell = 0.5, gw = Math.ceil((x1 - x0) / cell) + 1, gh = Math.ceil((z1 - z0) / cell) + 1, grid = new Int16Array(gw * gh);      // nearest slab per ground cell, or -1 when the path is more than 7 units away
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const x = x0 + i * cell, z = z0 + j * cell; let b = 0, bd = 1e9; for (let k = 0; k < K; k++) { const dx = P[k * 3] - x, dz = P[k * 3 + 2] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; b = k; } } grid[j * gw + i] = bd > 49 ? -1 : b; }
  const slabOf = (x, z) => grid[Math.min(gh - 1, Math.max(0, Math.round((z - z0) / cell))) * gw + Math.min(gw - 1, Math.max(0, Math.round((x - x0) / cell)))];
  const G = [], GW = [], GT = [], GS = [];      // geometry (9 numbers per piece; a line is stored as a, b, a), weight, tint, slab
  const tri = (a, b, c, w, t, depth) => { const ab = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), bc = Math.hypot(b[0] - c[0], b[1] - c[1], b[2] - c[2]), ca = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]), mx = Math.max(ab, bc, ca);
    if (mx > 0.8 && depth < 7) { const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]; if (mx === ab) { const h = mid(a, b); tri(a, h, c, w / 2, t, depth + 1); tri(h, b, c, w / 2, t, depth + 1); } else if (mx === bc) { const h = mid(b, c); tri(a, b, h, w / 2, t, depth + 1); tri(a, h, c, w / 2, t, depth + 1); } else { const h = mid(c, a); tri(a, b, h, w / 2, t, depth + 1); tri(h, b, c, w / 2, t, depth + 1); } return; }
    const sl = slabOf((a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3); if (sl < 0) return;
    G.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); GW.push(w * (depth > 0 || mx > 0.22 ? 0.3 : mx < 0.06 ? 1.6 : 0.8)); GT.push(t); GS.push(sl); };
  for (let i = 0; i < m.TW.length; i++) { const j = i * 9, T = m.T; tri([T[j], T[j + 1], T[j + 2]], [T[j + 3], T[j + 4], T[j + 5]], [T[j + 6], T[j + 7], T[j + 8]], m.TW[i], m.TT[i], 0); }
  const nTri = GW.length;
  for (let i = 0; i < m.SW.length; i++) { const j = i * 6, S = m.S, L = Math.hypot(S[j + 3] - S[j], S[j + 4] - S[j + 1], S[j + 5] - S[j + 2]), n = Math.max(1, Math.ceil(L / 0.6)); for (let q = 0; q < n; q++) { const u0 = q / n, u1 = (q + 1) / n, a = [0, 1, 2].map(d => S[j + d] + (S[j + 3 + d] - S[j + d]) * u0), b = [0, 1, 2].map(d => S[j + d] + (S[j + 3 + d] - S[j + d]) * u1); const sl = slabOf((a[0] + b[0]) / 2, (a[2] + b[2]) / 2); if (sl < 0) continue; G.push(a[0], a[1], a[2], b[0], b[1], b[2], a[0], a[1], a[2]); GW.push(m.SW[i] / n * 5); GT.push(m.ST[i]); GS.push(sl); } }
  const n = GW.length, start = new Int32Array(K + 1), order = new Int32Array(n), cum = new Float32Array(n), W = new Float32Array(K);
  for (let i = 0; i < n; i++) start[GS[i] + 1]++; for (let k = 0; k < K; k++) start[k + 1] += start[k]; const fill = start.slice(0, K); for (let i = 0; i < n; i++) order[fill[GS[i]]++] = i;
  for (let k = 0; k < K; k++) { let t = 0; for (let q = start[k]; q < start[k + 1]; q++) cum[q] = (t += GW[order[q]]); W[k] = t; }
  const Gf = new Float32Array(G), Tf = new Float32Array(GT), [cx, cy, cz, sc] = cs;
  // one random surface point of slab k, written into out[o..o+2] in the model's fitted coordinates; returns its tint
  const sample = (k, out, o) => { const a0 = start[k], a1 = start[k + 1]; if (a1 <= a0) return -1; const r = R() * W[k]; let lo = a0, hi = a1 - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
    const i = order[lo], j = i * 9; let u = R(), w = R(); if (i >= nTri) w = 0; else if (u + w > 1) { u = 1 - u; w = 1 - w; } const q = 1 - u - w;
    out[o] = (Gf[j] * q + Gf[j + 3] * u + Gf[j + 6] * w - cx) * sc; out[o + 1] = (Gf[j + 1] * q + Gf[j + 4] * u + Gf[j + 7] * w - cy) * sc; out[o + 2] = (Gf[j + 2] * q + Gf[j + 5] * u + Gf[j + 8] * w - cz) * sc; return Tf[i]; };
  const fit = Q => { for (let i = 0; i < Q.length; i += 3) { Q[i] = (Q[i] - cx) * sc; Q[i + 1] = (Q[i + 1] - cy) * sc; Q[i + 2] = (Q[i + 2] - cz) * sc; } return Q; };
  const wt = new Float32Array(m.ST.length * 2); for (let i = 0; i < m.ST.length; i++) wt[i * 2] = wt[i * 2 + 1] = m.ST[i];
  return { K, len, P: fit(P), D, W, sample, unit: sc, wire: fit(new Float32Array(m.S)), wireTint: wt };
}
const BUILDERS = [plant, mechanical, civilWork, softCraft, cleaning, pipeline, facility, safety, quality, experience, careers];
export function buildAll(N) {
  const out = BUILDERS.map(fn => { const { m, hot, way, noGround } = fn(), b = (noGround ? m : m.ground()).build(N); const H = {}; for (const k in hot) H[k] = hot[k]; return { pos: b.pos, tint: b.tint, hot: H, tourMake: way ? () => makeTour(m, way, b.cs) : null }; });
  const g = gulfMap(N); out.push({ pos: g.pos, tint: g.tint, city: g.city, state: g.state, hot: { enter: [2.2, 0.9, 0], a: g.city(-95.9, 26.3), b: g.city(-99.4, 23.2) }, flat: true });
  return out;
}
