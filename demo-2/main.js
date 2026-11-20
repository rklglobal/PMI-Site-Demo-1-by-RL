import * as THREE from 'three';
import { Snd } from './audio.js?v=10';
import { buildAll, CITIES } from './models.js?v=10';

/* =========================================================
   Content (copy from the PMI 2026 brochure)
   ========================================================= */
const IC = {
  intro: 'M9 3h6v15H9zM7 21h10M9 8h6M9 13h6', mech: 'M3 16h7a3 3 0 0 0 3-3V8a3 3 0 0 1 3-3h5M3 13v6M21 2v6', civil: 'M3 20h18M5 20v-3h9v3M8 17v-4h4l2-6 5 3-2 3M17 13l2 4',
  soft: 'M5 3v18M19 3v18M5 8h14M5 15h14M5 15l14-7', clean: 'M2 17h13V9H5l-3 4zM15 17h6v-5l-3-3h-3M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', pipe: 'M3 13v6M21 13v6M3 16h5l4-2 4 2h5M12 14V7M8 7h8',
  fac: 'M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5M9 11h.01M15 11h.01', loc: 'M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01', star: 'M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z', mail: 'M3 6h18v12H3zM3 7l9 6 9-6', shop: 'M4 21V9l8-5 8 5v12M4 13h16M10 21v-5h4v5',
};
const svg = d => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const list = a => `<ul>${a.map(x => `<li>${x}</li>`).join('')}</ul>`;
const head = (eyebrow, title) => `<p class="eyebrow">${eyebrow}</p><h3>${title}</h3>`;
// line diagram that draws itself: icon -> branches -> one box per item
function diagram(icon, items) {
  const rh = 62, H = Math.max(items.length * rh, 150), mid = H / 2; let s = `<svg class="dia" viewBox="0 0 640 ${H}" style="max-width:640px">`;
  s += `<g transform="translate(18 ${mid - 30}) scale(2.5)"><path class="ic" style="--i:0" d="${icon}"/></g>`;
  items.forEach((t, i) => { const y = rh * i + rh / 2; s += `<path style="--i:${i + 1}" pathLength="1" d="M92 ${mid}H130a12 12 0 0 ${y < mid ? 0 : 1} 12 ${y < mid ? -12 : 12}V${y < mid ? y + 12 : y - 12}a12 12 0 0 ${y < mid ? 1 : 0} 12 ${y < mid ? -12 : 12}H190"/><rect style="--i:${i + 1}" x="190" y="${y - 22}" width="430" height="44" rx="6"/><text style="--i:${i + 1}" x="208" y="${y + 5}">${t}</text>`; });
  return s + '</svg>';
}
const svc = (n, name, icon, items, big) => head(`${n} / 06 · Self-performed`, name) + diagram(icon, items) + `<div class="cols"><div class="big"><b>${items.length}</b><span>${name.toLowerCase()} services self-performed by PMI crews</span><b>${big[0]}</b><span>${big[1]}</span></div><div><p>PMI supports maintenance, turnarounds, capital projects, and specialty work through a coordinated self-perform approach.</p><p>Executing multiple disciplines under one team reduces contractor interfaces, improves schedule control, and delivers consistent project execution.</p></div></div>`;
const val = (eyebrow, title, text) => head(eyebrow, title) + `<p>${text}</p>`;

