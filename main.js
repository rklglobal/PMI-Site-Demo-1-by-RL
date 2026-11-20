import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundEngine } from './audio.js';

/* =========================================================
   Renderer / scene: clean "white scale model" look
   ========================================================= */
const canvas = document.getElementById('scene');
const isMobile = window.innerWidth < 760;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
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
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun, sun.target);

/* =========================================================
   Materials & helpers
   ========================================================= */
const std = (color, metalness = 0, roughness = 0.75, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
const M = {
  ground: std(0xdcdfe1, 0, 1), pad: std(0xcfd2d4, 0, 0.95), asphalt: std(0x8c9095, 0, 0.92),
  concrete: std(0xc4c1bb, 0, 0.95), steel: std(0x9aa1a8, 0.35, 0.5), struct: std(0x6c737a, 0.25, 0.6),
  dark: std(0x3f454c, 0.2, 0.6), white: std(0xf4f4f2, 0, 0.7), insul: std(0xe2e5e8, 0.25, 0.5),
  red: std(0xe31e24, 0.05, 0.5), yellow: std(0xf2b41a, 0.05, 0.55), green: std(0x8aa391, 0.1, 0.6),
  rubber: std(0x1d1e20, 0, 0.92), chrome: std(0xf0f2f4, 1, 0.14), glass: std(0x23303b, 0.6, 0.12),
  alu: std(0xc9ced3, 0.7, 0.32), wood: std(0xb08a5f, 0, 0.9), dirt: std(0xb7a58d, 0, 1),
  galv: std(0xb3b9bf, 0.6, 0.45), orange: std(0xff6a13, 0, 0.6), blue: std(0x2a5ea8, 0.1, 0.5),
  cab: new THREE.MeshPhysicalMaterial({ color: 0xd3141b, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 }),
  lens: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 0.6, roughness: 0.2 }),
  tail: new THREE.MeshStandardMaterial({ color: 0xb00000, emissive: 0xff1010, emissiveIntensity: 0.5, roughness: 0.3 }),
  amber: new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff8a00, emissiveIntensity: 0.5, roughness: 0.3 }),
  beacon: new THREE.MeshBasicMaterial({ color: 0xe31e24 }),
};

function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
}
const box = (w, h, d, mat, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
const rbox = (w, h, d, r, mat, x, y, z, p) => mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat, x, y, z, p);
const cyl = (rt, rb, h, mat, x, y, z, p, seg = 24) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, p);
const zcyl = (r, len, mat, x, y, z, p, seg = 20) => mesh(new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2), mat, x, y, z, p);
const xcyl = (r, len, mat, x, y, z, p, seg = 20) => mesh(new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2), mat, x, y, z, p);
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.5);
function beam(a, b, r, mat, parent = scene) { const m = new THREE.Mesh(beamGeo, mat); parent.add(m); setBeam(m, a, b, r); return m; }
function setBeam(m, a, b, r) { m.position.copy(a); m.lookAt(b); m.scale.set(r, r, Math.max(0.001, a.distanceTo(b))); }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const beacons = [];

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
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.18, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2c230 }), 300);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 300; i++) { m4.makeTranslation(0, 0.06, -100 - i * 6); dash.setMatrixAt(i, m4); }
  scene.add(dash);
  [-6.6, 6.6].forEach(x => mesh(new THREE.PlaneGeometry(0.15, 1700).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }), x, 0.06, -946));
  for (let z = -130; z > -1200; z -= 55) {
    const side = (Math.round(z / 55) % 2) ? -17 : 17;
    cyl(0.1, 0.14, 10, M.struct, side, 5, z, scene, 8);
    box(2.4, 0.14, 0.3, M.struct, side * 0.92, 10, z);
  }
}
{
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), M.galv, 120);
  const m4 = new THREE.Matrix4(); let k = 0;
  for (let x = -155; x <= 155; x += 5) { if (Math.abs(x) < 9) continue; m4.makeTranslation(x, 1.3, -96); posts.setMatrixAt(k++, m4); }
  posts.count = k; scene.add(posts);
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x8a9198, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
  [-1, 1].forEach(s => { mesh(new THREE.PlaneGeometry(146, 2.4), fenceMat, s * 82, 1.25, -96); box(146, 0.06, 0.06, M.galv, s * 82, 2.55, -96); });
}

/* =========================================================
   Refinery
   ========================================================= */
