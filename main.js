import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundEngine } from './audio.js?v=3';

/* =========================================================
   Renderer / scene
   ========================================================= */
const canvas = document.getElementById('scene');
const isMobile = window.innerWidth < 760;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const FOG = new THREE.Color(0xe7eaed);
scene.fog = new THREE.FogExp2(FOG, 0.0024);
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 4000);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(3000, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0xaebccb) }, horizon: { value: FOG } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top,horizon; varying vec3 vP;
      void main(){ float h = max(vP.y,0.0); vec3 c = mix(horizon, top, smoothstep(0.02,0.6,h)); gl_FragColor = vec4(c,1.0); }`
  })
);
scene.add(sky);
scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b1a6, 0.75));
const sun = new THREE.DirectionalLight(0xfff4e8, 3.4);
const SUN_OFF = new THREE.Vector3(-70, 120, -60);
sun.castShadow = true;
sun.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 400 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

/* =========================================================
   Materials & helpers
   ========================================================= */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (color, metalness = 0, roughness = 0.75, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
const M = {
  ground: std(0xdcdfe1, 0, 1), pad: std(0xcfd2d4, 0, 0.95), asphalt: std(0x8c9095, 0, 0.92),
  concrete: std(0xc4c1bb, 0, 0.95), steel: std(0x9aa1a8, 0.35, 0.5), struct: std(0x6c737a, 0.25, 0.6),
  dark: std(0x3f454c, 0.2, 0.6), white: std(0xf4f4f2, 0, 0.7), insul: std(0xdfe3e6, 0.45, 0.42),
  red: std(0xe31e24, 0.05, 0.5), yellow: std(0xf2b41a, 0.05, 0.55), green: std(0x8aa391, 0.1, 0.6),
  rubber: std(0x1d1e20, 0, 0.92), chrome: std(0xf0f2f4, 1, 0.14), glass: std(0x23303b, 0.6, 0.12),
  alu: std(0xc9ced3, 0.7, 0.32), wood: std(0xb08a5f, 0, 0.9), dirt: std(0xb7a58d, 0, 1),
  galv: std(0xb3b9bf, 0.6, 0.45), orange: std(0xff6a13, 0, 0.6), blue: std(0x2a5ea8, 0.1, 0.5),
  weld: std(0x555b62, 0.5, 0.55), grate: std(0x7c838a, 0.3, 0.6, { side: THREE.DoubleSide }),
  navy: std(0x24344d, 0, 0.8), vest: std(0xd4e300, 0, 0.7), skin: std(0xd9a77e, 0, 0.8),
  cab: new THREE.MeshPhysicalMaterial({ color: 0xd3141b, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 }),
  lens: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 0.6, roughness: 0.2 }),
  tail: new THREE.MeshStandardMaterial({ color: 0xb00000, emissive: 0xff1010, emissiveIntensity: 0.5, roughness: 0.3 }),
  amber: new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8a00, emissiveIntensity: 0.5, roughness: 0.3 }),
  beacon: new THREE.MeshBasicMaterial({ color: 0xe31e24 }),
};

function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
const box = (w, h, d, mat, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
const rbox = (w, h, d, r, mat, x, y, z, p) => mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat, x, y, z, p);
const cyl = (rt, rb, h, mat, x, y, z, p, seg = 24) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, p);
const zcyl = (r, len, mat, x, y, z, p, seg = 20) => mesh(new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2), mat, x, y, z, p);
const xcyl = (r, len, mat, x, y, z, p, seg = 20) => mesh(new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2), mat, x, y, z, p);

// Beams: unit geometry along +z, oriented in the parent's local space (works inside groups)
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 10).rotateX(Math.PI / 2).translate(0, 0, 0.5);
const pipeGeo = new THREE.CylinderGeometry(1, 1, 1, 20).rotateX(Math.PI / 2).translate(0, 0, 0.5);
const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
const _z = V(0, 0, 1), _up = V(0, 1, 0), _bx = V(), _by = V(), _bz = V(), _m4 = new THREE.Matrix4();
function setBeam(m, a, b, w, h = w) {
  _bz.subVectors(b, a); const L = _bz.length();
  m.position.copy(a);
  if (L < 1e-6) { m.scale.set(w, h, 0.001); return; }
  _bz.divideScalar(L);
  _bx.crossVectors(_up, _bz); if (_bx.lengthSq() < 1e-8) _bx.set(1, 0, 0); _bx.normalize();
  _by.crossVectors(_bz, _bx);
  m.quaternion.setFromRotationMatrix(_m4.makeBasis(_bx, _by, _bz));
  m.scale.set(w, h, L);
}
function beam(a, b, w, mat, parent = scene, geo = beamGeo, h = w) { const m = new THREE.Mesh(geo, mat); parent.add(m); setBeam(m, a, b, w, h); return m; }
const T4 = (x, y, z, ry = 0) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), V(1, 1, 1));
function inst(geo, mat, mats, parent = scene) { const im = new THREE.InstancedMesh(geo, mat, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); parent.add(im); return im; }
const beacons = [];

// ---- Piping: straight runs, long-radius elbows, weld seams, flanges ----
class Arc3 extends THREE.Curve {
  constructor(c, u, d, R, th) { super(); Object.assign(this, { c, u, d, R, th }); }
  getPoint(t, target = new THREE.Vector3()) { const a = t * this.th; return target.copy(this.c).addScaledVector(this.u, -this.R * Math.cos(a)).addScaledVector(this.d, this.R * Math.sin(a)); }
}
function ringAt(p, dir, R, tube, mat) { const m = mesh(new THREE.TorusGeometry(R, tube, 6, 24), mat, p.x, p.y, p.z); m.quaternion.setFromUnitVectors(_z, dir); return m; }
function discAt(p, dir, R, len, mat) { const m = mesh(new THREE.CylinderGeometry(R, R, len, 24).rotateX(Math.PI / 2), mat, p.x, p.y, p.z); m.quaternion.setFromUnitVectors(_z, dir); return m; }
function flangeAt(p, dir, r) {
  [-0.09, 0.09].forEach(o => discAt(p.clone().addScaledVector(dir, o), dir, r * 1.75, 0.14, M.steel));
  discAt(p, dir, r * 1.3, 0.34, M.weld);
}
function routePipe(pts, r, mat, { bend = 3 * r, welds = true } = {}) {
  let prev = pts[0].clone();
  for (let i = 1; i < pts.length; i++) {
    const P = pts[i], d1 = P.clone().sub(pts[i - 1]).normalize();
    if (i === pts.length - 1) { beam(prev, P, r, mat, scene, pipeGeo); break; }
    const d2 = pts[i + 1].clone().sub(P).normalize();
    const th = Math.acos(THREE.MathUtils.clamp(d1.dot(d2), -1, 1));
    if (th < 0.01) continue;
    const t = bend * Math.tan(th / 2);
    const A = P.clone().addScaledVector(d1, -t), B = P.clone().addScaledVector(d2, t);
    beam(prev, A, r, mat, scene, pipeGeo);
    const u = d2.clone().addScaledVector(d1, -d1.dot(d2)).normalize();
    mesh(new THREE.TubeGeometry(new Arc3(A.clone().addScaledVector(u, bend), u, d1, bend, th), 12, r, 20), mat);
    if (welds) { ringAt(A, d1, r + 0.012, 0.035, M.weld); ringAt(B, d2, r + 0.012, 0.035, M.weld); }
    prev = B;
  }
}
function tPost(x, y, z, alongX = false) {
  box(0.22, y, 0.22, M.struct, x, y / 2, z); box(0.9, 0.3, 0.9, M.concrete, x, 0.15, z);
  box(alongX ? 0.3 : 1.1, 0.16, alongX ? 1.1 : 0.3, M.struct, x, y - 0.08, z);
}
class Helix extends THREE.Curve {
  constructor(cx, cz, R, a0, a1, y0, y1) { super(); Object.assign(this, { cx, cz, R, a0, a1, y0, y1 }); }
  getPoint(t, target = new THREE.Vector3()) { const a = this.a0 + (this.a1 - this.a0) * t; return target.set(this.cx + this.R * Math.cos(a), this.y0 + (this.y1 - this.y0) * t, this.cz + this.R * Math.sin(a)); }
}
function radialCyl(cx, cz, a, rad, y, r, len, mat) { const m = zcyl(r, len, mat, cx + rad * Math.cos(a), y, cz + rad * Math.sin(a), scene, 20); m.rotation.y = Math.PI / 2 - a; return m; }

// ---- Crew ----
function person(x, y, z, ry = 0, hat = 0xffffff, hood = false) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
  [-0.11, 0.11].forEach(o => rbox(0.17, 0.86, 0.2, 0.05, M.navy, o, 0.43, 0, g));
  rbox(0.46, 0.62, 0.26, 0.08, M.vest, 0, 1.17, 0, g);
  [-0.3, 0.3].forEach(o => rbox(0.13, 0.6, 0.15, 0.05, M.navy, o, 1.15, 0, g));
  mesh(new THREE.SphereGeometry(0.12, 12, 10), M.skin, 0, 1.62, 0, g);
  const hm = std(hat, 0, 0.5);
  mesh(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hm, 0, 1.65, 0, g);
  cyl(0.18, 0.18, 0.02, hm, 0, 1.66, 0.03, g, 14);
  if (hood) rbox(0.22, 0.26, 0.08, 0.03, M.dark, 0, 1.6, 0.12, g);
  return g;
}

const texLoader = new THREE.TextureLoader();
const logoTex = texLoader.load('assets/pmi-logo.png'); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8;
const logoMat = new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.5, alphaTest: 0.05 });
function windowsTex(cols, rows) {
  const c = document.createElement('canvas'); c.width = cols * 16; c.height = rows * 24;
  const x = c.getContext('2d'); x.fillStyle = '#f4f4f2'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { x.fillStyle = '#2b3743'; x.fillRect(i * 16 + 3, j * 24 + 6, 10, 12); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* =========================================================
   Ground, roads, fence
   ========================================================= */
const groundMesh = mesh(new THREE.PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2), M.ground);
mesh(new THREE.PlaneGeometry(310, 215).rotateX(-Math.PI / 2), M.pad, 0, 0.02, 5);
mesh(new THREE.PlaneGeometry(14, 1700).rotateX(-Math.PI / 2), M.asphalt, 0, 0.04, -96 - 850);
mesh(new THREE.PlaneGeometry(14, 200).rotateX(-Math.PI / 2), M.asphalt, 0, 0.04, 4);
{
  const dm = []; for (let i = 0; i < 300; i++) dm.push(T4(0, 0.06, -100 - i * 6));
  inst(new THREE.PlaneGeometry(0.18, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2c230 }), dm);
  [-6.6, 6.6].forEach(x => mesh(new THREE.PlaneGeometry(0.15, 1700).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }), x, 0.06, -946));
  for (let z = -130; z > -1200; z -= 55) {
    const side = (Math.round(z / 55) % 2) ? -17 : 17;
    cyl(0.1, 0.14, 10, M.struct, side, 5, z, scene, 8);
    box(2.4, 0.14, 0.3, M.struct, side * 0.93, 10, z);
  }
  const pm = []; for (let x = -155; x <= 155; x += 5) if (Math.abs(x) >= 9) pm.push(T4(x, 1.3, -96));
  inst(new THREE.BoxGeometry(0.1, 2.6, 0.1), M.galv, pm);
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x8a9198, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
  [-1, 1].forEach(s => { mesh(new THREE.PlaneGeometry(146, 2.4), fenceMat, s * 82, 1.25, -96); box(146, 0.06, 0.06, M.galv, s * 82, 2.55, -96); });
}

/* =========================================================
   Process unit
   ========================================================= */
const RACK = { x0: 10, x1: 18, z0: -80, z1: 86, top: 12.3 };

function column(x, z, r, h, lane, zEnd, { scaffold = false } = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  cyl(r * 1.35, r * 1.35, 0.8, M.concrete, 0, 0.4, 0, g, 8);
  cyl(r, r * 1.02, 3.5, M.struct, 0, 2.5, 0, g, 40);                       // skirt
  rbox(1.0, 1.9, 0.3, 0.05, M.dark, 0, 1.9, r - 0.05, g);                   // skirt access opening
  cyl(r, r, h, M.insul, 0, 4.2 + h / 2, 0, g, 48);
  const hd = mesh(new THREE.SphereGeometry(r, 48, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.insul, 0, 4.2 + h, 0, g); hd.scale.y = 0.5;
  for (let y = 7; y < h; y += 3) mesh(new THREE.TorusGeometry(r + 0.01, 0.022, 4, 48).rotateX(Math.PI / 2), M.galv, 0, y, 0, g);
  const top = 4.2 + h + r * 0.5;
  // platforms with grating, brackets, handrail posts and rails, manway at each level
  const posts = [];
  for (let y = scaffold ? 30 : 12; y < h - 2; y += 9) {
    mesh(new THREE.RingGeometry(r, r + 1.5, 48).rotateX(-Math.PI / 2), M.grate, 0, y, 0, g);
    mesh(new THREE.TorusGeometry(r + 1.5, 0.06, 4, 48).rotateX(Math.PI / 2), M.struct, 0, y - 0.03, 0, g);
    [0.55, 1.1].forEach(o => mesh(new THREE.TorusGeometry(r + 1.45, 0.035, 4, 48).rotateX(Math.PI / 2), M.yellow, 0, y + o, 0, g));
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; posts.push(T4(Math.cos(a) * (r + 1.45), y + 0.55, Math.sin(a) * (r + 1.45))); }
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.5; beam(V(Math.cos(a) * r, y - 1.4, Math.sin(a) * r), V(Math.cos(a) * (r + 1.4), y - 0.06, Math.sin(a) * (r + 1.4)), 0.06, M.struct, g); }
    zcyl(0.45, 0.6, M.insul, 0, y + 1.0, r + 0.2, g, 20); zcyl(0.6, 0.08, M.steel, 0, y + 1.0, r + 0.52, g, 20);
    box(0.6, 0.14, 0.3, M.struct, -(r + 1.72), y - 0.1, 0, g);              // downcomer support
  }
  if (posts.length) inst(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), M.yellow, posts, g);
  // ladder
  [-0.25, 0.25].forEach(o => box(0.05, h, 0.05, M.struct, r + 0.3, 4.2 + h / 2, o, g));
  const rungs = []; for (let y = 4.5; y < 4.2 + h; y += 0.4) rungs.push(T4(r + 0.3, y, 0));
  inst(new THREE.BoxGeometry(0.03, 0.03, 0.5), M.struct, rungs, g);
  // overhead line: top nozzle -> down the column -> across to the rack -> onto its lane
  const pr = 0.35, yh = RACK.top + pr + 2.4, xd = x - r - 2.1;
  routePipe([V(x, top - 0.2, z), V(x, top + 1.7, z), V(xd, top + 1.7, z), V(xd, yh, z), V(lane, yh, z), V(lane, RACK.top + pr, z), V(lane, RACK.top + pr, zEnd)], pr, M.insul);
  flangeAt(V(x, top + 0.3, z), _up, pr);
  for (let px = xd - 4; px > 19.5; px -= 8) tPost(px, yh - pr, z, true);
  if (scaffold) buildScaffold(x, z, r, Math.min(h - 6, 26));
}

function buildScaffold(cx, cz, r, height) {
  const half = r + 1.4, bay = 2.0, lift = 2.0, verts = [];
  for (let s = -half; s <= half + 0.01; s += bay) for (const side of [-half, half]) { verts.push([s, side]); verts.push([side, s]); }
  const uniq = [...new Map(verts.map(v => [v.map(n => n.toFixed(2)).join(','), v])).values()];
  inst(new THREE.CylinderGeometry(0.04, 0.04, height, 6), M.galv, uniq.map(v => T4(cx + v[0], height / 2, cz + v[1])));
  inst(new THREE.BoxGeometry(0.5, 0.05, 0.5), M.wood, uniq.map(v => T4(cx + v[0], 0.03, cz + v[1])));
  const span = half * 2, levels = Math.floor(height / lift), L = [], P = [], K = [];
  for (let l = 1; l <= levels; l++) for (let k = 0; k < 4; k++) {
    const y = l * lift, ry = k % 2 ? Math.PI / 2 : 0, off = (k < 2 ? -1 : 1) * half, inw = k < 2 ? 0.6 : -0.6;
    L.push(k % 2 ? T4(cx + off, y, cz, ry) : T4(cx, y, cz + off, ry));
    if (l % 2 === 0) {
      P.push(k % 2 ? T4(cx + off + inw, y + 0.05, cz, ry) : T4(cx, y + 0.05, cz + off + inw, ry));
      K.push(k % 2 ? T4(cx + off, y + 0.15, cz, ry) : T4(cx, y + 0.15, cz + off, ry));
      L.push(k % 2 ? T4(cx + off, y + 1.0, cz, ry) : T4(cx, y + 1.0, cz + off, ry));
    }
  }
  inst(new THREE.BoxGeometry(span, 0.07, 0.07), M.galv, L);
  inst(new THREE.BoxGeometry(span, 0.06, 1.1), M.wood, P);
  inst(new THREE.BoxGeometry(span, 0.2, 0.03), M.yellow, K);
}

// Pipe rack
{
  const bents = []; for (let z = RACK.z0; z <= RACK.z1; z += 6) bents.push(z);
  const xc = (RACK.x0 + RACK.x1) / 2;
  inst(new THREE.BoxGeometry(0.45, 12.4, 0.45), M.struct, bents.flatMap(z => [T4(RACK.x0, 6.2, z), T4(RACK.x1, 6.2, z)]));
  inst(new THREE.BoxGeometry(1.2, 0.5, 1.2), M.concrete, bents.flatMap(z => [T4(RACK.x0, 0.25, z), T4(RACK.x1, 0.25, z)]));
  inst(new THREE.BoxGeometry(8.6, 0.4, 0.35), M.struct, bents.flatMap(z => [T4(xc, 6.4, z), T4(xc, 12.1, z)]));
  const L = RACK.z1 - RACK.z0, zc = (RACK.z0 + RACK.z1) / 2;
  [RACK.x0, RACK.x1].forEach(x => [6.4, 12.1].forEach(y => box(0.3, 0.3, L, M.struct, x, y, zc)));
  // knee bracing every other bay
  bents.forEach((z, i) => { if (i % 4 === 0 && i < bents.length - 1) [RACK.x0, RACK.x1].forEach(x => { beam(V(x, 0.6, z), V(x, 6.2, z + 6), 0.08, M.struct); beam(V(x, 6.2, z), V(x, 0.6, z + 6), 0.08, M.struct); }); });
  const pipe = (x, y, r, mat) => { zcyl(r, L, mat, x, y + r, zc, scene, 20); for (let z = RACK.z0 + 9; z < RACK.z1; z += 12) ringAt(V(x, y + r, z), _z, r + 0.01, 0.025, M.weld); };
  [[12.3, 0.5, M.steel], [13.2, 0.3, M.yellow]].forEach(([x, r, m]) => pipe(x, RACK.top, r, m));
  [[10.8, 0.3, M.steel], [11.8, 0.42, M.insul], [12.9, 0.25, M.green], [13.9, 0.36, M.steel], [15.0, 0.3, M.insul], [16.1, 0.45, M.steel], [17.2, 0.22, M.red]]
    .forEach(([x, r, m]) => pipe(x, 6.6, r, m));
  box(0.9, 0.12, L, M.galv, RACK.x1 - 0.6, 9.6, zc);
  [-0.42, 0.42].forEach(o => box(0.04, 0.2, L, M.galv, RACK.x1 - 0.6 + o, 9.7, zc));
}

column(34, -26, 3, 50, 14.2, RACK.z0, { scaffold: true });
column(47, -6, 2.3, 38, 16.0, RACK.z1);
column(34, 14, 3.6, 62, 16.9, RACK.z1);
column(50, 30, 2, 30, 17.6, RACK.z1);
column(62, -40, 2.6, 44, 15.1, RACK.z0);

// Horizontal drums / exchangers on saddles, with nozzles
[[-52, 1.6, 9], [-62, 1.4, 8], [40, 1.2, 6]].forEach(([z, r, l]) => {
  zcyl(r, l, M.white, 26, 3.4, z, scene, 32);
  [-1, 1].forEach(s => { const hd = mesh(new THREE.SphereGeometry(r, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(s * Math.PI / 2), M.white, 26, 3.4, z + s * l / 2); hd.scale.z = 0.5; ringAt(V(26, 3.4, z + s * l / 2), _z, r + 0.01, 0.03, M.weld); });
  [-l / 3, l / 3].forEach(o => { box(r * 1.7, 3.4 - r * 0.6, 0.4, M.concrete, 26, (3.4 - r * 0.6) / 2, z + o); box(r * 1.5, 0.2, 0.6, M.struct, 26, 3.4 - r * 0.75, z + o); });
  cyl(0.25, 0.25, 0.7, M.steel, 26, 3.4 + r + 0.3, z, scene, 16); flangeAt(V(26, 3.4 + r + 0.6, z), _up, 0.25);
  cyl(0.5, 0.5, 0.4, M.white, 26, 3.4 + r + 0.15, z + l / 4, scene, 20); cyl(0.62, 0.62, 0.08, M.steel, 26, 3.4 + r + 0.4, z + l / 4, scene, 20);
});
// Fired heater
{
  rbox(14, 12, 9, 0.2, std(0xb9bcbf, 0.1, 0.7), 34, 6, 46);
  for (let y = 3; y < 12; y += 3) box(14.15, 0.14, 9.15, M.struct, 34, y, 46);
  [-6.9, -3.5, 0, 3.5, 6.9].forEach(o => box(0.25, 12, 0.25, M.struct, 34 + o, 6, 41.4));
  [-3.5, 3.5].forEach(o => { cyl(1.6, 2.6, 3, std(0xb9bcbf, 0.1, 0.7), 34 + o, 13.5, 46, scene, 24); cyl(1.2, 1.4, 27, M.struct, 34 + o, 28.5, 46, scene, 24); beacons.push(mesh(new THREE.SphereGeometry(0.3, 10, 8), M.beacon, 34 + o, 42.2, 46)); });
}
// Spheres
[70, 88, 106].forEach(x => {
  mesh(new THREE.SphereGeometry(7, 48, 28), M.white, x, 10, -58);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; cyl(0.3, 0.3, 10, M.struct, x + Math.cos(a) * 6.3, 5, -58 + Math.sin(a) * 6.3, scene, 10); box(1, 0.4, 1, M.concrete, x + Math.cos(a) * 6.3, 0.2, -58 + Math.sin(a) * 6.3); }
  mesh(new THREE.TorusGeometry(7.02, 0.05, 4, 48).rotateX(Math.PI / 2), M.galv, x, 10, -58);
  cyl(1.6, 1.6, 0.1, M.grate, x, 17.05, -58, scene, 20); cyl(0.3, 0.3, 0.8, M.steel, x, 17.4, -58, scene, 12);
});
// Cooling tower
{
  rbox(34, 10, 14, 0.2, std(0xaab3ba, 0.1, 0.8), 80, 5, 18);
  for (let i = 0; i < 4; i++) cyl(3, 3.2, 2.4, std(0x8a949c, 0.2, 0.7), 67 + i * 8.6, 11.2, 18, scene, 28);
}
// Flare
const FLARE = V(118, 84, 78);
{
  cyl(0.9, 1.4, 84, M.struct, FLARE.x, 42, FLARE.z, scene, 14);
  cyl(1.4, 1.1, 3, M.steel, FLARE.x, 85, FLARE.z, scene, 14);
  [0, 2.1, 4.2].forEach(a => beam(V(FLARE.x, 60, FLARE.z), V(FLARE.x + Math.cos(a) * 45, 0, FLARE.z + Math.sin(a) * 45), 0.04, M.galv));
}
const flame = new THREE.Group(); flame.position.set(FLARE.x, 86.5, FLARE.z); scene.add(flame);
mesh(new THREE.ConeGeometry(1.6, 7, 16, 1, true).translate(0, 3.5, 0), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }), 0, 0, 0, flame);
mesh(new THREE.ConeGeometry(0.9, 4.5, 16, 1, true).translate(0, 2.25, 0), new THREE.MeshBasicMaterial({ color: 0xffd36b, side: THREE.DoubleSide }), 0, 0, 0, flame);

// Tank farm: spiral stairs, roof handrail, manway, nozzle + valve
const TANKS = [[-50, -42, 13, 15], [-50, 0, 14, 17], [-50, 42, 12, 14], [-88, -42, 14, 16], [-88, 0, 13, 15], [-88, 42, 14, 17], [-126, -21, 15, 15], [-126, 24, 14, 16]];
const seam = std(0xd9dbdc);
TANKS.forEach(([x, z, r, h], i) => {
  const top = 0.8 + h;
  cyl(r + 0.4, r + 0.4, 0.8, M.concrete, x, 0.4, z, scene, 48);
  cyl(r, r, h, M.white, x, 0.8 + h / 2, z, scene, 72);
  for (let k = 1; k < 6; k++) mesh(new THREE.TorusGeometry(r + 0.005, 0.025, 4, 72).rotateX(Math.PI / 2), seam, x, 0.8 + h * k / 6, z);
  mesh(new THREE.ConeGeometry(r + 0.1, 1.8, 72, 1, true), M.white, x, top + 0.9, z);
  mesh(new THREE.TorusGeometry(r + 0.06, 0.1, 6, 72).rotateX(Math.PI / 2), M.struct, x, top, z);
  [0.55, 1.05].forEach(o => mesh(new THREE.TorusGeometry(r, 0.035, 4, 72).rotateX(Math.PI / 2), M.yellow, x, top + o, z));
  const posts = []; for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; posts.push(T4(x + Math.cos(a) * r, top + 0.52, z + Math.sin(a) * r)); }
  cyl(0.3, 0.3, 0.9, M.steel, x, top + 2.1, z, scene, 14);
  // spiral stair
  const R = r + 0.55, a0 = 1.0, a1 = a0 + h * 1.15 / R, n = Math.round(h / 0.21), treads = [];
  for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, a = a0 + (a1 - a0) * t; treads.push(T4(x + R * Math.cos(a), 0.8 + h * t, z + R * Math.sin(a), Math.PI / 2 - a)); if (k % 5 === 0) posts.push(T4(x + (r + 1.0) * Math.cos(a), 0.8 + h * t + 0.52, z + (r + 1.0) * Math.sin(a))); }
  inst(new THREE.BoxGeometry(0.3, 0.05, 0.9), M.grate, treads);
  inst(new THREE.CylinderGeometry(0.03, 0.03, 1.05, 6), M.yellow, posts);
  [r + 0.1, r + 1.0].forEach(Rs => mesh(new THREE.TubeGeometry(new Helix(x, z, Rs, a0, a1, 0.7, top - 0.1), 48, 0.06, 6), M.struct));
  mesh(new THREE.TubeGeometry(new Helix(x, z, r + 1.0, a0, a1, 1.85, top + 1.05), 48, 0.035, 6), M.yellow);
  const lm = box(1.4, 0.08, 1.3, M.grate, x + R * Math.cos(a1 + 0.05), top, z + R * Math.sin(a1 + 0.05)); lm.rotation.y = Math.PI / 2 - a1;
  // shell manway, outlet nozzle with valve
  radialCyl(x, z, -0.9, r + 0.2, 1.9, 0.5, 0.5, M.white); radialCyl(x, z, -0.9, r + 0.5, 1.9, 0.62, 0.08, M.steel);
  radialCyl(x, z, -1.25, r + 0.55, 1.4, 0.22, 1.2, M.steel); radialCyl(x, z, -1.25, r + 1.2, 1.4, 0.4, 0.3, M.weld);
  const vx = x + (r + 1.6) * Math.cos(-1.25), vz = z + (r + 1.6) * Math.sin(-1.25);
  rbox(0.55, 0.6, 0.55, 0.08, M.blue, vx, 1.4, vz); cyl(0.04, 0.04, 0.6, M.steel, vx, 1.9, vz, scene, 8);
  mesh(new THREE.TorusGeometry(0.3, 0.035, 6, 20).rotateX(Math.PI / 2), M.red, vx, 2.2, vz);
  if (i === 1) { const w = 15, th = w / r; mesh(new THREE.CylinderGeometry(r + 0.06, r + 0.06, w / 1.515, 40, 1, true, Math.PI / 2 - th / 2, th), logoMat, x, 0.8 + h * 0.55, z); }
});
{
  const x0 = -146, x1 = -32, z0 = -64, z1 = 64;
  box(x1 - x0, 1, 0.5, M.concrete, (x0 + x1) / 2, 0.5, z0); box(x1 - x0, 1, 0.5, M.concrete, (x0 + x1) / 2, 0.5, z1);
  box(0.5, 1, z1 - z0, M.concrete, x0, 0.5, 0); box(0.5, 1, z1 - z0, M.concrete, x1, 0.5, 0);
}

// Facility services
{
  const side = new THREE.MeshStandardMaterial({ map: windowsTex(20, 2), roughness: 0.7 });
  mesh(new THREE.BoxGeometry(14, 7, 28), [side, side, M.white, M.white, side, side], -24, 3.5, -70);
  box(14.6, 0.6, 28.6, M.struct, -24, 7.3, -70);
  rbox(4, 1.8, 6, 0.1, M.galv, -26, 8.5, -74);
  [0xbfc3c7, 0x2b2f34, 0xb3161c, 0x9aa4ad, 0xf2f2f2, 0x26364d, 0x5b6167].forEach((c, i) => {
    const car = new THREE.Group(); car.position.set(-10.5, 0, -82 + i * 3.4); scene.add(car);
    rbox(2, 0.85, 4.4, 0.25, std(c, 0.5, 0.35), 0, 0.75, 0, car); rbox(1.75, 0.65, 2.3, 0.2, M.glass, 0, 1.4, -0.2, car);
    [-1.4, 1.4].forEach(zz => [-0.95, 0.95].forEach(xx => xcyl(0.33, 0.22, M.rubber, xx, 0.33, zz, car, 16)));
  });
  cyl(0.06, 0.06, 12, M.galv, -16, 6, -54, scene, 8);
  rbox(3, 3, 3, 0.1, M.white, -10, 1.5, -100); box(2.6, 1.0, 0.05, M.glass, -10, 2.0, -98.48); box(3.4, 0.2, 3.4, M.struct, -10, 3.1, -100);
  box(0.4, 1.2, 0.4, M.dark, -7.6, 0.6, -97.5);
}
const barrier = new THREE.Group(); barrier.position.set(-7.6, 1.15, -97.5); scene.add(barrier);
{ const arm = new THREE.Group(); barrier.add(arm); for (let i = 0; i < 7; i++) box(2, 0.18, 0.12, i % 2 ? M.white : M.red, 1 + i * 2, 0, 0, arm); }

// Civil: foundations, formwork, rebar, excavator
{
  const C = V(-16, 0, 56);
  mesh(new THREE.PlaneGeometry(26, 22).rotateX(-Math.PI / 2), M.dirt, C.x, 0.03, C.z);
  box(6, 1.2, 6, M.concrete, C.x - 6, 0.6, C.z - 4); box(6, 1.2, 6, M.concrete, C.x + 2, 0.6, C.z - 4);
  const ab = []; [-6, 2].forEach(ox => [-2, 2].forEach(a => [-2, 2].forEach(b => ab.push(T4(C.x + ox + a, 1.45, C.z - 4 + b)))));
  inst(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), M.steel, ab);
  box(14, 0.9, 4, M.concrete, C.x - 2, 0.45, C.z + 5);
  [-1, 1].forEach(s => box(0.15, 1.2, 6.4, M.wood, C.x + 8 + s * 3.1, 0.6, C.z - 4));
  [-1, 1].forEach(s => box(6.4, 1.2, 0.15, M.wood, C.x + 8, 0.6, C.z - 4 + s * 3.1));
  const rb = []; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) rb.push(T4(C.x + 5.5 + i, 1.0, C.z - 6.5 + j));
  inst(new THREE.CylinderGeometry(0.03, 0.03, 2, 4), std(0x8a4a2e, 0.4, 0.6), rb);
  mesh(new THREE.ConeGeometry(4, 3, 16), M.dirt, C.x - 9, 1.5, C.z + 6);
  const ex = new THREE.Group(); ex.position.set(C.x + 1, 0, C.z + 10); ex.rotation.y = -0.6; scene.add(ex);
  [-1.25, 1.25].forEach(o => { rbox(0.7, 0.85, 4.6, 0.35, M.rubber, o, 0.43, 0, ex); rbox(0.5, 0.5, 3.8, 0.2, M.dark, o, 0.45, 0, ex); });
  rbox(2.0, 0.4, 2.2, 0.08, M.dark, 0, 0.95, 0, ex);
  rbox(2.7, 1.2, 3.4, 0.15, M.yellow, 0, 1.75, -0.4, ex);
  rbox(2.7, 1.0, 0.8, 0.25, M.dark, 0, 1.7, -2.3, ex);
  rbox(1.0, 1.5, 1.5, 0.1, M.yellow, -0.8, 3.08, 0.6, ex);
  box(0.9, 0.95, 0.05, M.glass, -0.8, 3.2, 1.36, ex); box(0.05, 0.95, 1.2, M.glass, -1.31, 3.2, 0.6, ex);
  const bx = 0.45, p0 = V(bx, 2.3, 0.9), p1 = V(bx, 5.4, 4.2), p2 = V(bx, 1.9, 6.7);
  beam(p0, p1, 0.42, M.yellow, ex, boxGeo, 0.6);
  beam(p1, p2, 0.32, M.yellow, ex, boxGeo, 0.45);
  zcyl(0.3, 0.5, M.dark, bx, 5.4, 4.2, ex).rotation.y = Math.PI / 2;
  beam(V(bx, 2.5, 1.9), V(bx, 4.2, 3.3), 0.09, M.chrome, ex);
  beam(V(bx, 5.75, 4.0), V(bx, 4.3, 5.4), 0.08, M.chrome, ex);
  const bk = rbox(1.1, 0.9, 1.0, 0.15, M.dark, bx, 1.45, 6.9, ex); bk.rotation.x = 0.5;
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; mesh(new THREE.ConeGeometry(0.25, 0.75, 10), M.orange, C.x + Math.cos(a) * 14, 0.38, C.z + Math.sin(a) * 12); }
  person(C.x + 9.5, 0, C.z + 1, 2.6, 0xffffff); person(C.x - 2, 0.9, C.z + 5, 0.4, 0xf2b41a);
}

// Industrial cleaning: vac truck + hydroblast
const NOZZLE = V(-31.5, 2.2, -44), SHELL = V(-37.2, 3.6, -44);
{
  const vt = new THREE.Group(); vt.position.set(-23, 0, -42); scene.add(vt);
  box(2.2, 0.4, 10, M.dark, 0, 1, 0, vt);
  rbox(2.4, 2.4, 2.2, 0.2, M.white, 0, 2.3, 4, vt); box(2.2, 0.9, 0.05, M.glass, 0, 2.9, 5.11, vt);
  zcyl(1.25, 6.6, M.red, 0, 2.6, -1.3, vt, 32);
  [-4.6, 2.0].forEach(zz => { const hd = mesh(new THREE.SphereGeometry(1.25, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(zz < 0 ? -Math.PI / 2 : Math.PI / 2), M.red, 0, 2.6, zz, vt); hd.scale.z = 0.4; });
  [-3.5, -1.3, 0.9].forEach(zz => mesh(new THREE.TorusGeometry(1.27, 0.05, 6, 32), M.steel, 0, 2.6, zz, vt));
  [-4, -2.8, 3.8].forEach(zz => [-1.1, 1.1].forEach(xx => { xcyl(0.5, 0.4, M.rubber, xx, 0.5, zz, vt, 20); xcyl(0.28, 0.42, M.chrome, xx, 0.5, zz, vt, 16); }));
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-23, 2, -46.5), V(-26, 0.15, -47), V(-29, 0.12, -45.5), V(-31.1, 1.3, -44)]), 30, 0.07, 8), M.dark);
  rbox(0.6, 0.6, 1.4, 0.08, M.yellow, -29, 0.3, -50);
  person(-31, 0, -44, -Math.PI / 2, 0xffffff, true); beam(V(-31.2, 1.25, -44), NOZZLE, 0.03, M.steel);
  person(-27.5, 0, -47.5, -1.9, 0xf2b41a);
}
const spray = (() => {
  const n = 380, pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) seed[i] = Math.random();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.14, color: 0x7fb4e0, transparent: true, opacity: 0.75, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  return { pts, seed, pos, n };
})();

// Pipeline: comes off the rack, drops to grade, heads out on sleepers
{
  const pr = 0.5, zP = 104;
  routePipe([V(12.3, RACK.top + pr, 86), V(12.3, RACK.top + pr, 93), V(12.3, 1.4, 93), V(12.3, 1.4, zP), V(4, 1.4, zP)], pr, M.steel);
  flangeAt(V(12.3, RACK.top + pr, 86.4), _z, pr); tPost(12.3, RACK.top, 90); box(1.4, 0.9, 0.6, M.concrete, 12.3, 0.45, 98);
  xcyl(pr, 1600, std(0x55625a, 0.3, 0.5), -796, 1.4, zP, scene, 20);
  const sl = []; for (let i = 0; i < 70; i++) sl.push(T4(-4 - i * 9, 0.45, zP));
  inst(new THREE.BoxGeometry(0.6, 0.9, 2), M.concrete, sl);
  for (let i = 0; i < 12; i++) ringAt(V(-9 - i * 12, 1.4, zP), V(1, 0, 0), pr + 0.012, 0.035, M.weld);
  mesh(new THREE.PlaneGeometry(1600, 30).rotateX(-Math.PI / 2), std(0xcfccbf, 0, 1), -800, 0.025, zP);
  // pig launcher on a kicker line
  routePipe([V(6, 1.4, zP), V(6, 1.4, zP + 4), V(7.5, 1.4, zP + 4)], 0.3, M.steel, { bend: 0.9 });
  xcyl(0.7, 5.5, M.steel, 10.2, 1.4, zP + 4, scene, 24); mesh(new THREE.CylinderGeometry(0.3, 0.7, 0.8, 24).rotateZ(Math.PI / 2), M.steel, 7.1, 1.4, zP + 4);
  xcyl(0.9, 0.35, M.dark, 13.1, 1.4, zP + 4, scene, 24);
  [8.5, 11.5].forEach(x => box(0.5, 0.75, 1.2, M.concrete, x, 0.37, zP + 4));
  [[2, zP, 0.5], [6, zP + 2, 0.3]].forEach(([x, z, r]) => { rbox(r * 2.6, r * 2.8, r * 2.6, 0.08, M.blue, x, 1.4, z); cyl(0.05, 0.05, 1, M.steel, x, 1.4 + r * 1.4 + 0.5, z, scene, 8); mesh(new THREE.TorusGeometry(0.4, 0.04, 6, 24).rotateX(Math.PI / 2), M.red, x, 1.4 + r * 1.4 + 1, z); });
  flangeAt(V(0.9, 1.4, zP), V(1, 0, 0), pr); flangeAt(V(3.1, 1.4, zP), V(1, 0, 0), pr);
  box(7, 0.3, 4, M.galv, -10, 0.15, zP + 6); rbox(5, 3, 3, 0.1, M.white, -10, 1.8, zP + 6);
  for (let i = 0; i < 20; i++) cyl(0.08, 0.08, 1.5, M.yellow, -40 - i * 70, 0.75, zP - 4, scene, 6);
  person(-5, 0, zP + 3, 2.4, 0xffffff);
}

// Fab / weld station in the unit
const WELD = V(24.35, 1.25, -18);
{
  zcyl(0.3, 6, M.steel, 24, 1.0, -18, scene, 24);
  ringAt(V(24, 1.0, -18), _z, 0.312, 0.04, M.weld);
  flangeAt(V(24, 1.0, -21), _z, 0.3);
  [-20, -16].forEach(z => { cyl(0.05, 0.4, 0.68, M.yellow, 24, 0.34, z, scene, 3); box(0.5, 0.04, 0.12, M.yellow, 24, 0.69, z); });
  rbox(0.8, 0.9, 1.3, 0.08, M.red, 26.6, 0.55, -20.5); [-0.4, 0.4].forEach(o => xcyl(0.22, 0.9, M.rubber, 26.6, 0.22, -20.5 + o, scene, 14));
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(26.2, 0.6, -20.2), V(25.8, 0.05, -19.4), V(25.2, 0.05, -18.4), V(24.8, 1.1, -18)]), 20, 0.025, 6), M.dark);
  person(24.85, 0, -18, -Math.PI / 2, 0xffffff, true);
  person(26.2, 0, -15.5, -2.2, 0xe31e24);
  rbox(0.3, 0.55, 0.3, 0.1, M.red, 26.9, 0.3, -15.2);   // fire extinguisher
}
const weldTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(190,225,255,.9)'); g.addColorStop(1, 'rgba(120,180,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const arc = new THREE.Sprite(new THREE.SpriteMaterial({ map: weldTex, depthWrite: false, transparent: true })); arc.position.copy(WELD); scene.add(arc);
const arcLight = new THREE.PointLight(0xaad4ff, 0, 14, 1.5); arcLight.position.copy(WELD); scene.add(arcLight);
const sparks = (() => {
  const n = 40, pos = new Float32Array(n * 3), seed = [...Array(n)].map(() => [Math.random(), Math.random() * 6.28, 0.5 + Math.random()]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.07, color: 0xff9a2e, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);
  return { pts, pos, seed, n };
})();

// Background skyline + lane lighting
{
  let s = 7; const rnd = (a, b) => { s = (s * 16807) % 2147483647; return a + (s / 2147483647) * (b - a); };
  const bg = std(0xc9cfd4, 0.1, 0.85);
  for (let i = 0; i < 60; i++) {
    const x = rnd(-700, 700), z = rnd(260, 900), t = rnd(0, 1);
    if (Math.abs(x) < 60 && z < 320) continue;
    if (t < 0.5) { const h = rnd(20, 70); cyl(rnd(1.5, 3.5), rnd(1.5, 3.5), h, bg, x, h / 2, z, scene, 12); }
    else if (t < 0.8) { const r = rnd(8, 16), h = rnd(8, 15); cyl(r, r, h, bg, x, h / 2, z, scene, 24); }
    else { const h = rnd(10, 25); box(rnd(10, 30), h, rnd(10, 20), bg, x, h / 2, z); }
  }
  for (let z = -86; z < 96; z += 18) { cyl(0.1, 0.12, 9, M.struct, -7.8, 4.5, z, scene, 8); box(1.2, 0.15, 0.3, M.struct, -7.3, 9, z); }
}

/* =========================================================
   Truck: PMI tractor + flatbed hauling pipe
   ========================================================= */
const truck = new THREE.Group(); scene.add(truck);
const wheels = [];
const LIFT_LOCAL = V(0, 3.53, -1.5);
let liftPipe;
{
  const t = truck;
  box(2.6, 0.22, 13, M.alu, 0, 1.45, -1.5, t);
  [-0.55, 0.55].forEach(x => box(0.22, 0.55, 13, M.dark, x, 1.07, -1.5, t));
  for (let z = -7.5; z < 5; z += 1.25) box(2.5, 0.12, 0.12, M.dark, 0, 1.28, z, t);
  [-1.31, 1.31].forEach(x => box(0.06, 0.28, 13, M.alu, x, 1.45, -1.5, t));
  rbox(2.6, 1.7, 0.14, 0.05, M.alu, 0, 2.4, 4.9, t);
  {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 1024, 512);
    x.fillStyle = '#111'; x.font = 'bold 74px Inter, Arial'; x.textAlign = 'center';
    x.fillText('PALACIOS MARINE', 512, 382); x.fillStyle = '#e31e24'; x.fillText('& INDUSTRIAL', 512, 468);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const img = new Image(); img.onload = () => { x.drawImage(img, 362, 30, 300, 198); tx.needsUpdate = true; }; img.src = 'assets/pmi-logo.png';
    mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.5 }), 0, 2.45, 4.82, t).rotation.y = Math.PI;
  }
  rbox(2.6, 0.2, 0.15, 0.05, M.dark, 0, 1.0, -8.05, t);
  [-1.05, 1.05].forEach(x => rbox(0.32, 0.14, 0.06, 0.03, M.tail, x, 1.05, -8.14, t));
  [-0.9, 0.9].forEach(x => { box(0.12, 1.0, 0.12, M.dark, x, 0.6, 2.2, t); box(0.4, 0.06, 0.4, M.dark, x, 0.08, 2.2, t); });
  [-1.3, 1.3].forEach(x => box(0.04, 0.6, 0.5, M.rubber, x, 0.65, -8.0, t));
  const pr = 0.32, plen = 12;
  const pGeo = new THREE.CylinderGeometry(pr, pr, plen, 24).rotateX(Math.PI / 2);
  const capGeo = new THREE.CylinderGeometry(pr + 0.02, pr + 0.02, 0.12, 24).rotateX(Math.PI / 2);
  const makePipe = (parent, x, y, z) => {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    mesh(pGeo, M.steel, 0, 0, 0, g);
    [-plen / 2, plen / 2].forEach(o => mesh(capGeo, M.red, 0, 0, o, g));
    return g;
  };
  [[-0.99, -0.33, 0.33, 0.99], [-0.66, 0, 0.66], [-0.33, 0.33]].forEach((row, li) => row.forEach(x => makePipe(t, x, 1.56 + pr + li * 0.554, -1.5)));
  [-5.6, -1.5, 2.6].forEach(z => {
    box(2.7, 0.1, 0.25, M.wood, 0, 1.6, z, t);
    box(0.03, 1.6, 0.08, M.yellow, 1.31, 2.35, z, t); box(0.03, 1.6, 0.08, M.yellow, -1.31, 2.35, z, t);
    box(1.5, 0.03, 0.08, M.yellow, 0, 3.3, z, t);
  });
  liftPipe = makePipe(scene, 0, 0, 0);

  box(1.05, 0.32, 10, M.dark, 0, 0.95, 7.2, t);
  rbox(1.6, 0.15, 1.4, 0.05, M.dark, 0, 1.2, 4.0, t);
  rbox(2.5, 2.95, 2.0, 0.18, M.cab, 0, 2.95, 6.25, t);
  rbox(2.5, 2.45, 2.15, 0.18, M.cab, 0, 2.72, 8.3, t);
  rbox(2.2, 1.45, 2.6, 0.22, M.cab, 0, 1.95, 10.65, t);
  rbox(2.52, 0.12, 0.5, 0.05, M.dark, 0, 4.0, 9.3, t);
  rbox(1.36, 1.36, 0.12, 0.05, M.chrome, 0, 1.85, 11.95, t);
  for (let i = -5; i <= 5; i++) box(0.04, 1.1, 0.04, M.dark, i * 0.11, 1.85, 12.02, t);
  rbox(2.62, 0.4, 0.38, 0.12, M.chrome, 0, 0.82, 12.08, t);
  [-0.84, 0.84].forEach(x => { rbox(0.42, 0.26, 0.08, 0.04, M.chrome, x, 1.58, 11.9, t); box(0.34, 0.18, 0.04, M.lens, x, 1.58, 11.95, t); });
  [-0.58, 0.58].forEach(x => box(1.08, 0.95, 0.04, M.glass, x, 3.35, 9.39, t));
  [-1.26, 1.26].forEach(x => box(0.04, 0.85, 1.25, M.glass, x, 3.35, 8.55, t));
  [-1.3, 1.3].forEach(x => {
    cyl(0.32, 0.32, 1.2, M.chrome, x, 2.25, 9.6, t, 20);
    cyl(0.11, 0.11, 3.6, M.chrome, x * 1.02, 4.1, 7.25, t, 14);
    box(0.06, 0.5, 0.06, M.chrome, x * 1.12, 3.4, 9.35, t); rbox(0.12, 0.62, 0.32, 0.03, M.dark, x * 1.2, 3.35, 9.25, t);
    zcyl(0.34, 1.6, M.chrome, x * 0.92, 1.05, 7.4, t, 24);
    box(0.4, 0.06, 0.6, M.dark, x * 0.98, 0.62, 8.6, t);
  });
  const fender = std(0xd3141b, 0.3, 0.35, { side: THREE.DoubleSide });
  [-1.05, 1.05].forEach(x => mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.52, 20, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), fender, x, 0.62, 10.6, t));
  for (let i = 0; i < 5; i++) box(0.14, 0.07, 0.07, M.amber, -0.56 + i * 0.28, 4.08, 9.45, t);
  [[1.262, Math.PI / 2], [-1.262, -Math.PI / 2]].forEach(([x, ry]) => { mesh(new THREE.PlaneGeometry(1.3, 0.86), logoMat, x, 2.45, 8.3, t).rotation.y = ry; });
  const tireGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.55, 28).rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.565, 24).rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12).rotateZ(Math.PI / 2);
  const lugGeo = new THREE.BoxGeometry(0.58, 0.05, 0.05);
  [[10.6, 1.03], [4.6, 1.0], [3.3, 1.0], [-5.9, 1.0], [-7.2, 1.0]].forEach(([z, x]) => [-x, x].forEach(xx => {
    const w = new THREE.Group(); w.position.set(xx, 0.52, z); t.add(w);
    mesh(tireGeo, M.rubber, 0, 0, 0, w); mesh(rimGeo, M.chrome, 0, 0, 0, w); mesh(hubGeo, M.dark, 0, 0, 0, w);
    for (let k = 0; k < 3; k++) mesh(lugGeo, M.dark, 0, 0, 0, w).rotation.x = k * Math.PI / 3;
    wheels.push(w);
  }));
}
const TRUCK_X = 4, TRUCK_Z0 = -340, TRUCK_Z1 = -30;
truck.position.set(TRUCK_X, 0, TRUCK_Z0);

/* =========================================================
   Mobile crane + rigging crew
   ========================================================= */
const crane = {};
const LOAD_START = V(TRUCK_X, LIFT_LOCAL.y, TRUCK_Z1 + LIFT_LOCAL.z);
const LOAD_END = V(11.2, RACK.top + 0.32, LOAD_START.z);
const CRANE_PIVOT = V(-3.6, 4.0, LOAD_START.z - 4);
const RAM_BASE = V(-3.6, 3.3, LOAD_START.z - 1.6);
{
  const g = new THREE.Group(); g.position.set(-3.6, 0, LOAD_START.z - 2); scene.add(g);
  rbox(2.8, 1.4, 11, 0.15, M.yellow, 0, 1.4, 0, g);
  rbox(2.4, 2, 2, 0.15, M.yellow, 0, 2.6, 4.4, g); box(2.2, 0.9, 0.05, M.glass, 0, 3.0, 5.41, g);
  [-4, -2.4, 2.4, 4].forEach(z => [-1.25, 1.25].forEach(x => { xcyl(0.6, 0.5, M.rubber, x, 0.6, z, g, 24); xcyl(0.32, 0.52, M.yellow, x, 0.6, z, g, 16); }));
  [-3.8, 3.8].forEach(z => [-1, 1].forEach(s => { box(3, 0.3, 0.4, M.dark, s * 2.5, 0.8, z, g); cyl(0.09, 0.09, 0.7, M.chrome, s * 3.9, 0.45, z, g, 10); box(0.9, 0.12, 0.9, M.wood, s * 3.9, 0.06, z, g); }));
  rbox(2.6, 1.3, 3.6, 0.12, M.yellow, 0, 2.75, -2, g);
  rbox(2.4, 1.2, 1.2, 0.1, M.dark, 0, 2.7, -4.2, g);
  rbox(1.0, 1.4, 1.2, 0.1, M.yellow, 1.25, 3, -0.7, g); box(0.05, 0.8, 0.9, M.glass, 1.76, 3.2, -0.7, g);
  crane.boom = beam(CRANE_PIVOT, V(0, 30, 0), 0.95, M.yellow, scene, boxGeo, 1.05);
  crane.boom2 = beam(CRANE_PIVOT, V(0, 30, 0), 0.66, std(0xe8a810, 0.1, 0.5), scene, boxGeo, 0.74);
  crane.ram = beam(RAM_BASE, V(0, 10, 0), 0.14, M.chrome);
  crane.cable = beam(V(0, 0, 0), V(0, 1, 0), 0.03, M.dark);
  crane.hook = rbox(0.45, 0.6, 0.35, 0.06, M.red, 0, 0, 0);
  crane.sl1 = beam(V(), V(0, 1, 0), 0.025, M.yellow);
  crane.sl2 = beam(V(), V(0, 1, 0), 0.025, M.yellow);
  person(7.3, 0, -38, -Math.PI / 2, 0xffffff); person(7.5, 0, -25.5, -1.9, 0xffffff); person(0.9, 0, -42.5, 0.5, 0xe31e24);
  person(33, 8.08, -29.8, 0, 0xffffff); person(35.6, 16.08, -29.8, 3.1, 0xffffff);
  person(-8.6, 0, -99.4, 0.3, 0xffffff);
}
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function liftPos(s) {
  const top = LOAD_END.y + 3.2;
  if (s < 0.35) { const k = s / 0.35; return V(LOAD_START.x, THREE.MathUtils.lerp(LOAD_START.y, top, ease(k)), LOAD_START.z); }
  if (s < 0.75) { const k = (s - 0.35) / 0.4; return V(THREE.MathUtils.lerp(LOAD_START.x, LOAD_END.x, ease(k)), top, LOAD_START.z); }
  const k = Math.min(1, (s - 0.75) / 0.25); return V(LOAD_END.x, THREE.MathUtils.lerp(top, LOAD_END.y, ease(k)), LOAD_END.z);
}
function updateCrane(s, carried) {
  const p = s > 0 ? liftPos(s) : carried;
  liftPipe.position.copy(p);
  const hookAt = s > 0 ? p : LOAD_START;
  const hook = hookAt.clone().add(V(0, 2.4 + (s > 0 ? 0 : 1.5), 0));
  const tip = hookAt.clone().add(V(0, 8.5, 0));
  setBeam(crane.boom, CRANE_PIVOT, CRANE_PIVOT.clone().lerp(tip, 0.55), 0.95, 1.05);
  setBeam(crane.boom2, CRANE_PIVOT, tip, 0.66, 0.74);
  setBeam(crane.ram, RAM_BASE, CRANE_PIVOT.clone().lerp(tip, 0.3), 0.14);
  setBeam(crane.cable, hook, tip, 0.03);
  crane.hook.position.copy(hook);
  crane.sl1.visible = crane.sl2.visible = s > 0;
  if (s > 0) { setBeam(crane.sl1, hook, p.clone().add(V(0, 0.3, -3.5)), 0.025); setBeam(crane.sl2, hook, p.clone().add(V(0, 0.3, 3.5)), 0.025); }
}

/* =========================================================
   Discipline highlights
   ========================================================= */
const HL = [
  { at: V(26, 0, -14), r: 20 }, { at: V(-16, 0, 56), r: 15 }, { at: V(34, 0, -26), r: 8 },
  { at: V(-30, 0, -44), r: 11 }, { at: V(4, 0, 106), r: 13 }, { at: V(-18, 0, -78), r: 18 },
].map(h => {
  const g = new THREE.Group(); g.position.copy(h.at); scene.add(g);
  const mat = new THREE.MeshBasicMaterial({ color: 0xe31e24, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const mat2 = mat.clone();
  const fill = new THREE.MeshBasicMaterial({ color: 0xe31e24, transparent: true, opacity: 0, depthWrite: false });
  mesh(new THREE.RingGeometry(h.r - 0.3, h.r, 128).rotateX(-Math.PI / 2), mat, 0, 0.14, 0, g);
  const ring2 = mesh(new THREE.RingGeometry(h.r - 0.12, h.r, 128).rotateX(-Math.PI / 2), mat2, 0, 0.14, 0, g);
  mesh(new THREE.CircleGeometry(h.r, 96).rotateX(-Math.PI / 2), fill, 0, 0.12, 0, g);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; mesh(new THREE.PlaneGeometry(h.r * 0.16, 0.3).rotateX(-Math.PI / 2), mat, Math.cos(a) * (h.r + 1.2), 0.14, Math.sin(a) * (h.r + 1.2), g).rotation.y = -a; }
  return { g, mat, mat2, fill, ring2, w: 0 };
});

scene.traverse(o => {
  if (!o.isMesh || o === sky) return;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (m.isMeshBasicMaterial || m.transparent) return;
  o.castShadow = o !== groundMesh; o.receiveShadow = true;
});

/* =========================================================
   Timeline
   ========================================================= */
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const P_ARRIVE = 0.395, P_LIFT0 = 0.425, P_LIFT1 = 0.505;
const truckTarget = p => THREE.MathUtils.lerp(TRUCK_Z0, TRUCK_Z1, ease(Math.min(1, p / P_ARRIVE)));

const K = [
  { p: 0.000, pos: T => T.clone().add(V(7.5, 3.6, -19)), look: T => T.clone().add(V(-4, 5, 40)) },
  { p: 0.105, pos: T => T.clone().add(V(22, 3.2, 3)), look: T => T.clone().add(V(0, 2.6, 11)) },
  { p: 0.205, pos: T => T.clone().add(V(-9, 1.6, 27)), look: T => T.clone().add(V(-3.5, 2.8, 4)) },
  { p: 0.305, pos: T => T.clone().add(V(-34, 34, -46)), look: T => T.clone().add(V(0, 0, 70)) },
  { p: 0.395, pos: () => V(-3, 6, -62), look: () => V(4, 3.2, -31) },
  { p: 0.465, pos: () => V(-14, 21, -66), look: () => V(7, 9, -31) },
  { p: 0.555, pos: () => V(19.5, 5.5, -35), look: () => V(31, 4.5, -10) },
  { p: 0.627, pos: () => V(8, 14, 30), look: () => V(-16, 0, 56) },
  { p: 0.697, pos: () => V(20, 15, -37), look: () => V(34, 12.5, -25) },
  { p: 0.767, pos: () => V(-6, 15, -14), look: () => V(-34, 2, -44) },
  { p: 0.837, pos: () => V(22, 5, 118), look: () => V(-30, 1.5, 102) },
  { p: 0.872, pos: () => V(-30, 55, 40), look: () => V(-14, 0, -40) },
  { p: 0.905, pos: () => V(10, 10, -116), look: () => V(-11, 3, -64) },
  { p: 0.975, pos: () => V(-190, 165, -230), look: () => V(10, 0, 30) },
  { p: 1.000, pos: () => V(-200, 172, -240), look: () => V(10, 0, 30) },
];
const posCurve = new THREE.CatmullRomCurve3(K.map(() => V()), false, 'centripetal');
const lookCurve = new THREE.CatmullRomCurve3(K.map(() => V()), false, 'centripetal');
function cameraAt(p, T) {
  K.forEach((k, i) => { posCurve.points[i].copy(k.pos(T)); lookCurve.points[i].copy(k.look(T)); });
  let i = 0; while (i < K.length - 2 && p > K[i + 1].p) i++;
  const e = smooth(0.08, 0.92, (p - K[i].p) / (K[i + 1].p - K[i].p));
  const u = (i + e) / (K.length - 1);
  return { pos: posCurve.getPoint(u), look: lookCurve.getPoint(u) };
}

/* =========================================================
   DOM / scroll / audio wiring
   ========================================================= */
const sound = new SoundEngine();
const story = document.querySelector('.story');
const panels = [...document.querySelectorAll('.panel')].map(el => ({ el, a: +el.dataset.in, b: +el.dataset.out, cap: el.dataset.cap }));
const chapters = [...document.querySelectorAll('.chapters button')];
const chapFill = document.querySelector('.chapters-fill');
const chapWrap = document.querySelector('.chapters');
const toggle = document.querySelector('.sound-toggle');
let pTarget = 0, p = 0, lastActive = -1, statsDone = false;

const storyMax = () => story.offsetHeight - window.innerHeight;
const storyProgress = () => Math.min(1, Math.max(0, window.scrollY / storyMax()));
window.addEventListener('scroll', () => { pTarget = storyProgress(); }, { passive: true });
chapters.forEach(b => b.addEventListener('click', () => window.scrollTo({ top: (+b.dataset.at) * storyMax() + 2, behavior: 'smooth' })));

function panelAlpha(pp, a, b) { const f = 0.014; return (a <= 0 ? 1 : smooth(a, a + f, pp)) * (b >= 1 ? 1 : 1 - smooth(b - f, b, pp)); }
function updateDOM(pp) {
  let active = -1;
  panels.forEach((pn, idx) => {
    const al = panelAlpha(pp, pn.a, pn.b);
    pn.el.style.opacity = al.toFixed(3);
    pn.el.style.visibility = al > 0.001 ? 'visible' : 'hidden';
    pn.el.classList.toggle('on', al > 0.5);
    pn.el.style.setProperty('--rise', `${((1 - al) * 24).toFixed(1)}px`);
    if (al > 0.5) active = idx;
  });
  if (active !== lastActive && active !== -1) { if (lastActive !== -1) sound.whoosh(); lastActive = active; }
  let c = 0; chapters.forEach((s, i) => { if (pp >= +s.dataset.at - 0.002) c = i; });
  chapters.forEach((s, i) => s.classList.toggle('on', i === c));
  chapFill.style.height = (pp * 100).toFixed(2) + '%';
  chapWrap.classList.toggle('hide', window.scrollY > storyMax() - window.innerHeight * 0.2);
  if (!statsDone && pp > 0.955) { statsDone = true; countUp(); }
}
function countUp() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count, t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 1400); el.textContent = Math.round(to * ease(k)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

// Sound: on by default; browsers only allow audio after the first click/tap/key press
let userOff = false, unlockedAt = 0;
const label = toggle.querySelector('em');
const setSound = on => { sound.setEnabled(on); toggle.classList.toggle('on', on); label.textContent = on ? 'Sound on' : 'Sound off'; };
function unlock() {
  if (userOff) return;
  if (!sound.started) { setSound(true); unlockedAt = performance.now(); } else sound.resume();
}
['pointerdown', 'keydown', 'touchend', 'click'].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));
document.addEventListener('visibilitychange', () => { if (!document.hidden) sound.resume(); });
toggle.addEventListener('click', () => { if (performance.now() - unlockedAt < 700) return; userOff = sound.enabled; setSound(!sound.enabled); });
document.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') sound.hover(); });
  el.addEventListener('pointerdown', () => sound.click());
});

(function drawMap() {
  const svg = document.querySelector('.loc-map'); if (!svg) return;
  const pts = [
    ['Port Lavaca', -96.63, 28.61, 'hq'], ['Corpus Christi', -97.40, 27.80, 'shop'], ['Victoria', -97.00, 28.81], ['Freeport', -95.36, 28.95, 'shop'],
    ['Deer Park', -95.12, 29.70], ['Houston', -95.37, 29.76, 'shop'], ['Lake Charles', -93.22, 30.23], ['Baton Rouge', -91.15, 30.45, 'shop'], ['Mobile', -88.04, 30.69],
  ];
  const X = lon => (lon + 98.2) / (98.2 - 87.2) * 640 + 50, Y = lat => (31.1 - lat) / (31.1 - 27.3) * 340 + 40;
  let s = '<defs><pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="rgba(0,0,0,.06)"/></pattern></defs>';
  s += '<rect width="800" height="420" fill="url(#grid)"/>';
  s += `<text x="${X(-94)}" y="${Y(27.6)}" fill="rgba(0,0,0,.14)" font-family="Bebas Neue" font-size="34" letter-spacing="8">GULF OF MEXICO</text>`;
  const hq = pts[0];
  pts.slice(1).forEach(q => { s += `<line x1="${X(hq[1])}" y1="${Y(hq[2])}" x2="${X(q[1])}" y2="${Y(q[2])}" stroke="rgba(227,30,36,.4)" stroke-dasharray="3 5"/>`; });
  pts.forEach(([n, lo, la, k]) => {
    const x = X(lo), y = Y(la), up = ['Deer Park', 'Victoria', 'Lake Charles', 'Mobile', 'Baton Rouge'].includes(n);
    if (k === 'hq') s += `<circle cx="${x}" cy="${y}" r="14" fill="none" stroke="#e31e24" stroke-width="2"><animate attributeName="r" values="8;22;8" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="2.4s" repeatCount="indefinite"/></circle>`;
    if (k === 'shop' || k === 'hq') s += `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" fill="none" stroke="#111" stroke-width="1.5" transform="rotate(45 ${x} ${y})"/>`;
    s += `<circle cx="${x}" cy="${y}" r="${k === 'hq' ? 6 : 4.5}" fill="#e31e24"/>`;
    s += `<text x="${x + 12}" y="${y + (up ? -10 : 18)}" fill="#1a1d21" font-family="Inter" font-size="${k === 'hq' ? 15 : 13}" font-weight="${k === 'hq' ? 700 : 500}">${n}</text>`;
  });
  s += `<g transform="translate(600,330)"><rect width="170" height="64" fill="none" stroke="rgba(0,0,0,.15)"/><circle cx="22" cy="32" r="4.5" fill="#e31e24"/><text x="36" y="28" fill="#1a1d21" font-family="Inter" font-size="13" font-weight="500">Clarendon, Jamaica</text><text x="36" y="46" fill="#5f6368" font-family="Inter" font-size="11">International</text></g>`;
  svg.innerHTML = s;
})();