const TOPICS = [
  { key: 'intro', eyebrow: 'Turnkey industrial contractor · Since 2003', title: 'Reducing complexity. <span>Delivering results.</span>', lead: 'One contractor. Turnkey execution. Fewer handoffs.', name: 'Why PMI', rot: 0.5, hot: [
    { label: 'Why choose PMI', icon: IC.star, html: head('Why choose PMI', 'Every scope, working together') + `<p>The success of a project depends on how well every scope works together. PMI delivers coordinated, accountable, multi-discipline execution that reduces gaps between scopes and keeps work moving safely and efficiently.</p>` + diagram(IC.intro, ['One contractor, multiple scopes', 'Field-to-leadership alignment', 'Built to keep work moving', 'Execution that adapts']) + `<div class="cols"><div class="big"><b>6</b><span>disciplines under one team</span><b>29</b><span>self-performed services</span><b>2003</b><span>founded in Port Lavaca, Texas</span></div><div><p>Palacios Marine &amp; Industrial is a privately owned turnkey industrial contractor and Certified Minority Business Enterprise (MBE) delivering construction, maintenance, turnaround, and specialty services.</p><p>By integrating multiple disciplines under one team, PMI helps clients simplify project delivery, reduce contractor interfaces, and maintain operational continuity.</p></div></div>` },
    { label: 'PMI advantage', icon: IC.list, html: head('PMI advantage', 'Construction · Maintenance · Turnarounds') + `<p>PMI simplifies project delivery through a self-perform approach that reduces complexity, improves coordination, and helps keep projects on schedule.</p>` + diagram(IC.star, ['Eliminate handoffs that delay your project', 'Minimize disruption to operations', 'Take back control of your project schedule', 'Clear accountability at every stage']) },
    { label: 'Industries served', icon: IC.fac, html: head('Industries served', 'Where we work') + `<div class="pics">${[['petrochemical', 'Petrochemical'], ['refining', 'Refining'], ['midstream', 'Midstream'], ['food', 'Food &amp; Beverage'], ['mining', 'Mining &amp; Smelting'], ['power', 'Power Generation'], ['pulp', 'Pulp &amp; Paper'], ['datacenter', 'Mission Critical &amp; Data Centers']].map(([f, n]) => `<figure><img loading="lazy" src="../assets/ind-${f}.jpg" alt=""><figcaption>${n}</figcaption></figure>`).join('')}</div>` },
  ] },
  { key: 'mech', eyebrow: '<b>01</b> / 06 · Self-performed', title: 'Mechanical', items: ['Piping Systems Installation', 'Equipment Setting and Alignment', 'ASME “U” and “S” Code Work', 'NBIC “R” Stamp Repair', 'Structural Steel Erection'], name: 'Mechanical', rot: 0.5, hot: [
    { label: 'Mechanical services', icon: IC.list, html: svc('01', 'Mechanical', IC.mech, ['Piping Systems Installation', 'Equipment Setting and Alignment', 'ASME “U” and “S” Code Work', 'NBIC “R” Stamp Repair', 'Structural Steel Erection'], ['U · S · R', 'ASME and NBIC code stamps held']) },
    { label: 'Fab &amp; shop support', icon: IC.shop, html: head('Fabrication &amp; shop support', 'From our shops to your pipe rack') + diagram(IC.shop, ['Corpus Christi', 'Port Lavaca', 'Freeport', 'Houston', 'Baton Rouge']) + `<p>By self-performing critical scopes with our own workforce, PMI helps reduce subcontractor dependency and maintain greater control over project timelines.</p>` },
  ] },
  { key: 'civil', eyebrow: '<b>02</b> / 06 · Self-performed', title: 'Civil', items: ['Site Preparation and Earthwork', 'Concrete Foundations', 'Equipment Pads and Structural Foundations', 'Underground Utilities', 'Drainage and Erosion Control'], name: 'Civil', rot: 0.45, hot: [
    { label: 'Civil services', icon: IC.list, html: svc('02', 'Civil', IC.civil, ['Site Preparation and Earthwork', 'Concrete Foundations', 'Equipment Pads and Structural Foundations', 'Underground Utilities', 'Drainage and Erosion Control'], ['1', 'contractor from the ground up']) },
    { label: 'One contractor', icon: IC.star, html: val('One contractor, multiple scopes', 'Fewer handoffs', 'Simplify project delivery through one team managing civil, mechanical, soft craft, pipeline, and facility services, reducing handoff delays and improving coordination.') },
  ] },
  { key: 'soft', eyebrow: '<b>03</b> / 06 · Self-performed', title: 'Soft Craft', items: ['Scaffold Design and Access', 'Insulation Systems', 'Industrial Coatings', 'Fireproofing Applications', 'Abatement'], name: 'Soft Craft', rot: 0.6, hot: [
    { label: 'Soft craft services', icon: IC.list, html: svc('03', 'Soft Craft', IC.soft, ['Scaffold Design and Access', 'Insulation Systems', 'Industrial Coatings', 'Fireproofing Applications', 'Abatement'], ['1', 'team from access to final coat']) },
    { label: 'Keep work moving', icon: IC.star, html: val('Built to keep work moving', 'Real-time response', 'Coordinated teams respond to challenges in real time, reducing delays, improving accountability, and maintaining project momentum.') },
  ] },
  { key: 'clean', eyebrow: '<b>04</b> / 06 · Self-performed', title: 'Industrial Cleaning', items: ['Hydroblasting', 'Tank Cleaning', 'Hydro Excavation', 'Vacuum Services', 'Line Cleaning'], name: 'Industrial Cleaning', rot: -0.45, hot: [
    { label: 'Cleaning services', icon: IC.list, html: svc('04', 'Industrial Cleaning', IC.clean, ['Hydroblasting', 'Tank Cleaning', 'Hydro Excavation', 'Vacuum Services', 'Line Cleaning'], ['1', 'call for cleaning and the work that follows']) },
    { label: 'Minimize disruption', icon: IC.star, html: val('Minimize disruption to operations', 'Planned around your site', 'Work is planned around site conditions and production requirements to help minimize disruption and support ongoing operations.') },
  ] },
  { key: 'pipe', eyebrow: '<b>05</b> / 06 · Self-performed', title: 'Pipeline', items: ['Pipeline Construction', 'Compressor, Metering, and Pump Stations', 'Pipeline Repair and Replacement', 'Integrity and Coating Services', 'Right-of-Way Maintenance'], name: 'Pipeline', rot: 0.5, hot: [
    { label: 'Pipeline services', icon: IC.list, html: svc('05', 'Pipeline', IC.pipe, ['Pipeline Construction', 'Compressor, Metering, and Pump Stations', 'Pipeline Repair and Replacement', 'Integrity and Coating Services', 'Right-of-Way Maintenance'], ['1', 'team from right-of-way to station']) },
    { label: 'Execution that adapts', icon: IC.star, html: val('Execution that adapts', 'Real-world conditions', 'Keep work progressing across maintenance, turnarounds, capital projects, startups, and decommissioning activities with execution that adapts to real-world conditions.') },
  ] },
  { key: 'fac', eyebrow: '<b>06</b> / 06 · Self-performed', title: 'Facility Services', items: ['Routine Facility Maintenance', 'Janitorial and Site Services', 'Grounds and Exterior Maintenance', 'Security Services'], name: 'Facility Services', rot: -0.4, hot: [
    { label: 'Facility services', icon: IC.list, html: svc('06', 'Facility Services', IC.fac, ['Routine Facility Maintenance', 'Janitorial and Site Services', 'Grounds and Exterior Maintenance', 'Security Services'], ['24/7', 'site needs handled by one contractor']).replace('<b>24/7</b><span>site needs handled by one contractor</span>', '') },
    { label: 'Our values', icon: IC.star, html: head('Core values', 'People. Grit. Integrity.') + diagram(IC.star, ['People: a people-first culture', 'Grit: dependable results', 'Integrity: accountability and follow-through']) + `<p>PMI strives to be our customers’ greatest asset by providing exceptional service through unrivaled responsiveness, reliability, and accountability, while maintaining a safety conscience workforce.</p>` },
  ] },
  { key: 'loc', eyebrow: 'Locations', title: 'Gulf Coast <span>and beyond</span>', items: ['Texas', 'Louisiana', 'Alabama', 'Clarendon, Jamaica'], name: 'Locations', rot: 0, flat: true, hot: [
    { label: 'All locations', icon: IC.loc, html: head('Locations', 'Gulf Coast and beyond') + diagram(IC.loc, ['Corporate Office: Port Lavaca, Texas', 'Texas: Corpus Christi · Victoria · Freeport · Deer Park · Houston', 'Louisiana: Lake Charles · Baton Rouge', 'Alabama: Mobile', 'International: Clarendon, Jamaica']) },
    { label: 'Contact PMI', icon: IC.mail, html: head('Let’s discuss', 'Your next project') + `<p>Planning an upcoming maintenance event, turnaround, capital project, or specialty service scope? Connect with PMI to discuss your project goals and execution requirements.</p>` + list(['888.744.9699', 'bids@palaciosmarineindustrial.com', '2392 State Highway 35 N, Port Lavaca, TX 77979']) + `<a class="cta" href="mailto:bids@palaciosmarineindustrial.com">Request a bid</a>` },
    { label: 'Jamaica', icon: IC.loc, html: val('International', 'Clarendon, Jamaica', 'PMI supports clients beyond the Gulf Coast with an international location in Clarendon, Jamaica.') },
  ] },
];