const RACK = { x0: 10, x1: 18, z0: -80, z1: 86 };

function column(x, z, r, h, { scaffold = false } = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  cyl(r * 1.25, r * 1.35, 1.2, M.concrete, 0, 0.6, 0, g, 32);
  cyl(r * 1.02, r * 1.06, 3, M.struct, 0, 2.7, 0, g, 32);
  cyl(r, r, h, M.insul, 0, 4.2 + h / 2, 0, g, 40);
  mesh(new THREE.SphereGeometry(r, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.insul, 0, 4.2 + h, 0, g);
  for (let y = 7; y < h; y += 3) mesh(new THREE.TorusGeometry(r + 0.01, 0.025, 4, 48).rotateX(Math.PI / 2), M.galv, 0, y, 0, g);
  const top = 4.2 + h + r;
  const grate = std(0x7c838a, 0.3, 0.6, { side: THREE.DoubleSide });
  for (let y = 12; y < h; y += 9) {
    mesh(new THREE.RingGeometry(r, r + 1.5, 40).rotateX(-Math.PI / 2), grate, 0, y, 0, g);
    mesh(new THREE.TorusGeometry(r + 1.45, 0.05, 4, 48).rotateX(Math.PI / 2), M.yellow, 0, y + 1.1, 0, g);
    mesh(new THREE.TorusGeometry(r + 1.45, 0.04, 4, 48).rotateX(Math.PI / 2), M.yellow, 0, y + 0.55, 0, g);
  }
  box(0.55, h, 0.1, M.struct, r + 0.35, 4.2 + h / 2, 0, g);
  cyl(0.28, 0.28, h, M.steel, -r - 0.5, 4.2 + h / 2, 0, g, 10);
  beacons.push(mesh(new THREE.SphereGeometry(0.3, 10, 8), M.beacon, x, top + 0.5, z));
  const pts = [V(x, top, z), V(x, top + 2, z), V(x - (x - RACK.x1) * 0.35, top + 1, z), V(RACK.x1 + 3, 13.6, z), V(RACK.x1 - 0.8, 12.9, z)];
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r > 3 ? 0.55 : 0.38, 12), M.insul);
  if (scaffold) buildScaffold(x, z, r, Math.min(h - 6, 26));
}

function buildScaffold(cx, cz, r, height) {
  const half = r + 1.4, bay = 2.0, lift = 2.0;
  const verts = [];
  for (let s = -half; s <= half + 0.01; s += bay) for (const side of [-half, half]) { verts.push([s, side]); verts.push([side, s]); }
  const uniq = [...new Map(verts.map(v => [v.map(n => n.toFixed(2)).join(','), v])).values()];
  const vMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, height, 6), M.galv, uniq.length);
  const m4 = new THREE.Matrix4();
  uniq.forEach((v, i) => { m4.makeTranslation(cx + v[0], height / 2, cz + v[1]); vMesh.setMatrixAt(i, m4); });
  scene.add(vMesh);
  const span = half * 2, levels = Math.floor(height / lift);
  const lMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(span, 0.07, 0.07), M.galv, levels * 4);
  const pMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(span, 0.06, 1.1), M.wood, Math.ceil(levels / 2) * 4);
  const tMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(span, 0.2, 0.03), M.yellow, Math.ceil(levels / 2) * 4);
  const q = new THREE.Quaternion(), s1 = V(1, 1, 1);
  let li = 0, pi = 0;
  for (let l = 1; l <= levels; l++) {
    const y = l * lift;
    for (let k = 0; k < 4; k++) {
      q.setFromEuler(new THREE.Euler(0, k % 2 ? Math.PI / 2 : 0, 0));
      const off = (k < 2 ? -1 : 1) * half;
      lMesh.setMatrixAt(li++, m4.compose(k % 2 ? V(cx + off, y, cz) : V(cx, y, cz + off), q, s1));
      if (l % 2 === 0) {
        const inward = (k < 2 ? 0.6 : -0.6);
        pMesh.setMatrixAt(pi, m4.compose(k % 2 ? V(cx + off + inward, y + 0.05, cz) : V(cx, y + 0.05, cz + off + inward), q, s1));
        tMesh.setMatrixAt(pi++, m4.compose(k % 2 ? V(cx + off, y + 0.15, cz) : V(cx, y + 0.15, cz + off), q, s1));
      }
    }
  }
  lMesh.count = li; pMesh.count = pi; tMesh.count = pi;
  scene.add(lMesh, pMesh, tMesh);
}

