import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundEngine } from './audio.js';

/* =========================================================
   Renderer / scene
   ========================================================= */
const canvas = document.getElementById('scene');
const isMobile = window.innerWidth < 760;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const FOG = new THREE.Color(0x2a1d1e);
scene.fog = new THREE.FogExp2(FOG, 0.0019);
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 4000);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;

// Sky dome: dusk gradient, red-orange glow on the refinery side (+z)
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(3000, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x05070c) }, mid: { value: new THREE.Color(0x141a28) },
                glow: { value: new THREE.Color(0x8a3418) }, horizon: { value: FOG } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top,mid,glow,horizon; varying vec3 vP;
      void main(){ float h = vP.y;
        vec3 c = mix(horizon, mid, smoothstep(0.0,0.18,h));
        c = mix(c, top, smoothstep(0.18,0.7,h));
        float g = pow(max(0.0, vP.z*0.5+0.5), 3.0) * (1.0 - smoothstep(0.0,0.35,h));
        c += glow * g * 0.9;
        if(h<0.0) c = horizon;
        gl_FragColor = vec4(c,1.0); }`
  })
);
scene.add(sky);

// Stars
{
  const n = 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(0.15 + Math.random() * 0.85);
    pos[i * 3] = 2800 * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = 2800 * Math.cos(ph); pos[i * 3 + 2] = 2800 * Math.sin(ph) * Math.sin(th);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfcfe8, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 })));
}

// Lights
scene.add(new THREE.HemisphereLight(0x8fa2c8, 0x2a1c14, 0.9));
const sun = new THREE.DirectionalLight(0xff8a50, 2.2); sun.position.set(-120, 70, 400); scene.add(sun);
const moon = new THREE.DirectionalLight(0x7d93c4, 1.0); moon.position.set(200, 260, -300); scene.add(moon);

/* =========================================================
   Materials & helpers
   ========================================================= */
const std = (color, metalness = 0.2, roughness = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
const M = {
  ground: std(0x121417, 0, 1), pad: std(0x24272b, 0, 0.95), asphalt: std(0x17191c, 0, 0.92),
  concrete: std(0x7a7671, 0, 0.95), steel: std(0x8b9299, 0.75, 0.42), dark: std(0x33383e, 0.6, 0.55),
  insul: std(0xaeb4ba, 0.6, 0.5), white: std(0xd8dbdd, 0.1, 0.55), red: std(0xd71920, 0.3, 0.45),
  rust: std(0x5d2b22, 0.3, 0.8), yellow: std(0xf0b21a, 0.3, 0.5), green: std(0x2f5d3a, 0.3, 0.6),
  rubber: std(0x0d0d0d, 0, 0.9), chrome: std(0xe8e8e8, 1, 0.12), glass: std(0x0d141c, 0.9, 0.08),
  wood: std(0x6b4a2b, 0, 0.9), dirt: std(0x4a3626, 0, 1), galv: std(0xa7adb3, 0.8, 0.45),
  orange: std(0xff6a13, 0.1, 0.6), blue: std(0x1d4f91, 0.3, 0.5),
  cab: new THREE.MeshPhysicalMaterial({ color: 0xc8141b, metalness: 0.45, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 }),
};
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
const G = { warm: glow(5, 3.6, 2.2), red: glow(6, 0.4, 0.3), amber: glow(6, 2.6, 0.3), head: glow(3.2, 3.1, 2.8), tail: glow(5, 0.2, 0.2) };

function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
}
const box = (w, h, d, mat, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
const cyl = (rt, rb, h, mat, x, y, z, p, seg = 20) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, p);
// Beam between two points (geometry along +z, 0..1)
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5);
function beam(a, b, r, mat, parent = scene) {
  const m = new THREE.Mesh(beamGeo, mat); parent.add(m); setBeam(m, a, b, r); return m;
}
function setBeam(m, a, b, r) {
  m.position.copy(a); m.lookAt(b); m.scale.set(r, r, a.distanceTo(b));
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Lamps collected and drawn as instanced glowing points
const lamps = [], redLamps = [], pools = [];
const lamp = (x, y, z, pool = false) => { lamps.push(V(x, y, z)); if (pool) pools.push(V(x, 0.06, z)); };

// Textures
const texLoader = new THREE.TextureLoader();
const logoTex = texLoader.load('assets/pmi-logo.png'); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8;
const logoMat = new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.5, metalness: 0.1, alphaTest: 0.05 });

function radialTex(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function windowsTex(cols, rows, litRatio = 0.6) {
  const c = document.createElement('canvas'); c.width = cols * 16; c.height = rows * 24;
  const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    x.fillStyle = Math.random() < litRatio ? (Math.random() < 0.8 ? '#ffd9a0' : '#cfe6ff') : '#0a0d12';
    x.fillRect(i * 16 + 3, j * 24 + 6, 10, 12);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* =========================================================
   Ground, roads, fence
   ========================================================= */
mesh(new THREE.PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2), M.ground);
mesh(new THREE.PlaneGeometry(310, 215).rotateX(-Math.PI / 2), M.pad, 0, 0.02, 5);
// Approach road (x -7..7) from far away to the gate, then plant lane
mesh(new THREE.PlaneGeometry(14, 1700).rotateX(-Math.PI / 2), M.asphalt, 0, 0.04, -96 - 850);
mesh(new THREE.PlaneGeometry(14, 200).rotateX(-Math.PI / 2), M.asphalt, 0, 0.04, 4);
{
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.18, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc9a227 }), 300);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 300; i++) { m4.makeTranslation(0, 0.06, -100 - i * 6); dash.setMatrixAt(i, m4); }
  scene.add(dash);
  [-6.6, 6.6].forEach(x => mesh(new THREE.PlaneGeometry(0.15, 1700).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8d9094 }), x, 0.06, -946));
  // Street lights along approach
  for (let z = -130; z > -1500; z -= 55) {
    const side = (Math.round(z / 55) % 2) ? -9 : 9;
    cyl(0.12, 0.16, 10, M.dark, side, 5, z);
    box(Math.abs(side) > 0 ? 2.4 : 0, 0.12, 0.3, M.dark, side * 0.88, 10, z);
    lamp(side * 0.8, 9.85, z, true);
  }
}
// Perimeter fence with gate
{
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), M.galv, 120);
  const m4 = new THREE.Matrix4(); let k = 0;
  for (let x = -155; x <= 155; x += 5) { if (Math.abs(x) < 9) continue; m4.makeTranslation(x, 1.3, -96); posts.setMatrixAt(k++, m4); }
  posts.count = k; scene.add(posts);
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, transparent: true, opacity: 0.18, side: THREE.DoubleSide, metalness: 0.6 });
  [-1, 1].forEach(s => {
    mesh(new THREE.PlaneGeometry(146, 2.4), fenceMat, s * 82, 1.25, -96);
    box(146, 0.06, 0.06, M.galv, s * 82, 2.55, -96);
  });
}

/* =========================================================
   Refinery units
   ========================================================= */
const RACK = { x0: 10, x1: 18, z0: -80, z1: 86 };

function column(x, z, r, h, { scaffold = false } = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  cyl(r * 1.25, r * 1.35, 1.2, M.concrete, 0, 0.6, 0, g, 24);
  cyl(r * 1.02, r * 1.06, 3, M.dark, 0, 2.7, 0, g, 24);
  cyl(r, r, h, M.insul, 0, 4.2 + h / 2, 0, g, 28);
  mesh(new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.insul, 0, 4.2 + h, 0, g);
  const top = 4.2 + h + r;
  for (let y = 12; y < h; y += 9) {
    mesh(new THREE.RingGeometry(r, r + 1.5, 32).rotateX(-Math.PI / 2), M.dark, 0, y, 0, g).material.side = THREE.DoubleSide;
    mesh(new THREE.TorusGeometry(r + 1.45, 0.05, 4, 40).rotateX(Math.PI / 2), M.yellow, 0, y + 1.1, 0, g);
    const a = Math.random() * Math.PI * 2;
    lamp(x + Math.cos(a) * (r + 1.3), y + 2.2, z + Math.sin(a) * (r + 1.3));
  }
  box(0.5, h, 0.12, M.dark, r + 0.35, 4.2 + h / 2, 0, g);           // ladder
  cyl(0.28, 0.28, h, M.steel, -r - 0.5, 4.2 + h / 2, 0, g, 8);      // side line
  redLamps.push(V(x, top + 0.6, z));
  // Overhead vapor line to the pipe rack
  const pts = [V(x, top, z), V(x, top + 2, z), V(x - (x - RACK.x1) * 0.35, top + 1, z),
               V(RACK.x1 + 3, 13.6, z), V(RACK.x1 - 0.8, 12.9, z)];
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r > 3 ? 0.55 : 0.38, 10), M.insul);
  if (scaffold) buildScaffold(x, z, r, Math.min(h - 6, 26));
  return g;
}

function buildScaffold(cx, cz, r, height) {
  const half = r + 1.4, bay = 2.0, lift = 2.0;
  const verts = [], ledgers = [], planks = [];
  for (let s = -half; s <= half + 0.01; s += bay) for (const side of [-half, half]) { verts.push([s, side]); verts.push([side, s]); }
  const uniq = [...new Map(verts.map(v => [v.map(n => n.toFixed(2)).join(','), v])).values()];
  const vMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, height, 5), M.galv, uniq.length);
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
      const rotY = k % 2 ? Math.PI / 2 : 0;
      q.setFromEuler(new THREE.Euler(0, rotY, 0));
      const off = (k < 2 ? -1 : 1) * half;
      const p = k % 2 ? V(cx + off, y, cz) : V(cx, y, cz + off);
      lMesh.setMatrixAt(li++, m4.compose(p, q, s1));
      if (l % 2 === 0) {
        const inward = (k < 2 ? 0.6 : -0.6);
        const pp = k % 2 ? V(cx + off + inward, y + 0.05, cz) : V(cx, y + 0.05, cz + off + inward);
        pMesh.setMatrixAt(pi, m4.compose(pp, q, s1));
        const tp = k % 2 ? V(cx + off, y + 0.15, cz) : V(cx, y + 0.15, cz + off);
        tMesh.setMatrixAt(pi++, m4.compose(tp, q, s1));
      }
    }
  }
  lMesh.count = li; pMesh.count = pi; tMesh.count = pi;
  scene.add(lMesh, pMesh, tMesh);
}

// Pipe rack
{
  const bents = [];
  for (let z = RACK.z0; z <= RACK.z1; z += 6) bents.push(z);
  const colM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 12.4, 0.45), M.dark, bents.length * 2);
  const beamM = new THREE.InstancedMesh(new THREE.BoxGeometry(8.6, 0.4, 0.35), M.dark, bents.length * 2);
  const m4 = new THREE.Matrix4(); let c = 0, b = 0;
  bents.forEach((z, i) => {
    [RACK.x0, RACK.x1].forEach(x => { m4.makeTranslation(x, 6.2, z); colM.setMatrixAt(c++, m4); });
    [6.4, 12.1].forEach(y => { m4.makeTranslation((RACK.x0 + RACK.x1) / 2, y, z); beamM.setMatrixAt(b++, m4); });
    if (i % 3 === 0) lamp(RACK.x0 - 0.3, 11.3, z, true);
  });
  scene.add(colM, beamM);
  const L = RACK.z1 - RACK.z0, zc = (RACK.z0 + RACK.z1) / 2;
  [RACK.x0, RACK.x1].forEach(x => [6.4, 12.1].forEach(y => box(0.3, 0.3, L, M.dark, x, y, zc)));
  const pipe = (x, y, r, mat) => mesh(new THREE.CylinderGeometry(r, r, L, 14).rotateX(Math.PI / 2), mat, x, y + r, zc);
  // top tier (x=11.2 slot left open for the spool PMI sets)
  [[12.4, 0.42, M.insul], [13.5, 0.3, M.steel], [14.5, 0.48, M.insul], [15.6, 0.28, M.yellow], [16.5, 0.35, M.steel], [17.4, 0.25, M.red]]
    .forEach(([x, r, m]) => pipe(x, 12.3, r, m));
  [[10.8, 0.3, M.steel], [11.8, 0.42, M.insul], [12.9, 0.25, M.green], [13.9, 0.36, M.steel], [15.0, 0.3, M.insul], [16.1, 0.45, M.steel], [17.2, 0.22, M.steel]]
    .forEach(([x, r, m]) => pipe(x, 6.6, r, m));
  // Cable tray
  box(0.9, 0.15, L, M.galv, RACK.x1 - 0.6, 9.6, zc);
}

// Distillation & process columns
column(34, -26, 3, 50, { scaffold: true });
column(47, -6, 2.3, 38);
column(34, 14, 3.6, 62);
column(50, 30, 2, 30);
column(62, -30, 2.6, 44);

// Horizontal drums & exchangers near the rack
[[-52, 1.6, 9], [-62, 1.4, 8], [40, 1.2, 6]].forEach(([z, r, l], i) => {
  const x = i < 2 ? 26 : 26;
  mesh(new THREE.CylinderGeometry(r, r, l, 20).rotateX(Math.PI / 2), M.white, x, 3.2, z);
  [-l / 3, l / 3].forEach(o => box(r * 1.6, 2.2, 0.5, M.concrete, x, 1.1, z + o));
  lamp(x + r + 0.4, 5, z);
});
// Fired heater
{
  box(14, 12, 9, M.rust, 34, 6, 46); box(14.4, 0.6, 9.4, M.dark, 34, 12.3, 46);
  [-3.5, 3.5].forEach(o => { cyl(1.2, 1.4, 30, M.dark, 34 + o, 27, 46); redLamps.push(V(34 + o, 42.6, 46)); });
  for (let i = 0; i < 6; i++) lamp(26.7, 2 + i * 1.8, 42 + (i % 3) * 3);
  // burner glow
  box(13.6, 1.2, 0.1, glow(4, 1.3, 0.3), 34, 1.6, 41.45);
}
// Spheres
[70, 88, 106].forEach(x => {
  mesh(new THREE.SphereGeometry(7, 28, 18), M.white, x, 10, -58);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; cyl(0.3, 0.3, 10, M.dark, x + Math.cos(a) * 6.3, 5, -58 + Math.sin(a) * 6.3, scene, 6); }
  mesh(new THREE.TorusGeometry(7.15, 0.08, 4, 40).rotateX(Math.PI / 2), M.yellow, x, 10, -58);
  lamp(x, 17.6, -58);
});
// Cooling tower
{
  box(34, 10, 14, std(0x3d4a52, 0.2, 0.8), 80, 5, 18);
  for (let i = 0; i < 4; i++) { cyl(3, 3, 2.2, std(0x2c353b, 0.3, 0.7), 67 + i * 8.6, 11, 18); lamp(67 + i * 8.6, 12.6, 22.5); }
}
// Flare
const FLARE = V(118, 84, 78);
{
  cyl(0.9, 1.4, 84, M.dark, FLARE.x, 42, FLARE.z, scene, 10);
  cyl(1.4, 1.1, 3, M.steel, FLARE.x, 85, FLARE.z, scene, 12);
  [0, 2.1, 4.2].forEach(a => beam(V(FLARE.x, 60, FLARE.z), V(FLARE.x + Math.cos(a) * 45, 0, FLARE.z + Math.sin(a) * 45), 0.04, M.galv));
  for (let y = 20; y < 84; y += 16) redLamps.push(V(FLARE.x + 1.2, y, FLARE.z));
}
const flareTex = radialTex([[0, 'rgba(255,250,220,1)'], [0.2, 'rgba(255,190,80,.95)'], [0.5, 'rgba(255,90,20,.5)'], [1, 'rgba(255,40,0,0)']]);
const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(2.4, 1.6, 1.1) }));
flame.position.set(FLARE.x, 92, FLARE.z); flame.scale.set(10, 18, 1); scene.add(flame);
const flameLight = new THREE.PointLight(0xff8a3a, 180, 600, 1.1); flameLight.position.set(FLARE.x, 92, FLARE.z); scene.add(flameLight);

// Tank farm (dike + tanks), one with the PMI logo facing the plant lane
const TANKS = [[-50, -42, 13, 15], [-50, 0, 14, 17], [-50, 42, 12, 14], [-88, -42, 14, 16], [-88, 0, 13, 15], [-88, 42, 14, 17], [-126, -21, 15, 15], [-126, 24, 14, 16]];
TANKS.forEach(([x, z, r, h], i) => {
  cyl(r + 0.3, r + 0.3, 0.8, M.concrete, x, 0.4, z, scene, 40);
  cyl(r, r, h, M.white, x, 0.8 + h / 2, z, scene, 48);
  mesh(new THREE.ConeGeometry(r + 0.15, 2.4, 48, 1, true), M.white, x, 0.8 + h + 1.2, z);
  mesh(new THREE.TorusGeometry(r, 0.06, 4, 64).rotateX(Math.PI / 2), M.yellow, x, 0.8 + h + 1.1, z);
  // stair stringer
  const s = V(x + r * Math.cos(0.9), 0.5, z + r * Math.sin(0.9)), e = V(x + r * Math.cos(2.2), h + 0.8, z + r * Math.sin(2.2));
  beam(s.clone().multiplyScalar(1).add(V(Math.cos(0.9) * 0.6, 0, Math.sin(0.9) * 0.6)), e.clone().add(V(Math.cos(2.2) * 0.6, 0, Math.sin(2.2) * 0.6)), 0.3, M.dark);
  lamp(x + r + 0.3, h + 1.6, z);
  if (i === 1) {
    const w = 15, th = w / r;
    mesh(new THREE.CylinderGeometry(r + 0.06, r + 0.06, w / 1.515, 32, 1, true, Math.PI / 2 - th / 2, th), logoMat, x, 0.8 + h * 0.55, z);
  }
});
// Dike wall
{
  const x0 = -146, x1 = -32, z0 = -64, z1 = 64;
  box(x1 - x0, 1, 0.5, M.concrete, (x0 + x1) / 2, 0.5, z0); box(x1 - x0, 1, 0.5, M.concrete, (x0 + x1) / 2, 0.5, z1);
  box(0.5, 1, z1 - z0, M.concrete, x0, 0.5, 0); box(0.5, 1, z1 - z0, M.concrete, x1, 0.5, 0);
}

// Control building + guard shack (facility services)
{
  const wt = windowsTex(20, 2, 0.75);
  const wallMats = [0, 1, 2, 3, 4, 5].map(i => (i === 2 || i === 3) ? M.white :
    new THREE.MeshStandardMaterial({ color: 0xd8dbdd, roughness: 0.6, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 0.65 }));
  mesh(new THREE.BoxGeometry(14, 7, 28), wallMats, -24, 3.5, -70);
  box(14.6, 0.6, 28.6, M.dark, -24, 7.3, -70);
  box(4, 1.8, 6, M.galv, -26, 8.5, -74);   // HVAC
  // Parking
  for (let i = 0; i < 7; i++) {
    const c = [0xbfc3c7, 0x23272c, 0x7d1214, 0x9aa4ad, 0xe1e1e1, 0x1c2a3d, 0x555b61][i];
    const car = new THREE.Group(); car.position.set(-10.5, 0, -82 + i * 3.4); scene.add(car);
    box(2, 0.9, 4.4, std(c, 0.6, 0.35), 0, 0.75, 0, car); box(1.8, 0.7, 2.4, M.glass, 0, 1.5, -0.2, car);
  }
  cyl(0.06, 0.06, 12, M.galv, -16, 6, -54);
  // Guard shack + barrier arm
  box(3, 3, 3, M.white, -10, 1.5, -100); box(3.2, 1.1, 0.05, glow(2.5, 2.0, 1.4), -10, 2.1, -98.48);
  box(0.4, 1.2, 0.4, M.dark, -7.6, 0.6, -97.5);
}
const barrier = new THREE.Group(); barrier.position.set(-7.6, 1.15, -97.5); scene.add(barrier);
{
  const arm = new THREE.Group(); barrier.add(arm);
  for (let i = 0; i < 7; i++) box(2, 0.18, 0.12, i % 2 ? M.white : M.red, 1 + i * 2, 0, 0, arm);
}

// Civil area: new foundations, rebar, excavator
{
  const C = V(-16, 0, 56);
  mesh(new THREE.PlaneGeometry(26, 22).rotateX(-Math.PI / 2), M.dirt, C.x, 0.03, C.z);
  box(6, 1.2, 6, M.concrete, C.x - 6, 0.6, C.z - 4); box(6, 1.2, 6, M.concrete, C.x + 2, 0.6, C.z - 4);
  box(14, 0.9, 4, M.concrete, C.x - 2, 0.45, C.z + 5);
  // forms + rebar cage
  [[-1, 0], [1, 0]].forEach(([s]) => box(0.15, 1.2, 6.4, M.wood, C.x + 8 + s * 3.1, 0.6, C.z - 4));
  [[0, -1], [0, 1]].forEach(([, s]) => box(6.4, 1.2, 0.15, M.wood, C.x + 8, 0.6, C.z - 4 + s * 3.1));
  const rb = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 3, 4), std(0x6b3b26, 0.6, 0.6), 36);
  const m4 = new THREE.Matrix4(); let k = 0;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { m4.makeTranslation(C.x + 5.5 + i, 1.5, C.z - 6.5 + j); rb.setMatrixAt(k++, m4); }
  scene.add(rb);
  mesh(new THREE.ConeGeometry(4, 3, 12), M.dirt, C.x - 9, 1.5, C.z + 6);
  // excavator
  const ex = new THREE.Group(); ex.position.set(C.x + 1, 0, C.z + 10); ex.rotation.y = -0.6; scene.add(ex);
  [-1.2, 1.2].forEach(o => box(0.8, 0.9, 4.4, M.rubber, o, 0.45, 0, ex));
  box(2.8, 1.3, 3.2, M.yellow, 0, 1.6, 0.2, ex); box(1.1, 1.4, 1.2, M.yellow, -0.7, 2.9, 0.9, ex); box(1, 1.1, 1, M.glass, -0.7, 2.95, 0.95, ex);
  const b1 = beam(V(0.6, 2.2, 1.4), V(0.6, 5, 4.6), 0.28, M.yellow, ex);
  const b2 = beam(V(0.6, 5, 4.6), V(0.6, 1.4, 6.8), 0.22, M.yellow, ex);
  box(1.2, 0.9, 0.8, M.dark, 0.6, 1, 6.9, ex);
  // barricades + cones
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; mesh(new THREE.ConeGeometry(0.25, 0.75, 8), M.orange, C.x + Math.cos(a) * 14, 0.38, C.z + Math.sin(a) * 12); }
  lamp(C.x + 12, 6, C.z - 10, true); cyl(0.1, 0.1, 6, M.dark, C.x + 12, 3, C.z - 10);
}

// Industrial cleaning: vac truck + hydroblast at tank
const NOZZLE = V(-31.5, 2.2, -44), SHELL = V(-37.2, 3.6, -44);
{
  const vt = new THREE.Group(); vt.position.set(-23, 0, -42); scene.add(vt);
  box(2.4, 0.4, 10, M.dark, 0, 1, 0, vt);
  box(2.4, 2.4, 2.2, M.white, 0, 2.3, 4, vt); box(2.3, 0.9, 0.05, M.glass, 0, 2.9, 5.12, vt);
  mesh(new THREE.CylinderGeometry(1.25, 1.25, 6.6, 24).rotateX(Math.PI / 2), M.red, 0, 2.6, -1.3, vt);
  mesh(new THREE.CircleGeometry(1.25, 24), M.steel, 0, 2.6, -4.62, vt).rotation.y = Math.PI;
  [-4, -2.8, 3.8].forEach(z => [-1.1, 1.1].forEach(x => mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16).rotateZ(Math.PI / 2), M.rubber, x, 0.5, z, vt)));
  const hp = [V(-23, 2, -46.5), V(-26, 0.3, -47), V(-29, 0.2, -45.5), V(-31.3, 2.1, -44)];
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 30, 0.09, 6), std(0x111111, 0, 0.7));
  box(0.5, 0.5, 1.4, M.yellow, -29, 0.25, -50); // pump skid
  cyl(0.1, 0.1, 6, M.dark, -27, 3, -38); lamp(-27, 6.1, -38, true);
}
const spray = (() => {
  const n = 380, pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) seed[i] = Math.random();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.16, color: new THREE.Color(1.6, 1.9, 2.4), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  scene.add(pts);
  return { pts, seed, pos, n };
})();

// Pipeline leaving the plant + pig launcher & meter skid
{
  const r = 0.6, zP = 104;
  const drop = [V(14, 12.4, 86), V(14, 12.4, 92), V(14, 8, 97), V(13, 1.4, zP), V(4, 1.4, zP)];
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(drop), 40, r, 14), M.steel);
  mesh(new THREE.CylinderGeometry(r, r, 1600, 16).rotateZ(Math.PI / 2), std(0x8a8f86, 0.45, 0.45), -796, 1.4, zP);
  const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.8, 2), M.concrete, 70);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 70; i++) { m4.makeTranslation(-4 - i * 9, 0.4, zP); sl.setMatrixAt(i, m4); }
  scene.add(sl);
  mesh(new THREE.PlaneGeometry(1600, 30).rotateX(-Math.PI / 2), std(0x1c1f1b, 0, 1), -800, 0.025, zP);
  // pig launcher (oversize barrel w/ closure) + valves
  mesh(new THREE.CylinderGeometry(0.95, 0.95, 6, 20).rotateZ(Math.PI / 2), M.steel, 8, 2.2, zP + 4);
  mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.5, 20).rotateZ(Math.PI / 2), M.dark, 11.2, 2.2, zP + 4);
  beam(V(5, 1.4, zP), V(5, 2.2, zP + 4), 0.45, M.steel);
  [[2, zP], [6.5, zP + 4]].forEach(([x, z]) => { box(0.9, 1.4, 0.9, M.blue, x, 2.2, z); mesh(new THREE.TorusGeometry(0.55, 0.06, 6, 20).rotateX(Math.PI / 2), M.red, x, 3.2, z); });
  // meter skid
  box(7, 0.3, 4, M.galv, -10, 0.15, zP + 6); box(5, 3, 3, M.white, -10, 1.8, zP + 6);
  [[-12, 1], [-8, 1]].forEach(([x]) => cyl(0.35, 0.35, 1.6, M.yellow, x, 1.1, zP + 3.4, scene, 10));
  lamp(-10, 5, zP + 3.5, true); cyl(0.1, 0.1, 5, M.dark, -6, 2.5, zP + 3.5);
  // ROW marker posts
  for (let i = 0; i < 20; i++) cyl(0.08, 0.08, 1.5, M.yellow, -40 - i * 70, 0.75, zP - 4, scene, 6);
}

// Background industrial skyline for depth
{
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 60; i++) {
    const x = rnd(-700, 700), z = rnd(260, 900);
    if (Math.abs(x) < 60 && z < 320) continue;
    const t = Math.random();
    if (t < 0.5) { const h = rnd(20, 70); cyl(rnd(1.5, 3.5), rnd(1.5, 3.5), h, M.dark, x, h / 2, z, scene, 10); redLamps.push(V(x, h + 0.5, z)); }
    else if (t < 0.8) { const r = rnd(8, 16), h = rnd(8, 15); cyl(r, r, h, std(0x30353b, 0.2, 0.8), x, h / 2, z, scene, 20); }
    else { const h = rnd(10, 25); box(rnd(10, 30), h, rnd(10, 20), std(0x23272c, 0.2, 0.8), x, h / 2, z); }
    for (let k = 0; k < 4; k++) lamp(x + rnd(-12, 12), rnd(3, 30), z + rnd(-10, 10));
  }
  // Inside-plant light poles along lane
  for (let z = -86; z < 96; z += 18) { cyl(0.1, 0.12, 9, M.dark, -7.8, 4.5, z); lamp(-7.1, 8.9, z, true); }
}

// Instanced lamps, aircraft warning lights, light pools
{
  const lg = new THREE.SphereGeometry(0.22, 8, 6);
  const im = new THREE.InstancedMesh(lg, G.warm, lamps.length);
  const rm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6), G.red, redLamps.length);
  const m4 = new THREE.Matrix4();
  lamps.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, m4); });
  redLamps.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); rm.setMatrixAt(i, m4); });
  scene.add(im, rm);
  window.__redLamps = rm;
  const poolTex = radialTex([[0, 'rgba(255,190,120,.55)'], [0.5, 'rgba(255,150,80,.18)'], [1, 'rgba(255,120,60,0)']]);
  const pm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), pools.length);
  const q = new THREE.Quaternion();
  pools.forEach((p, i) => pm.setMatrixAt(i, m4.compose(p, q, V(22, 1, 22))));
  scene.add(pm);
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
  // trailer deck (z -8..5)
  box(2.6, 0.28, 13, M.dark, 0, 1.42, -1.5, t);
  [-0.5, 0.5].forEach(x => box(0.25, 0.5, 13, M.dark, x, 1.05, -1.5, t));
  box(2.6, 1.6, 0.14, M.dark, 0, 2.35, 4.9, t);   // headboard
  // banner on headboard (rear face)
  {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const x = c.getContext('2d'); x.fillStyle = '#c8141b'; x.fillRect(0, 0, 1024, 512);
    x.fillStyle = '#fff'; x.font = 'bold 76px Inter, Arial'; x.textAlign = 'center';
    x.fillText('PALACIOS MARINE', 512, 380); x.fillText('& INDUSTRIAL', 512, 470);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const img = new Image(); img.onload = () => { x.drawImage(img, 362, 28, 300, 198); tx.needsUpdate = true; }; img.src = 'assets/pmi-logo.png';
    const bn = mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.5 }), 0, 2.45, 4.82, t);
    bn.rotation.y = Math.PI;
  }
  // stake pockets / side rails
  [-1.31, 1.31].forEach(x => box(0.04, 0.22, 13, M.steel, x, 1.45, -1.5, t));
  box(2.6, 0.18, 0.12, M.dark, 0, 1.0, -8.05, t);
  [-1.1, 1.1].forEach(x => box(0.28, 0.12, 0.06, G.tail, x, 1.05, -8.12, t));
  // pipe load: 4-3-2 + top spool (lifted later)
  const pr = 0.32, plen = 12;
  const pipeGeo = new THREE.CylinderGeometry(pr, pr, plen, 18).rotateX(Math.PI / 2);
  const capGeo = new THREE.CylinderGeometry(pr + 0.02, pr + 0.02, 0.12, 18).rotateX(Math.PI / 2);
  const makePipe = (parent, x, y, z) => {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    mesh(pipeGeo, M.steel, 0, 0, 0, g);
    [-plen / 2, plen / 2].forEach(o => mesh(capGeo, M.red, 0, 0, o, g));
    return g;
  };
  const layers = [[-0.99, -0.33, 0.33, 0.99], [-0.66, 0, 0.66], [-0.33, 0.33]];
  layers.forEach((row, li) => row.forEach(x => makePipe(t, x, 1.56 + pr + li * 0.554, -1.5)));
  [-5.6, -1.5, 2.6].forEach(z => {
    box(2.7, 0.1, 0.25, M.wood, 0, 1.6, z, t);
    box(0.04, 1.6, 0.08, M.yellow, 1.3, 2.35, z, t); box(0.04, 1.6, 0.08, M.yellow, -1.3, 2.35, z, t);
    box(1.5, 0.04, 0.08, M.yellow, 0, 3.3, z, t);
  });
  liftPipe = makePipe(scene, 0, 0, 0);

  // tractor
  box(1.1, 0.35, 10, M.dark, 0, 0.95, 7.2, t);
  box(2.5, 2.9, 1.9, M.cab, 0, 2.85, 6.3, t);                         // sleeper
  box(2.5, 2.5, 2.2, M.cab, 0, 2.75, 8.3, t);                         // cab
  box(2.2, 1.4, 2.4, M.cab, 0, 1.95, 10.6, t);                        // hood
  box(1.4, 1.3, 0.1, M.chrome, 0, 1.85, 11.84, t);                    // grille
  box(2.6, 0.38, 0.35, M.chrome, 0, 0.85, 12.0, t);                   // bumper
  box(2.3, 1.0, 0.05, M.glass, 0, 3.35, 9.42, t);                     // windshield
  [-1.26, 1.26].forEach(x => box(0.04, 0.8, 1.2, M.glass, x, 3.35, 8.6, t));
  [-1.33, 1.33].forEach(x => cyl(0.12, 0.12, 3.4, M.chrome, x, 4.0, 7.3, t, 10)); // stacks
  [-0.95, 0.95].forEach(x => box(0.38, 0.22, 0.05, G.head, x, 1.55, 11.86, t));
  for (let i = 0; i < 5; i++) box(0.16, 0.08, 0.08, G.amber, -0.6 + i * 0.3, 4.05, 9.3, t);
  [-1.15, 1.15].forEach(x => box(0.4, 0.55, 0.5, M.chrome, x, 1.2, 7.6, t)); // fuel tanks
  // fenders
  [-1.05, 1.05].forEach(x => mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.5, 16, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), M.cab, x, 0.62, 10.6, t).material.side = THREE.DoubleSide);
  // door logos
  [[1.262, Math.PI / 2], [-1.262, -Math.PI / 2]].forEach(([x, ry]) => {
    const d = mesh(new THREE.PlaneGeometry(1.35, 0.89), logoMat, x, 2.45, 8.3, t); d.rotation.y = ry;
  });
  // wheels
  const tireGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.55, 20).rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.57, 12).rotateZ(Math.PI / 2);
  [[10.6, 1.05], [4.6, 1.0], [3.3, 1.0], [-5.9, 1.0], [-7.2, 1.0]].forEach(([z, x]) => [-x, x].forEach(xx => {
    const w = new THREE.Group(); w.position.set(xx, 0.52, z); t.add(w);
    mesh(tireGeo, M.rubber, 0, 0, 0, w); mesh(hubGeo, M.chrome, 0, 0, 0, w);
    box(0.58, 0.08, 0.5, M.rubber, 0, 0, 0, w); // tread mark to show rotation
    wheels.push(w);
  }));
  const head = new THREE.SpotLight(0xfff0d8, 420, 140, 0.42, 0.55, 1.4);
  head.position.set(0, 1.6, 12.2); head.target.position.set(0, 0, 40); t.add(head, head.target);
}
const TRUCK_X = 4, TRUCK_Z0 = -700, TRUCK_Z1 = -31.5 + 1.5; // truck origin is 1.5 ahead of load centre
truck.position.set(TRUCK_X, 0, TRUCK_Z0);

/* =========================================================
   Mobile crane that sets the spool on the rack
   ========================================================= */
const crane = { group: new THREE.Group() };
const LOAD_START = V(TRUCK_X, LIFT_LOCAL.y, TRUCK_Z1 + LIFT_LOCAL.z);
const LOAD_END = V(11.2, 12.3 + 0.32, LOAD_START.z);
const CRANE_PIVOT = V(-3.6, 4.0, LOAD_START.z - 4);
{
  const g = crane.group; g.position.set(-3.6, 0, LOAD_START.z - 2); scene.add(g);
  box(2.8, 1.4, 11, M.yellow, 0, 1.4, 0, g);
  box(2.4, 2, 2, M.yellow, 0, 2.6, 4.4, g); box(2.2, 0.9, 0.05, M.glass, 0, 3.0, 5.42, g);
  [-4, -2.4, 2.4, 4].forEach(z => [-1.25, 1.25].forEach(x => mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 16).rotateZ(Math.PI / 2), M.rubber, x, 0.6, z, g)));
  [-3.8, 3.8].forEach(z => [-1, 1].forEach(s => { box(3, 0.3, 0.4, M.dark, s * 2.5, 0.8, z, g); box(0.8, 0.12, 0.8, M.wood, s * 3.9, 0.06, z, g); }));
  box(2.6, 1.3, 3.6, M.yellow, 0, 2.75, -2, g);
  box(1.0, 1.4, 1.2, M.glass, 1.2, 3, -0.7, g);
  for (let i = 0; i < 6; i++) box(0.3, 0.3, 0.02, i % 2 ? M.rubber : M.yellow, -1.31, 1.4, -5.4 + i * 0.3, g);
  crane.boom = beam(CRANE_PIVOT, V(0, 30, 0), 0.5, M.yellow);
  crane.boom2 = beam(CRANE_PIVOT, V(0, 30, 0), 0.36, std(0xe5a812, 0.35, 0.45));
  crane.cable = beam(V(0, 0, 0), V(0, 1, 0), 0.03, M.rubber);
  crane.hook = box(0.45, 0.6, 0.35, M.red, 0, 0, 0);
  crane.sl1 = beam(V(), V(0, 1, 0), 0.025, M.yellow);
  crane.sl2 = beam(V(), V(0, 1, 0), 0.025, M.yellow);
  crane.light = new THREE.PointLight(0xffd0a0, 60, 60, 1.3); scene.add(crane.light);
  crane.light.position.set(2, 14, LOAD_START.z - 6);
}
function liftPos(s) {
  const top = LOAD_END.y + 3.2;
  if (s <= 0) return LOAD_START.clone();
  if (s < 0.35) { const k = s / 0.35; return V(LOAD_START.x, THREE.MathUtils.lerp(LOAD_START.y, top, ease(k)), LOAD_START.z); }
  if (s < 0.75) { const k = (s - 0.35) / 0.4; return V(THREE.MathUtils.lerp(LOAD_START.x, LOAD_END.x, ease(k)), top, LOAD_START.z); }
  const k = Math.min(1, (s - 0.75) / 0.25); return V(LOAD_END.x, THREE.MathUtils.lerp(top, LOAD_END.y, ease(k)), LOAD_END.z);
}
function updateCrane(s, time) {
  const p = liftPos(s);
  if (s > 0) liftPipe.position.copy(p);
  const hook = p.clone().add(V(0, 2.4, 0));
  const tip = p.clone().add(V(0, 8.5 + Math.sin(time * 0.6) * 0.02, 0));
  const mid = CRANE_PIVOT.clone().lerp(tip, 0.55);
  setBeam(crane.boom, CRANE_PIVOT, mid, 0.5);
  setBeam(crane.boom2, CRANE_PIVOT, tip, 0.36);
  setBeam(crane.cable, hook, tip, 0.03);
  crane.hook.position.copy(hook);
  setBeam(crane.sl1, hook, p.clone().add(V(0, 0.3, -3.5)), 0.025);
  setBeam(crane.sl2, hook, p.clone().add(V(0, 0.3, 3.5)), 0.025);
}

/* =========================================================
   Discipline highlight rings + beams
   ========================================================= */
const HL = [
  { at: V(26, 0, -10), r: 22 },  // mechanical
  { at: V(-16, 0, 56), r: 15 },  // civil
  { at: V(34, 0, -26), r: 8 },   // soft craft
  { at: V(-30, 0, -44), r: 11 }, // cleaning
  { at: V(2, 0, 104), r: 13 },   // pipeline
  { at: V(-18, 0, -78), r: 18 }, // facility
].map(h => {
  const g = new THREE.Group(); g.position.copy(h.at); scene.add(g);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.18, 0.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const ring = mesh(new THREE.RingGeometry(h.r - 0.35, h.r, 96).rotateX(-Math.PI / 2), mat, 0, 0.12, 0, g);
  const ring2 = mesh(new THREE.RingGeometry(h.r * 0.6, h.r * 0.62, 96).rotateX(-Math.PI / 2), mat, 0, 0.12, 0, g);
  const bmat = mat.clone(); bmat.color = new THREE.Color(1.2, 0.08, 0.1);
  const disc = mesh(new THREE.CircleGeometry(h.r, 64).rotateX(-Math.PI / 2), bmat, 0, 0.1, 0, g);
  // corner ticks for a survey-marker look
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4;
    const t = mesh(new THREE.PlaneGeometry(h.r * 0.18, 0.35).rotateX(-Math.PI / 2), mat, Math.cos(a) * (h.r + 1.2), 0.13, Math.sin(a) * (h.r + 1.2), g);
    t.rotation.y = -a; }
  return { g, mat, bmat, ring, ring2, disc, w: 0 };
});
// Radial fade for the highlight disc (brighter toward the rim)
{
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,.15)'); gr.addColorStop(1, 'rgba(255,255,255,.7)');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const fadeTex = new THREE.CanvasTexture(c);
  HL.forEach(h => { h.bmat.alphaMap = fadeTex; h.bmat.needsUpdate = true; });
}

/* =========================================================
   Timeline
   ========================================================= */
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const P_ARRIVE = 0.395, P_LIFT0 = 0.425, P_LIFT1 = 0.505;

function truckZ(p) {
  const t = Math.min(1, p / P_ARRIVE);
  return THREE.MathUtils.lerp(TRUCK_Z0, TRUCK_Z1, 1 - Math.pow(1 - t, 2.2));
}

// Camera keyframes. Functions receive T (truck load centre).
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
  { p: 0.837, pos: () => V(12, 9, 130), look: () => V(-80, 0, 100) },
  { p: 0.872, pos: () => V(-30, 55, 40), look: () => V(-14, 0, -40) },
  { p: 0.905, pos: () => V(10, 10, -116), look: () => V(-20, 3, -74) },
  { p: 0.975, pos: () => V(-190, 165, -230), look: () => V(10, 0, 30) },
  { p: 1.000, pos: () => V(-200, 172, -240), look: () => V(10, 0, 30) },
];
const posCurve = new THREE.CatmullRomCurve3(K.map(() => V()), false, 'centripetal');
const lookCurve = new THREE.CatmullRomCurve3(K.map(() => V()), false, 'centripetal');

function cameraAt(p, T) {
  K.forEach((k, i) => { posCurve.points[i].copy(k.pos(T)); lookCurve.points[i].copy(k.look(T)); });
  let i = 0; while (i < K.length - 2 && p > K[i + 1].p) i++;
  const raw = (p - K[i].p) / (K[i + 1].p - K[i].p);
  const e = smooth(0.08, 0.92, raw);
  const u = (i + e) / (K.length - 1);
  return { pos: posCurve.getPoint(u), look: lookCurve.getPoint(u) };
}

/* =========================================================
   Post-processing
   ========================================================= */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / (isMobile ? 2 : 1), window.innerHeight / (isMobile ? 2 : 1)), 0.75, 0.5, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* =========================================================
   DOM / scroll / audio wiring
   ========================================================= */
const sound = new SoundEngine();
const story = document.querySelector('.story');
const panels = [...document.querySelectorAll('.panel')].map(el => ({ el, a: +el.dataset.in, b: +el.dataset.out, cap: el.dataset.cap }));
const chapters = [...document.querySelectorAll('.chapters span')];
const chapFill = document.querySelector('.chapters-fill');
const chapWrap = document.querySelector('.chapters');
const nav = document.querySelector('.nav');
const toggle = document.querySelector('.sound-toggle');
let pTarget = 0, p = 0, lastActive = -1, statsDone = false, braked = false, landed = false;

function storyProgress() {
  const max = story.offsetHeight - window.innerHeight;
  return Math.min(1, Math.max(0, window.scrollY / max));
}
window.addEventListener('scroll', () => { pTarget = storyProgress(); }, { passive: true });

function panelAlpha(pp, a, b) {
  const f = 0.014;
  const i = a <= 0 ? 1 : smooth(a, a + f, pp);
  const o = b >= 1 ? 1 : 1 - smooth(b - f, b, pp);
  return i * o;
}

function updateDOM(pp) {
  let active = -1, right = false;
  panels.forEach((pn, idx) => {
    const al = panelAlpha(pp, pn.a, pn.b);
    pn.el.style.opacity = al.toFixed(3);
    pn.el.style.visibility = al > 0.001 ? 'visible' : 'hidden';
    pn.el.classList.toggle('on', al > 0.5);
    const base = pn.el.classList.contains('panel-stats') ? 'translate(-50%,-50%)' : (window.innerWidth < 640 && !pn.el.classList.contains('panel-hero') ? '' : 'translateY(-50%)');
    if (window.innerWidth < 640 && pn.el.classList.contains('panel-stats')) pn.el.style.transform = `translateY(${(1 - al) * 24}px)`;
    else pn.el.style.transform = `${base} translateY(${(1 - al) * 24}px)`;
    if (al > 0.5) { active = idx; right = pn.el.classList.contains('panel-right'); }
  });
  document.body.classList.toggle('vig-right', right);
  if (active !== lastActive && active !== -1) { if (lastActive !== -1) sound.whoosh(); lastActive = active; }
  let c = 0; chapters.forEach((s, i) => { if (pp >= +s.dataset.at - 0.001) c = i; });
  chapters.forEach((s, i) => s.classList.toggle('on', i === c));
  chapFill.style.height = (pp * 100).toFixed(2) + '%';
  const pastStory = window.scrollY > story.offsetHeight - window.innerHeight * 0.8;
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

// UI sounds
document.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('mouseenter', () => sound.hover());
  el.addEventListener('click', () => sound.click());
});
toggle.addEventListener('click', () => {
  const on = !sound.enabled; sound.setEnabled(on); toggle.classList.toggle('on', on);
  try { localStorage.setItem('pmiSound', on ? '1' : '0'); } catch (e) {}
});
document.querySelectorAll('[data-enter]').forEach(b => b.addEventListener('click', () => {
  const on = b.dataset.enter === 'sound';
  sound.setEnabled(on); toggle.classList.toggle('on', on);
  if (on) setTimeout(() => sound.click(), 30);
  document.getElementById('loader').classList.add('done');
}));

// Locations map (approximate lon/lat projection of the Gulf Coast)
(function drawMap() {
  const svg = document.querySelector('.loc-map'); if (!svg) return;
  const pts = [
    ['Port Lavaca', -96.63, 28.61, 'hq'], ['Corpus Christi', -97.40, 27.80, 'shop'], ['Victoria', -97.00, 28.81], ['Freeport', -95.36, 28.95, 'shop'],
    ['Deer Park', -95.12, 29.70], ['Houston', -95.37, 29.76, 'shop'], ['Lake Charles', -93.22, 30.23], ['Baton Rouge', -91.15, 30.45, 'shop'], ['Mobile', -88.04, 30.69],
  ];
  const X = lon => (lon + 98.2) / (98.2 - 87.2) * 640 + 50, Y = lat => (31.1 - lat) / (31.1 - 27.3) * 340 + 40;
  let s = '<defs><pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="rgba(255,255,255,.05)"/></pattern></defs>';
  s += '<rect width="800" height="420" fill="url(#grid)"/>';
  s += `<text x="${X(-94)}" y="${Y(27.3)}" fill="rgba(255,255,255,.18)" font-family="Bebas Neue" font-size="34" letter-spacing="8">GULF OF MEXICO</text>`;
  const hq = pts[0];
  pts.slice(1).forEach(p => { s += `<line x1="${X(hq[1])}" y1="${Y(hq[2])}" x2="${X(p[1])}" y2="${Y(p[2])}" stroke="rgba(227,30,36,.35)" stroke-dasharray="3 5"/>`; });
  pts.forEach(([n, lo, la, k]) => {
    const x = X(lo), y = Y(la), up = ['Deer Park', 'Victoria', 'Lake Charles', 'Mobile', 'Baton Rouge'].includes(n);
    if (k === 'hq') s += `<circle cx="${x}" cy="${y}" r="14" fill="none" stroke="#e31e24" stroke-width="2"><animate attributeName="r" values="8;22;8" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="2.4s" repeatCount="indefinite"/></circle>`;
    if (k === 'shop' || k === 'hq') s += `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" fill="none" stroke="#fff" stroke-width="1.5" transform="rotate(45 ${x} ${y})"/>`;
    s += `<circle cx="${x}" cy="${y}" r="${k === 'hq' ? 6 : 4.5}" fill="#e31e24"/>`;
    s += `<text x="${x + 12}" y="${y + (up ? -10 : 18)}" fill="#e9ecef" font-family="Inter" font-size="${k === 'hq' ? 15 : 13}" font-weight="${k === 'hq' ? 700 : 500}">${n}</text>`;
  });
  s += `<g transform="translate(600,330)"><rect width="170" height="64" fill="none" stroke="rgba(255,255,255,.15)"/><circle cx="22" cy="32" r="4.5" fill="#e31e24"/><text x="36" y="28" fill="#e9ecef" font-family="Inter" font-size="13" font-weight="500">Clarendon, Jamaica</text><text x="36" y="46" fill="#9aa3ad" font-family="Inter" font-size="11">International</text></g>`;
  svg.innerHTML = s;
})();