/* =========================================================
   Renderer + particles
   ========================================================= */
const canvas = document.getElementById('scene');
const mobile = window.innerWidth < 760;
const N = mobile ? 110000 : 240000;
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio, 2); renderer.setPixelRatio(DPR);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100); camera.position.z = 7.2;
const group = new THREE.Group(), spin = new THREE.Group(); group.add(spin); scene.add(group);

const SH = buildAll(N);
const RING = new Float32Array(N * 3), RT = new Float32Array(N);
for (let i = 0; i < N; i++) { const k = 1 + (i % 6), a = (k - 1) / 6 * Math.PI * 2 + 0.52, s = SH[k], j = i * 3; RING[j] = s.pos[j] * 0.3 + Math.cos(a) * 2.9; RING[j + 1] = s.pos[j + 1] * 0.3 + Math.sin(a) * 1.55; RING[j + 2] = s.pos[j + 2] * 0.3; RT[i] = s.tint[i]; }

const R = Math.random, geo = new THREE.BufferGeometry();
const scatter = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) scatter[i] = (R() - 0.5) * 16;
const rnd = new Float32Array(N * 4); for (let i = 0; i < N * 4; i++) rnd[i] = R();
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
geo.setAttribute('aFrom', new THREE.BufferAttribute(scatter, 3));
geo.setAttribute('aTo', new THREE.BufferAttribute(RING.slice(), 3));
geo.setAttribute('aT0', new THREE.BufferAttribute(new Float32Array(N), 1));
geo.setAttribute('aT1', new THREE.BufferAttribute(RT.slice(), 1));
geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
const U = { uT: { value: 0 }, uTime: { value: 0 }, uPix: { value: 1 }, uMouse: { value: new THREE.Vector2(9, 9) }, uAspect: { value: 1 }, uSize: { value: 0.0085 }, uScale: { value: 1 }, uMin: { value: DPR * 0.8 } };
const mat = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false,
  vertexShader: `
    attribute vec3 aFrom, aTo; attribute vec4 aRnd; attribute float aT0, aT1;
    uniform float uT, uTime, uPix, uAspect, uSize, uScale, uMin; uniform vec2 uMouse; varying float vA; varying float vTint;
    void main(){
      float t = clamp(uT * 1.8 - aRnd.x * 0.8, 0.0, 1.0);
      float e = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
      vec3 p = mix(aFrom, aTo, e);
      float burst = sin(3.14159 * e);
      // in flight: swirl around the axis and stream across as a ribbon before settling
      float ang = burst * (0.6 + aRnd.y) * 1.6; float c = cos(ang), s = sin(ang);
      p.xz = mat2(c, -s, s, c) * p.xz;
      p += burst * vec3((aRnd.w - 0.35) * 3.2, sin(aRnd.y * 6.283 + uTime) * 0.5 + (aRnd.z - 0.5) * 1.2, (aRnd.y - 0.5) * 2.0);
      // a few loose particles orbit the object as a dust ring
      float loose = step(0.965, aRnd.w);
      float oa = uTime * (0.08 + aRnd.x * 0.12) + aRnd.y * 6.283, orad = 2.1 + aRnd.z * 1.2;
      vec3 orb = vec3(cos(oa) * orad, sin(oa * 0.7 + aRnd.x * 6.0) * 0.5 + (aRnd.z - 0.5) * 1.4, sin(oa) * orad * 0.8);
      p = mix(p, orb, loose * (1.0 - burst * 0.5));
      p += 0.0025 * vec3(sin(uTime * 1.3 + aRnd.x * 40.0), cos(uTime * 1.1 + aRnd.y * 40.0), sin(uTime * 0.9 + aRnd.z * 40.0));
      vTint = mix(aT0, aT1, e) * (1.0 - loose);
      p += min(vTint, 1.0) * 0.008 * vec3(sin(uTime * 9.0 + aRnd.x * 50.0), cos(uTime * 8.0 + aRnd.y * 50.0), sin(uTime * 7.0 + aRnd.z * 50.0));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      vec2 d = (gl_Position.xy / gl_Position.w - uMouse) * vec2(uAspect, 1.0);
      float f = smoothstep(0.11, 0.0, length(d));
      gl_Position.xy += normalize(d + 1e-5) / vec2(uAspect, 1.0) * f * 0.045 * gl_Position.w;
      float sz = uSize * uScale * (0.6 + aRnd.z * 0.9) * (1.0 + burst * 0.5 + min(vTint, 1.0) * 0.3 + max(vTint - 1.0, 0.0) * (0.6 + 0.5 * sin(uTime * 30.0 + aRnd.x * 60.0))) * uPix / -mv.z;
      gl_PointSize = max(sz, uMin);
      float depth = clamp((-mv.z - 5.4) / 3.6, 0.0, 1.0);
      vA = (0.75 + 0.25 * aRnd.x) * mix(1.0, 0.22, depth * depth) * (1.0 - loose * 0.4) * min(1.0, sz / uMin + 0.35);
    }`,
  fragmentShader: `varying float vA; varying float vTint; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.38, d); vec3 col = mix(mix(vec3(0.07, 0.075, 0.09), vec3(0.89, 0.12, 0.14), clamp(vTint, 0.0, 1.0)), vec3(0.1, 0.45, 0.95), clamp(vTint - 1.0, 0.0, 1.0)); gl_FragColor = vec4(col, a * min(1.0, vA * 0.92 + min(vTint, 1.0) * 0.4)); }`,
});
const cloud = new THREE.Points(geo, mat); cloud.frustumCulled = false; spin.add(cloud);