{
  const bents = [];
  for (let z = RACK.z0; z <= RACK.z1; z += 6) bents.push(z);
  const colM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 12.4, 0.45), M.struct, bents.length * 2);
  const beamM = new THREE.InstancedMesh(new THREE.BoxGeometry(8.6, 0.4, 0.35), M.struct, bents.length * 2);
  const ftM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), M.concrete, bents.length * 2);
  const m4 = new THREE.Matrix4(); let c = 0, b = 0;
  bents.forEach(z => {
    [RACK.x0, RACK.x1].forEach(x => { m4.makeTranslation(x, 6.2, z); colM.setMatrixAt(c, m4); m4.makeTranslation(x, 0.25, z); ftM.setMatrixAt(c++, m4); });
    [6.4, 12.1].forEach(y => { m4.makeTranslation((RACK.x0 + RACK.x1) / 2, y, z); beamM.setMatrixAt(b++, m4); });
  });
  scene.add(colM, beamM, ftM);
  const L = RACK.z1 - RACK.z0, zc = (RACK.z0 + RACK.z1) / 2;
  [RACK.x0, RACK.x1].forEach(x => [6.4, 12.1].forEach(y => box(0.3, 0.3, L, M.struct, x, y, zc)));
  const pipe = (x, y, r, mat) => zcyl(r, L, mat, x, y + r, zc, scene, 18);
  [[12.4, 0.42, M.insul], [13.5, 0.3, M.steel], [14.5, 0.48, M.insul], [15.6, 0.28, M.yellow], [16.5, 0.35, M.steel], [17.4, 0.25, M.red]]
    .forEach(([x, r, m]) => pipe(x, 12.3, r, m));
  [[10.8, 0.3, M.steel], [11.8, 0.42, M.insul], [12.9, 0.25, M.green], [13.9, 0.36, M.steel], [15.0, 0.3, M.insul], [16.1, 0.45, M.steel], [17.2, 0.22, M.steel]]
    .forEach(([x, r, m]) => pipe(x, 6.6, r, m));
  box(0.9, 0.15, L, M.galv, RACK.x1 - 0.6, 9.6, zc);
}

column(34, -26, 3, 50, { scaffold: true });
column(47, -6, 2.3, 38);
column(34, 14, 3.6, 62);
column(50, 30, 2, 30);
column(62, -30, 2.6, 44);

[[-52, 1.6, 9], [-62, 1.4, 8], [40, 1.2, 6]].forEach(([z, r, l]) => {
  zcyl(r, l, M.white, 26, 3.2, z, scene, 28);
  [-1, 1].forEach(s => mesh(new THREE.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(s * Math.PI / 2), M.white, 26, 3.2, z + s * l / 2));
  [-l / 3, l / 3].forEach(o => box(r * 1.6, 2.2, 0.5, M.concrete, 26, 1.1, z + o));
});
{
  rbox(14, 12, 9, 0.2, std(0xb9bcbf, 0.1, 0.7), 34, 6, 46);
  [-3.5, 3.5].forEach(o => { cyl(1.2, 1.4, 30, M.struct, 34 + o, 27, 46, scene, 20); beacons.push(mesh(new THREE.SphereGeometry(0.3, 10, 8), M.beacon, 34 + o, 42.6, 46)); });
  for (let y = 3; y < 12; y += 3) box(14.1, 0.12, 9.1, M.struct, 34, y, 46);
}
[70, 88, 106].forEach(x => {
  mesh(new THREE.SphereGeometry(7, 40, 24), M.white, x, 10, -58);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; cyl(0.3, 0.3, 10, M.struct, x + Math.cos(a) * 6.3, 5, -58 + Math.sin(a) * 6.3, scene, 8); }
  mesh(new THREE.TorusGeometry(7.15, 0.08, 4, 48).rotateX(Math.PI / 2), M.yellow, x, 10, -58);
});
{
  rbox(34, 10, 14, 0.2, std(0xaab3ba, 0.1, 0.8), 80, 5, 18);
  for (let i = 0; i < 4; i++) cyl(3, 3.2, 2.4, std(0x8a949c, 0.2, 0.7), 67 + i * 8.6, 11.2, 18, scene, 28);
}
const FLARE = V(118, 84, 78);
{
  cyl(0.9, 1.4, 84, M.struct, FLARE.x, 42, FLARE.z, scene, 12);
  cyl(1.4, 1.1, 3, M.steel, FLARE.x, 85, FLARE.z, scene, 14);
  [0, 2.1, 4.2].forEach(a => beam(V(FLARE.x, 60, FLARE.z), V(FLARE.x + Math.cos(a) * 45, 0, FLARE.z + Math.sin(a) * 45), 0.04, M.galv));
}
const flame = new THREE.Group(); flame.position.set(FLARE.x, 86.5, FLARE.z); scene.add(flame);
mesh(new THREE.ConeGeometry(1.6, 7, 16, 1, true).translate(0, 3.5, 0), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }), 0, 0, 0, flame);
mesh(new THREE.ConeGeometry(0.9, 4.5, 16, 1, true).translate(0, 2.25, 0), new THREE.MeshBasicMaterial({ color: 0xffd36b, side: THREE.DoubleSide }), 0, 0, 0, flame);