/* =========================================================
   Render loop
   ========================================================= */
let last = performance.now(), elapsed = 0;
const T = V();
let prevTruckZ = TRUCK_Z0, speedSm = 0, frame = 0;
function tick() {
  requestAnimationFrame(tick);
  const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now; elapsed += dt; const time = elapsed;
  p += (pTarget - p) * Math.min(1, dt * 3.2);
  if (Math.abs(pTarget - p) < 1e-5) p = pTarget;

  updateDOM(p);
  const inStory = window.scrollY < story.offsetHeight + 50;
  if (!inStory && frame > 2) return;
  frame++;

  // Truck
  const tz = truckZ(p);
  truck.position.z = tz;
  const dz = tz - prevTruckZ; prevTruckZ = tz;
  wheels.forEach(w => { w.rotation.x += dz / 0.52; });
  const moving = p < P_ARRIVE;
  truck.position.y = moving ? Math.sin(time * 14) * 0.012 : 0;
  speedSm += (Math.min(1, Math.abs(dz) / dt / 45) - speedSm) * Math.min(1, dt * 4);
  if (p >= P_ARRIVE - 0.002 && !braked) { braked = true; sound.airBrake(); }
  if (p < P_ARRIVE - 0.02) braked = false;
  T.set(TRUCK_X, 0, tz - 1.5);

  // Gate barrier opens as truck approaches
  const open = smooth(-190, -130, tz);
  barrier.children[0].rotation.z = open * 1.45;

  // Crane lift
  const s = smooth(P_LIFT0, P_LIFT1, p);
  if (s <= 0) liftPipe.position.copy(truck.position).add(LIFT_LOCAL);
  updateCrane(s, time);
  if (s >= 0.999 && !landed) { landed = true; sound.clank(); }
  if (s < 0.95) landed = false;

  // Camera
  const c = cameraAt(p, T);
  camera.position.copy(c.pos);
  camera.position.y += Math.sin(time * 0.7) * 0.06;
  camera.lookAt(c.look);

  // Highlights
  HL.forEach((h, i) => {
    const pn = panels.find(pp => pp.cap === String(i));
    const target = pn ? panelAlpha(p, pn.a - 0.01, pn.b + 0.01) : 0;
    h.w += (target - h.w) * Math.min(1, dt * 5);
    const pulse = 0.75 + 0.25 * Math.sin(time * 3);
    h.mat.opacity = h.w * pulse; h.bmat.opacity = h.w * 0.3;
    h.ring2.scale.setScalar(0.6 + ((time * 0.35) % 1) * 0.7);
    h.g.visible = h.w > 0.01;
  });

  // Flare flicker, red lamps blink
  const fl = 1 + Math.sin(time * 9) * 0.06 + Math.sin(time * 23) * 0.04 + (Math.random() - 0.5) * 0.06;
  flame.scale.set(10 * fl, 18 * (2 - fl), 1);
  flame.position.x = FLARE.x + Math.sin(time * 1.3) * 0.6;
  flameLight.intensity = 180 * fl;
  G.red.color.setRGB(6 * (0.35 + 0.65 * (Math.sin(time * 2.4) > 0 ? 1 : 0.15)), 0.4, 0.3);

  // Hydroblast spray
  {
    const d = SHELL.clone().sub(NOZZLE);
    for (let i = 0; i < spray.n; i++) {
      const k = (spray.seed[i] + time * 1.4) % 1;
      const sp = 0.06 + k * 0.5;
      const j = i * 3, r1 = Math.sin(i * 12.9898) * 0.5, r2 = Math.sin(i * 78.233) * 0.5;
      if (k < 0.75) {
        spray.pos[j] = NOZZLE.x + d.x * (k / 0.75); spray.pos[j + 1] = NOZZLE.y + d.y * (k / 0.75) + r1 * sp * 0.4; spray.pos[j + 2] = NOZZLE.z + d.z * (k / 0.75) + r2 * sp * 0.4;
      } else {
        const m = (k - 0.75) / 0.25;
        spray.pos[j] = SHELL.x + 0.2 + m * 1.6 * (0.6 + r1); spray.pos[j + 1] = SHELL.y + r2 * 3 * m - m * m * 1.2; spray.pos[j + 2] = SHELL.z + r1 * 4 * m;
      }
    }
    spray.pts.geometry.attributes.position.needsUpdate = true;
  }

  // Audio coupling
  sound.update({
    truckSpeed: moving ? 0.15 + speedSm : 0,
    truckNear: Math.max(0, 1 - camera.position.distanceTo(T) / 90),
    winch: s > 0 && s < 0.999 ? Math.min(1, Math.abs(pTarget - p) * 80 + 0.3) : 0,
    flare: Math.max(0, 1 - camera.position.distanceTo(FLARE) / 220),
    plant: smooth(0.33, 0.5, p),
  });

  composer.render();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

pTarget = p = storyProgress();
renderer.compile(scene, camera);
tick();
document.getElementById('loader').classList.add('ready');
window.__pmi = { setP: v => { pTarget = p = v; }, scene, camera };