// ambient dust and soft bokeh drifting through the frame
const DN = mobile ? 420 : 900, dgeo = new THREE.BufferGeometry(), dp = new Float32Array(DN * 3), dr = new Float32Array(DN * 3);
for (let i = 0; i < DN; i++) { dp[i * 3] = (R() - 0.5) * 22; dp[i * 3 + 1] = (R() - 0.5) * 12; dp[i * 3 + 2] = (R() - 0.5) * 12; dr[i * 3] = R(); dr[i * 3 + 1] = R(); dr[i * 3 + 2] = R(); }
dgeo.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dgeo.setAttribute('aR', new THREE.BufferAttribute(dr, 3));
const DU = { uTime: { value: 0 }, uPix: { value: 1 }, uRush: { value: 0 } };
const dust = new THREE.Points(dgeo, new THREE.ShaderMaterial({
  uniforms: DU, transparent: true, depthWrite: false,
  vertexShader: `attribute vec3 aR; uniform float uTime, uPix, uRush; varying float vA; varying float vB; varying float vC;
    void main(){ vec3 p = position; p.x = mod(p.x + uTime * (0.06 + aR.x * 0.2) + uRush * (2.0 + aR.y * 6.0) + 11.0, 22.0) - 11.0; p.y += sin(uTime * 0.25 + aR.y * 20.0) * 0.4 + p.x * 0.14;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      vB = step(0.8, aR.z); vC = aR.y; gl_PointSize = (vB > 0.5 ? 0.3 + aR.x * 0.3 : 0.022 + aR.z * 0.035) * uPix / -mv.z; vA = vB > 0.5 ? 0.09 : 0.35 + aR.x * 0.5; }`,
  fragmentShader: `varying float vA; varying float vB; varying float vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = vB > 0.5 ? smoothstep(0.5, 0.28, d) : smoothstep(0.5, 0.2, d); vec3 col = vB > 0.5 ? vec3(0.55, 0.6, 0.66) : mix(vec3(0.35, 0.38, 0.42), vec3(0.89, 0.12, 0.14), step(0.78, vC)); gl_FragColor = vec4(col, a * vA * 0.8); }`,
}));
dust.frustumCulled = false; scene.add(dust);