const TANKS = [[-50, -42, 13, 15], [-50, 0, 14, 17], [-50, 42, 12, 14], [-88, -42, 14, 16], [-88, 0, 13, 15], [-88, 42, 14, 17], [-126, -21, 15, 15], [-126, 24, 14, 16]];
const seam = std(0xd6d8da);
TANKS.forEach(([x, z, r, h], i) => {
  cyl(r + 0.3, r + 0.3, 0.8, M.concrete, x, 0.4, z, scene, 48);
  cyl(r, r, h, M.white, x, 0.8 + h / 2, z, scene, 64);
  for (let k = 1; k < 5; k++) mesh(new THREE.TorusGeometry(r + 0.01, 0.03, 4, 64).rotateX(Math.PI / 2), seam, x, 0.8 + h * k / 5, z);
  mesh(new THREE.ConeGeometry(r + 0.15, 2.4, 64, 1, true), M.white, x, 0.8 + h + 1.2, z);
  mesh(new THREE.TorusGeometry(r, 0.06, 4, 64).rotateX(Math.PI / 2), M.yellow, x, 0.8 + h + 1.1, z);
  beam(V(x + (r + 0.6) * Math.cos(0.9), 0.5, z + (r + 0.6) * Math.sin(0.9)), V(x + (r + 0.6) * Math.cos(2.2), h + 0.8, z + (r + 0.6) * Math.sin(2.2)), 0.3, M.struct);
  if (i === 1) {
    const w = 15, th = w / r;
    mesh(new THREE.CylinderGeometry(r + 0.06, r + 0.06, w / 1.515, 40, 1, true, Math.PI / 2 - th / 2, th), logoMat, x, 0.8 + h * 0.55, z);
  }
});
{
  const x0 = -146, x1 = -32, z0 = -64, z1 = 64;
  box(x1 - x0, 1, 0.5, M.concrete, (x0 + x1) / 2, 0.5, z0); box(x1 - x0, 1, 0.5, M.concrete, (x0 + x1) / 2, 0.5, z1);
  box(0.5, 1, z1 - z0, M.concrete, x0, 0.5, 0); box(0.5, 1, z1 - z0, M.concrete, x1, 0.5, 0);
}

{
  const wt = windowsTex(20, 2);
  const side = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.7 });
  mesh(new THREE.BoxGeometry(14, 7, 28), [side, side, M.white, M.white, side, side], -24, 3.5, -70);
  box(14.6, 0.6, 28.6, M.struct, -24, 7.3, -70);
  rbox(4, 1.8, 6, 0.1, M.galv, -26, 8.5, -74);
  [0xbfc3c7, 0x2b2f34, 0xb3161c, 0x9aa4ad, 0xf2f2f2, 0x26364d, 0x5b6167].forEach((c, i) => {
    const car = new THREE.Group(); car.position.set(-10.5, 0, -82 + i * 3.4); scene.add(car);
    rbox(2, 0.85, 4.4, 0.25, std(c, 0.5, 0.35), 0, 0.7, 0, car); rbox(1.75, 0.65, 2.3, 0.2, M.glass, 0, 1.35, -0.2, car);
  });
  cyl(0.06, 0.06, 12, M.galv, -16, 6, -54, scene, 8);
  rbox(3, 3, 3, 0.1, M.white, -10, 1.5, -100); box(2.6, 1.0, 0.05, M.glass, -10, 2.0, -98.48);
  box(0.4, 1.2, 0.4, M.dark, -7.6, 0.6, -97.5);
}
const barrier = new THREE.Group(); barrier.position.set(-7.6, 1.15, -97.5); scene.add(barrier);
{ const arm = new THREE.Group(); barrier.add(arm); for (let i = 0; i < 7; i++) box(2, 0.18, 0.12, i % 2 ? M.white : M.red, 1 + i * 2, 0, 0, arm); }