/* =========================================================
   Render loop
   ========================================================= */
const VMAX = 26, ACC = 7;
let truckZ = truckTarget(storyProgress()), truckV = 0, liftS = 0, braking = false, landed = false;
let last = performance.now(), elapsed = 0, frame = 0;
const T = V();
function tick() {
  requestAnimationFrame(tick);
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; elapsed += dt;
  p += (pTarget - p) * Math.min(1, dt * 2.4);
  if (Math.abs(pTarget - p) < 1e-5) p = pTarget;
  updateDOM(p);
  if (window.scrollY > story.offsetHeight + 50 && frame > 2) return;
  frame++;

  let tgt = truckTarget(p);
  if (liftS > 0.001) tgt = TRUCK_Z1;
  const dist = tgt - truckZ;
  const vWant = Math.sign(dist) * Math.min(VMAX, Math.sqrt(2 * ACC * Math.abs(dist)));
  const accel = Math.abs(vWant) > Math.abs(truckV) ? ACC : ACC * 1.6;
  truckV += THREE.MathUtils.clamp(vWant - truckV, -accel * dt, accel * dt);
  truckZ += truckV * dt;
  if (Math.abs(dist) < 0.03 && Math.abs(truckV) < 0.3) { truckZ = tgt; truckV = 0; }
  if (Math.abs(truckV) > 3) braking = true;
  if (braking && truckV === 0) { braking = false; if (Math.abs(truckZ - TRUCK_Z1) < 0.1) sound.airBrake(); }
  truck.position.set(TRUCK_X, Math.abs(truckV) > 0.5 ? Math.sin(elapsed * 13) * 0.01 : 0, truckZ);
  wheels.forEach(w => { w.rotation.x += truckV * dt / 0.52; });
  T.set(TRUCK_X, 0, truckZ - 1.5);
  barrier.children[0].rotation.z = smooth(-190, -130, truckZ) * 1.45;

  const parked = truckV === 0 && Math.abs(truckZ - TRUCK_Z1) < 0.05;
  const sWant = parked ? smooth(P_LIFT0, P_LIFT1, p) : 0, prevS = liftS;
  liftS += THREE.MathUtils.clamp(sWant - liftS, -dt * 0.5, dt * 0.5);
  updateCrane(liftS, truck.position.clone().add(LIFT_LOCAL));
  if (liftS >= 0.999 && !landed) { landed = true; sound.clank(); }
  if (liftS < 0.95) landed = false;

  const c = cameraAt(p, T);
  camera.position.copy(c.pos); camera.lookAt(c.look);
  sun.target.position.copy(c.look); sun.position.copy(c.look).add(SUN_OFF);

  HL.forEach((h, i) => {
    const pn = panels.find(q => q.cap === String(i));
    const target = pn ? panelAlpha(p, pn.a - 0.01, pn.b + 0.01) : 0;
    h.w += (target - h.w) * Math.min(1, dt * 5);
    const k = (elapsed * 0.4) % 1;
    h.mat.opacity = h.w * 0.95; h.fill.opacity = h.w * 0.08;
    h.ring2.scale.setScalar(0.4 + k * 0.6); h.mat2.opacity = h.w * (1 - k);
    h.g.visible = h.w > 0.01;
  });

  const fl = 1 + Math.sin(elapsed * 9) * 0.07 + Math.sin(elapsed * 23) * 0.05;
  flame.scale.set(fl, 2 - fl, fl); flame.rotation.z = Math.sin(elapsed * 1.3) * 0.08;
  const blink = Math.sin(elapsed * 2.4) > 0; beacons.forEach(b => { b.visible = blink; });

  // welding arc: strikes in bursts
  const burst = (elapsed % 5) < 3.4, flick = burst ? 0.6 + Math.random() * 0.4 : 0;
  arc.visible = burst; arc.scale.setScalar(0.25 + flick * 0.45); arcLight.intensity = flick * 30;
  sparks.pts.visible = burst;
  for (let i = 0; i < sparks.n; i++) {
    const [s0, a, sp] = sparks.seed[i], t = ((s0 + elapsed * 1.6) % 1) * 0.55, j = i * 3;
    sparks.pos[j] = WELD.x + Math.cos(a) * sp * t * 1.4 + 0.3 * t; sparks.pos[j + 1] = Math.max(0.03, WELD.y + sp * t * 1.2 - 4.9 * t * t); sparks.pos[j + 2] = WELD.z + Math.sin(a) * sp * t * 1.4;
  }
  sparks.pts.geometry.attributes.position.needsUpdate = true;

  const d = SHELL.clone().sub(NOZZLE);
  for (let i = 0; i < spray.n; i++) {
    const k = (spray.seed[i] + elapsed * 1.4) % 1, sp = 0.06 + k * 0.5, j = i * 3;
    const r1 = Math.sin(i * 12.9898) * 0.5, r2 = Math.sin(i * 78.233) * 0.5;
    if (k < 0.75) { const f = k / 0.75; spray.pos[j] = NOZZLE.x + d.x * f; spray.pos[j + 1] = NOZZLE.y + d.y * f + r1 * sp * 0.4; spray.pos[j + 2] = NOZZLE.z + d.z * f + r2 * sp * 0.4; }
    else { const m = (k - 0.75) / 0.25; spray.pos[j] = SHELL.x + 0.2 + m * 1.6 * (0.6 + r1); spray.pos[j + 1] = SHELL.y + r2 * 3 * m - m * m * 1.2; spray.pos[j + 2] = SHELL.z + r1 * 4 * m; }
  }
  spray.pts.geometry.attributes.position.needsUpdate = true;

  sound.update({
    truckSpeed: Math.abs(truckV) / VMAX,
    truckNear: Math.max(0, 1 - camera.position.distanceTo(T) / 90),
    winch: liftS > 0 && liftS < 0.999 && Math.abs(liftS - prevS) > 1e-5 ? 1 : 0,
    flare: Math.max(0, 1 - camera.position.distanceTo(FLARE) / 220),
    plant: smooth(0.33, 0.5, p),
  });
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

pTarget = p = storyProgress();
renderer.compile(scene, camera);
tick();
document.getElementById('loader').classList.add('done');
window.__pmi = { setP: v => { pTarget = p = v; truckZ = truckTarget(v); truckV = 0; liftS = v > P_LIFT0 ? smooth(P_LIFT0, P_LIFT1, v) : 0; }, sound, scene, camera };