/* =========================================================
   UI: overview (one icon + name pill) -> detail (title, hotspots, Close pill) -> content panel
   ========================================================= */
const snd = new Snd();
const $ = s => document.querySelector(s);
const copy = $('.copy'), rail = $('.rail'), hots = $('.hotspots'), pins = $('.pins'), title = $('.topic-title'), pill = $('.next'), cardEl = $('.card'), cardBody = $('.card-body'), allEl = $('.all');
let cur = -1, mode = 'intro', morph = { t0: 0, dur: 1, on: false }, hotEls = [], pinEls = [], lock = 0, zoom = 1;

TOPICS.forEach((t, i) => {
  const b = document.createElement('button'); b.innerHTML = svg(IC[t.key]) + `<span>${t.name}</span>`; b.onclick = () => go(i); rail.appendChild(b);
  const g = document.createElement('button'); g.innerHTML = svg(IC[t.key]) + `<span>${t.name}</span>`; g.onclick = () => { closeAll(); go(i); }; $('.all-grid').appendChild(g);
});

function setTarget(s, dur) {
  const a = geo.attributes; a.aFrom.array.set(a.aTo.array); a.aTo.array.set(s.pos); a.aT0.array.set(a.aT1.array); a.aT1.array.set(s.tint);
  a.aFrom.needsUpdate = a.aTo.needsUpdate = a.aT0.needsUpdate = a.aT1.needsUpdate = true;
  U.uT.value = 0; morph = { t0: performance.now(), dur: dur * 1000, on: true };
}
function wire(el) { el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') snd.hover(); }); el.addEventListener('pointerdown', () => snd.click()); return el; }
function hotspot(icon, label, at, fn) { const el = wire(document.createElement('button')); el.className = 'hot'; el.innerHTML = `<b>${svg(icon)}</b>${label ? `<span>${label}</span>` : ''}`; el.onclick = fn; hots.appendChild(el); const h = { el, at: new THREE.Vector3(...at) }; hotEls.push(h); return h; }
function showHots() { hotEls.forEach((h, k) => setTimeout(() => h.el.classList.add('show'), 150 + k * 170)); }
function layout() { area();      // (re)build hotspots for the current mode
  hots.innerHTML = ''; pins.innerHTML = ''; hotEls = []; pinEls = [];
  const t = TOPICS[cur], s = SH[cur];
  if (mode === 'over') hotspot(IC[t.key], '', s.hot.enter, enter);
  else { t.hot.forEach((h, k) => hotspot(h.icon, h.label, s.hot['abc'[k]], () => openCard(h.html)));
    if (t.flat) CITIES.forEach(([n, lo, la], k) => { if (k === 9) return; const el = document.createElement('div'); el.className = 'pin'; el.textContent = n; pins.appendChild(el); const c = SH[7].hot; pinEls.push({ el, at: new THREE.Vector3((lo + 92) * 0.19 * 0.98 - (0.5 * 0.19 * 0.98), ((la - 27.2) * 0.19 * 1.13 + 0.6 * 0.19 * 1.13) * 0.98, 0.1) }); setTimeout(() => el.classList.add('show'), 500 + k * 90); }); }
  pill.querySelector('span').textContent = mode === 'over' ? 'Explore ' + t.name : 'Close';
  pill.classList.toggle('x', mode === 'detail');
  document.body.classList.toggle('detail', mode === 'detail');
}
function go(i) {
  if (mode === 'intro' || performance.now() < lock) return;
  i = (i + TOPICS.length) % TOPICS.length; if (i === cur && mode === 'over') return;
  const same = i === cur; lock = performance.now() + 900; cur = i; mode = 'over'; closeCard(true);
  if (!same) { snd.morph(); setTarget(SH[i], 2.5); }
  title.textContent = TOPICS[i].name;
  if (!same) { copy.classList.add('swap'); setTimeout(() => { if (cur !== i) return; const t = TOPICS[i]; copy.querySelector('.eyebrow').innerHTML = t.eyebrow; copy.querySelector('h1').innerHTML = t.title; copy.querySelector('.lead').textContent = t.lead || ''; copy.querySelector('ul').innerHTML = (t.items || []).map(x => `<li>${x}</li>`).join(''); copy.classList.remove('swap'); }, 650); }
  [...rail.children].forEach((b, k) => b.classList.toggle('on', k === i)); [...$('.all-grid').children].forEach((b, k) => b.classList.toggle('on', k === i));
  layout(); setTimeout(() => { if (cur === i && mode === 'over') showHots(); }, same ? 0 : 1700);
}
function enter() { if (mode !== 'over') return; mode = 'detail'; snd.open(); layout(); showHots(); }
function leave() { if (mode !== 'detail') return; mode = 'over'; closeCard(true); snd.close(); layout(); showHots(); }
function openCard(html) { cardBody.innerHTML = html; cardBody.scrollTop = 0; cardEl.classList.add('open'); snd.open(); }
function closeCard(quiet) { if (!cardEl.classList.contains('open')) return; cardEl.classList.remove('open'); if (!quiet) snd.close(); }
function closeAll() { allEl.classList.remove('open'); }
document.querySelectorAll('button, a').forEach(wire);

$('.start').onclick = () => { snd.start(); mode = 'over'; $('.intro').classList.add('gone'); document.body.classList.add('live'); lock = 0; cur = -1; go(0); };
pill.onclick = () => mode === 'detail' ? leave() : enter();
$('.card .card-x').onclick = () => closeCard();
$('.all-btn').onclick = () => { closeCard(true); allEl.classList.add('open'); snd.open(); };
$('.all-x').onclick = () => { closeAll(); snd.close(); };
$('.snd').onclick = e => { const on = !snd.on; snd.set(on); e.currentTarget.classList.toggle('off', !on); };
$('.logo').onclick = e => { e.preventDefault(); go(0); };

let lastWheel = 0, ty = null;
const blocked = () => cardEl.classList.contains('open') || allEl.classList.contains('open');
window.addEventListener('wheel', e => { if (blocked()) return; const now = performance.now(), fresh = now - lastWheel > 200; lastWheel = now; if (fresh && Math.abs(e.deltaY) > 4) go(cur + Math.sign(e.deltaY)); }, { passive: true });
window.addEventListener('touchstart', e => { ty = e.touches[0].clientY; }, { passive: true });
window.addEventListener('touchend', e => { U.uMouse.value.set(9, 9); if (ty === null || blocked()) return; const dy = ty - e.changedTouches[0].clientY; ty = null; if (Math.abs(dy) > 45) go(cur + Math.sign(dy)); }, { passive: true });
window.addEventListener('keydown', e => { if (e.key === 'Escape') { if (blocked()) { closeCard(); closeAll(); } else leave(); return; } if (blocked()) return; if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) go(cur + 1); if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) go(cur - 1); if (e.key === 'Enter') mode === 'detail' ? leave() : enter(); });