{
  const C = V(-16, 0, 56);
  mesh(new THREE.PlaneGeometry(26, 22).rotateX(-Math.PI / 2), M.dirt, C.x, 0.03, C.z);
  box(6, 1.2, 6, M.concrete, C.x - 6, 0.6, C.z - 4); box(6, 1.2, 6, M.concrete, C.x + 2, 0.6, C.z - 4);
  box(14, 0.9, 4, M.concrete, C.x - 2, 0.45, C.z + 5);
  [-1, 1].forEach(s => box(0.15, 1.2, 6.4, M.wood, C.x + 8 + s * 3.1, 0.6, C.z - 4));
  [-1, 1].forEach(s => box(6.4, 1.2, 0.15, M.wood, C.x + 8, 0.6, C.z - 4 + s * 3.1));
  const rb = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 3, 4), std(0x8a4a2e, 0.4, 0.6), 36);
  const m4 = new THREE.Matrix4(); let k = 0;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { m4.makeTranslation(C.x + 5.5 + i, 1.5, C.z - 6.5 + j); rb.setMatrixAt(k++, m4); }
  scene.add(rb);
  mesh(new THREE.ConeGeometry(4, 3, 16), M.dirt, C.x - 9, 1.5, C.z + 6);
  const ex = new THREE.Group(); ex.position.set(C.x + 1, 0, C.z + 10); ex.rotation.y = -0.6; scene.add(ex);
  [-1.2, 1.2].forEach(o => rbox(0.8, 0.9, 4.4, 0.3, M.rubber, o, 0.45, 0, ex));
  rbox(2.8, 1.3, 3.2, 0.15, M.yellow, 0, 1.6, 0.2, ex); rbox(1.1, 1.5, 1.2, 0.1, M.yellow, -0.7, 2.9, 0.9, ex); box(1.12, 1.0, 1.0, M.glass, -0.7, 3.0, 0.95, ex);
  beam(V(0.6, 2.2, 1.4), V(0.6, 5, 4.6), 0.28, M.yellow, ex);
  beam(V(0.6, 5, 4.6), V(0.6, 1.4, 6.8), 0.22, M.yellow, ex);
  rbox(1.2, 0.9, 0.8, 0.1, M.dark, 0.6, 1, 6.9, ex);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; mesh(new THREE.ConeGeometry(0.25, 0.75, 10), M.orange, C.x + Math.cos(a) * 14, 0.38, C.z + Math.sin(a) * 12); }
}

const NOZZLE = V(-31.5, 2.2, -44), SHELL = V(-37.2, 3.6, -44);
{
  const vt = new THREE.Group(); vt.position.set(-23, 0, -42); scene.add(vt);
  box(2.2, 0.4, 10, M.dark, 0, 1, 0, vt);
  rbox(2.4, 2.4, 2.2, 0.2, M.white, 0, 2.3, 4, vt); box(2.2, 0.9, 0.05, M.glass, 0, 2.9, 5.11, vt);
  zcyl(1.25, 6.6, M.red, 0, 2.6, -1.3, vt, 32);
  mesh(new THREE.CircleGeometry(1.25, 32), M.steel, 0, 2.6, -4.62, vt).rotation.y = Math.PI;
  [-4, -2.8, 3.8].forEach(z => [-1.1, 1.1].forEach(x => xcyl(0.5, 0.4, M.rubber, x, 0.5, z, vt, 20)));
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-23, 2, -46.5), V(-26, 0.3, -47), V(-29, 0.2, -45.5), V(-31.3, 2.1, -44)]), 30, 0.09, 8), M.dark);
  rbox(0.6, 0.6, 1.4, 0.08, M.yellow, -29, 0.3, -50);
}
const spray = (() => {
  const n = 380, pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) seed[i] = Math.random();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.14, color: 0x7fb4e0, transparent: true, opacity: 0.75, depthWrite: false }));
  scene.add(pts);
  return { pts, seed, pos, n };
})();