const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', e => { mouse.tx = e.clientX / innerWidth * 2 - 1; mouse.ty = -(e.clientY / innerHeight * 2 - 1); if (e.pointerType === 'mouse') U.uMouse.value.set(mouse.tx, mouse.ty); });
document.addEventListener('pointerleave', () => U.uMouse.value.set(9, 9));

let ang = 0, tick = 0;
const view = { x: 0, y: 0, s: 0.8, tx: 0, ty: 0, ts: 0.8, w: 1, h: 1 };
function fit() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  U.uAspect.value = w / h; U.uPix.value = DU.uPix.value = h * DPR / (2 * Math.tan(camera.fov * Math.PI / 360)); area();
}
// free screen area for the model: between the header, the text block, the rail and the bottom button
function area() {
  const w = innerWidth, h = innerHeight, narrow = w <= 900, detail = mode === 'detail', navB = $('.nav').getBoundingClientRect().bottom, pillT = pill.getBoundingClientRect().top || h - 80;
  let l = 0, r = w, t = navB + 8, b = h;
  if (mode !== 'intro') {
    const c = copy.getBoundingClientRect();
    if (narrow) b = (detail ? pillT : Math.min(c.top, pillT)) - 8;
    else { l = c.right + 10; r = (rail.getBoundingClientRect().left || w) - 16; b = pillT - 10; }
  }
  const ppu = (h / 2) / (Math.tan(camera.fov * Math.PI / 360) * camera.position.z);
  view.w = r - l; view.h = b - t; view.tx = (l + r) / 2 - w / 2; view.ty = (t + b) / 2 - h / 2;
  view.ts = mode === 'intro' ? Math.min(0.9, w / h * 1.1) : Math.min(1.15, view.w / (4.5 * ppu), view.h / (3.15 * ppu));
}
window.addEventListener('resize', fit); fit();