{
  const r = 0.6, zP = 104;
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(14, 12.4, 86), V(14, 12.4, 92), V(14, 8, 97), V(13, 1.4, zP), V(4, 1.4, zP)]), 40, r, 16), M.steel);
  xcyl(r, 1600, std(0x55625a, 0.3, 0.5), -796, 1.4, zP, scene, 20);
  const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.8, 2), M.concrete, 70);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 70; i++) { m4.makeTranslation(-4 - i * 9, 0.4, zP); sl.setMatrixAt(i, m4); }
  scene.add(sl);
  mesh(new THREE.PlaneGeometry(1600, 30).rotateX(-Math.PI / 2), std(0xcfccbf, 0, 1), -800, 0.025, zP);
  xcyl(0.95, 6, M.steel, 8, 2.2, zP + 4, scene, 24);
  xcyl(1.15, 0.5, M.dark, 11.2, 2.2, zP + 4, scene, 24);
  beam(V(5, 1.4, zP), V(5, 2.2, zP + 4), 0.45, M.steel);
  [[2, zP], [6.5, zP + 4]].forEach(([x, z]) => { rbox(0.9, 1.4, 0.9, 0.08, M.blue, x, 2.2, z); mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 24).rotateX(Math.PI / 2), M.red, x, 3.2, z); });
  box(7, 0.3, 4, M.galv, -10, 0.15, zP + 6); rbox(5, 3, 3, 0.1, M.white, -10, 1.8, zP + 6);
  [-12, -8].forEach(x => cyl(0.35, 0.35, 1.6, M.yellow, x, 1.1, zP + 3.4, scene, 12));
  for (let i = 0; i < 20; i++) cyl(0.08, 0.08, 1.5, M.yellow, -40 - i * 70, 0.75, zP - 4, scene, 6);
}

{
  let s = 7; const rnd = (a, b) => { s = (s * 16807) % 2147483647; return a + (s / 2147483647) * (b - a); };
  const bg = std(0xc9cfd4, 0.1, 0.85);
  for (let i = 0; i < 60; i++) {
    const x = rnd(-700, 700), z = rnd(260, 900);
    if (Math.abs(x) < 60 && z < 320) continue;
    const t = rnd(0, 1);
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
  const pipeGeo = new THREE.CylinderGeometry(pr, pr, plen, 24).rotateX(Math.PI / 2);
  const capGeo = new THREE.CylinderGeometry(pr + 0.02, pr + 0.02, 0.12, 24).rotateX(Math.PI / 2);
  const makePipe = (parent, x, y, z) => {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    mesh(pipeGeo, M.steel, 0, 0, 0, g);
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
   Mobile crane
   ========================================================= */
const crane = {};
const LOAD_START = V(TRUCK_X, LIFT_LOCAL.y, TRUCK_Z1 + LIFT_LOCAL.z);
const LOAD_END = V(11.2, 12.3 + 0.32, LOAD_START.z);
const CRANE_PIVOT = V(-3.6, 4.0, LOAD_START.z - 4);
{
  const g = new THREE.Group(); g.position.set(-3.6, 0, LOAD_START.z - 2); scene.add(g);
  rbox(2.8, 1.4, 11, 0.15, M.yellow, 0, 1.4, 0, g);
  rbox(2.4, 2, 2, 0.15, M.yellow, 0, 2.6, 4.4, g); box(2.2, 0.9, 0.05, M.glass, 0, 3.0, 5.41, g);
  [-4, -2.4, 2.4, 4].forEach(z => [-1.25, 1.25].forEach(x => xcyl(0.6, 0.5, M.rubber, x, 0.6, z, g, 24)));
  [-3.8, 3.8].forEach(z => [-1, 1].forEach(s => { box(3, 0.3, 0.4, M.dark, s * 2.5, 0.8, z, g); box(0.15, 0.7, 0.15, M.dark, s * 3.9, 0.45, z, g); box(0.9, 0.12, 0.9, M.wood, s * 3.9, 0.06, z, g); }));
  rbox(2.6, 1.3, 3.6, 0.12, M.yellow, 0, 2.75, -2, g);
  rbox(2.4, 1.2, 1.2, 0.1, M.dark, 0, 2.7, -4.2, g);
  rbox(1.0, 1.4, 1.2, 0.1, M.yellow, 1.25, 3, -0.7, g); box(0.05, 0.8, 0.9, M.glass, 1.76, 3.2, -0.7, g);
  crane.boom = beam(CRANE_PIVOT, V(0, 30, 0), 0.5, M.yellow);
  crane.boom2 = beam(CRANE_PIVOT, V(0, 30, 0), 0.36, std(0xe8a810, 0.1, 0.5));
  crane.cable = beam(V(0, 0, 0), V(0, 1, 0), 0.03, M.dark);
  crane.hook = rbox(0.45, 0.6, 0.35, 0.06, M.red, 0, 0, 0);
  crane.sl1 = beam(V(), V(0, 1, 0), 0.025, M.yellow);
  crane.sl2 = beam(V(), V(0, 1, 0), 0.025, M.yellow);
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
  setBeam(crane.boom, CRANE_PIVOT, CRANE_PIVOT.clone().lerp(tip, 0.55), 0.5);
  setBeam(crane.boom2, CRANE_PIVOT, tip, 0.36);
  setBeam(crane.cable, hook, tip, 0.03);
  crane.hook.position.copy(hook);
  crane.sl1.visible = crane.sl2.visible = s > 0;
  if (s > 0) { setBeam(crane.sl1, hook, p.clone().add(V(0, 0.3, -3.5)), 0.025); setBeam(crane.sl2, hook, p.clone().add(V(0, 0.3, 3.5)), 0.025); }
}

/* =========================================================
   Discipline highlights: clean red survey rings
   ========================================================= */
const HL = [
  { at: V(26, 0, -10), r: 22 }, { at: V(-16, 0, 56), r: 15 }, { at: V(34, 0, -26), r: 8 },
  { at: V(-30, 0, -44), r: 11 }, { at: V(2, 0, 104), r: 13 }, { at: V(-18, 0, -78), r: 18 },
].map(h => {
  const g = new THREE.Group(); g.position.copy(h.at); scene.add(g);
  const mat = new THREE.MeshBasicMaterial({ color: 0xe31e24, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const mat2 = mat.clone();
  const fill = new THREE.MeshBasicMaterial({ color: 0xe31e24, transparent: true, opacity: 0, depthWrite: false });
  mesh(new THREE.RingGeometry(h.r - 0.3, h.r, 128).rotateX(-Math.PI / 2), mat, 0, 0.14, 0, g);
  const ring2 = mesh(new THREE.RingGeometry(h.r - 0.12, h.r, 128).rotateX(-Math.PI / 2), mat2, 0, 0.14, 0, g);
  mesh(new THREE.CircleGeometry(h.r, 96).rotateX(-Math.PI / 2), fill, 0, 0.12, 0, g);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    mesh(new THREE.PlaneGeometry(h.r * 0.16, 0.3).rotateX(-Math.PI / 2), mat, Math.cos(a) * (h.r + 1.2), 0.14, Math.sin(a) * (h.r + 1.2), g).rotation.y = -a;
  }
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
  { p: 0.555, pos: () => V(-6, 30, -64), look: () => V(30, 18, -4) },
  { p: 0.627, pos: () => V(8, 14, 30), look: () => V(-16, 0, 56) },
  { p: 0.697, pos: () => V(14, 17, -46), look: () => V(34, 14, -26) },
  { p: 0.767, pos: () => V(-6, 15, -14), look: () => V(-34, 2, -44) },
  { p: 0.837, pos: () => V(7, 4, 113), look: () => V(-55, 1.2, 103) },
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
const nav = document.querySelector('.nav');
const toggle = document.querySelector('.sound-toggle');
let pTarget = 0, p = 0, lastActive = -1, statsDone = false;

const storyMax = () => story.offsetHeight - window.innerHeight;
const storyProgress = () => Math.min(1, Math.max(0, window.scrollY / storyMax()));
window.addEventListener('scroll', () => { pTarget = storyProgress(); }, { passive: true });
chapters.forEach(b => b.addEventListener('click', () => window.scrollTo({ top: (+b.dataset.at) * storyMax() + 2, behavior: 'smooth' })));

function panelAlpha(pp, a, b) {
  const f = 0.014;
  return (a <= 0 ? 1 : smooth(a, a + f, pp)) * (b >= 1 ? 1 : 1 - smooth(b - f, b, pp));
}
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
  const pastStory = window.scrollY > storyMax() - window.innerHeight * 0.2;
  chapWrap.classList.toggle('hide', pastStory);
  nav.classList.toggle('solid', pastStory);
  if (!statsDone && pp > 0.955) { statsDone = true; countUp(); }
}
function countUp() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count, t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 1400); el.textContent = Math.round(to * ease(k)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

document.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') sound.hover(); });
  el.addEventListener('pointerdown', () => sound.click());
});
const setSound = on => { sound.setEnabled(on); toggle.classList.toggle('on', on); toggle.querySelector('em').textContent = on ? 'Sound on' : 'Sound off'; };
toggle.addEventListener('click', () => setSound(!sound.enabled));
document.querySelectorAll('[data-enter]').forEach(b => b.addEventListener('click', () => {
  setSound(b.dataset.enter === 'sound');
  document.getElementById('loader').classList.add('done');
}));
['pointerdown', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, () => sound.resume(), { passive: true }));
document.addEventListener('visibilitychange', () => { if (!document.hidden) sound.resume(); });

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
  pts.slice(1).forEach(p => { s += `<line x1="${X(hq[1])}" y1="${Y(hq[2])}" x2="${X(p[1])}" y2="${Y(p[2])}" stroke="rgba(227,30,36,.4)" stroke-dasharray="3 5"/>`; });
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
const VMAX = 26, ACC = 7;                 // ~58 mph top speed, realistic accel/brake
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

  // Truck physics: chase the scroll target with top-speed and braking limits
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
  const sWant = parked ? smooth(P_LIFT0, P_LIFT1, p) : 0;
  const prevS = liftS;
  liftS += THREE.MathUtils.clamp(sWant - liftS, -dt * 0.5, dt * 0.5);
  updateCrane(liftS, truck.position.clone().add(LIFT_LOCAL));
  if (liftS >= 0.999 && !landed) { landed = true; sound.clank(); }
  if (liftS < 0.95) landed = false;

  const c = cameraAt(p, T);
  camera.position.copy(c.pos);
  camera.lookAt(c.look);
  sun.target.position.copy(c.look); sun.position.copy(c.look).add(SUN_OFF);

  HL.forEach((h, i) => {
    const pn = panels.find(q => q.cap === String(i));
    const target = pn ? panelAlpha(p, pn.a - 0.01, pn.b + 0.01) : 0;
    h.w += (target - h.w) * Math.min(1, dt * 5);
    const k = (elapsed * 0.4) % 1;
    h.mat.opacity = h.w * 0.95; h.fill.opacity = h.w * 0.1;
    h.ring2.scale.setScalar(0.4 + k * 0.6); h.mat2.opacity = h.w * (1 - k);
    h.g.visible = h.w > 0.01;
  });

  const fl = 1 + Math.sin(elapsed * 9) * 0.07 + Math.sin(elapsed * 23) * 0.05;
  flame.scale.set(fl, 2 - fl, fl); flame.rotation.z = Math.sin(elapsed * 1.3) * 0.08;
  const blink = Math.sin(elapsed * 2.4) > 0;
  beacons.forEach(b => { b.visible = blink; });

  {
    const d = SHELL.clone().sub(NOZZLE);
    for (let i = 0; i < spray.n; i++) {
      const k = (spray.seed[i] + elapsed * 1.4) % 1, sp = 0.06 + k * 0.5, j = i * 3;
      const r1 = Math.sin(i * 12.9898) * 0.5, r2 = Math.sin(i * 78.233) * 0.5;
      if (k < 0.75) { const f = k / 0.75; spray.pos[j] = NOZZLE.x + d.x * f; spray.pos[j + 1] = NOZZLE.y + d.y * f + r1 * sp * 0.4; spray.pos[j + 2] = NOZZLE.z + d.z * f + r2 * sp * 0.4; }
      else { const m = (k - 0.75) / 0.25; spray.pos[j] = SHELL.x + 0.2 + m * 1.6 * (0.6 + r1); spray.pos[j + 1] = SHELL.y + r2 * 3 * m - m * m * 1.2; spray.pos[j + 2] = SHELL.z + r1 * 4 * m; }
    }
    spray.pts.geometry.attributes.position.needsUpdate = true;
  }

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
document.getElementById('loader').classList.add('ready');
window.__pmi = { setP: v => { pTarget = p = v; truckZ = truckTarget(v); truckV = 0; liftS = v > P_LIFT0 ? smooth(P_LIFT0, P_LIFT1, v) : 0; }, sound, scene, camera };