const v = new THREE.Vector3(); let t0 = performance.now(), el = 0, rush = 0;
function place(h, ox, oy, clamp) { v.copy(h.at).applyMatrix4(spin.matrixWorld).project(camera); let x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight; if (clamp) { const mx = Math.min(70, innerWidth * 0.16); x = Math.min(innerWidth - mx, Math.max(mx, x)); y = Math.min(innerHeight - 150, Math.max(130, y)); } h.el.style.transform = `translate(${(x - ox).toFixed(1)}px, ${(y - oy).toFixed(1)}px)`; }
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = Math.min(0.05, (now - t0) / 1000); t0 = now; el += dt;
  U.uTime.value = DU.uTime.value = el;
  let k = 1; if (morph.on) { k = Math.min(1, (now - morph.t0) / morph.dur); U.uT.value = k; if (k >= 1) morph.on = false; }
  rush += Math.sin(Math.PI * Math.max(0, k)) * dt * 0.9; DU.uRush.value = rush;
  mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
  const t = TOPICS[Math.max(0, cur)], detail = mode === 'detail', flat = mode !== 'intro' && t.flat, narrow = innerWidth <= 900;
  if (tick++ % 12 === 0) area();
  // the model stays at the origin, dead on the optical axis, and turns about its vertical axis like a turntable;
  // the lens is shifted to place it in the free area, so the pivot never skews
  view.x += (view.tx - view.x) * 0.06; view.y += (view.ty - view.y) * 0.06; view.s += (view.ts - view.s) * 0.06;
  camera.setViewOffset(innerWidth, innerHeight, -view.x, -view.y, innerWidth, innerHeight);
  const fly = mode === 'over' && !flat;
  zoom += ((detail && !narrow ? 1.12 : 1) - zoom) * 0.05;
  const sc = view.s * zoom; group.scale.setScalar(sc); U.uScale.value = sc;
  if (fly) ang += dt * 0.17;
  else { const home = mode === 'intro' ? 0 : t.rot + Math.sin(el * 0.2) * (flat ? 0.08 : 0.16); ang += (home + Math.PI * 2 * Math.round((ang - home) / (Math.PI * 2)) - ang) * 0.05; }
  group.rotation.set(mode === 'intro' ? 0.1 : flat ? -0.5 : 0.36, 0, 0);
  spin.rotation.y = ang;
  group.updateMatrixWorld();
  hotEls.forEach(h => { if (mode === 'over') h.el.style.transform = `translate(${(innerWidth / 2 + view.tx + Math.min(view.w * 0.36, 300) - 23).toFixed(1)}px, ${(innerHeight / 2 + view.ty - view.h * 0.36 - 23).toFixed(1)}px)`; else place(h, 23, 23, true); }); pinEls.forEach(h => place(h, 0, 8));
  renderer.render(scene, camera);
}
morph = { t0: performance.now() + 500, dur: 3200, on: true };
frame();
setTimeout(() => document.getElementById('loader').classList.add('done'), 1300);
window.__d2 = { go, enter, leave, snd };
