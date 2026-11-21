import * as THREE from 'three';
import { Snd } from './audio.js?v=25';
import { buildAll, CITIES } from './models.js?v=31';

/* =========================================================
   Content (copy from the PMI 2026 brochure)
   ========================================================= */
const IC = {
  intro: 'M9 3h6v15H9zM7 21h10M9 8h6M9 13h6', mech: 'M3 16h7a3 3 0 0 0 3-3V8a3 3 0 0 1 3-3h5M3 13v6M21 2v6', civil: 'M3 20h18M5 20v-3h9v3M8 17v-4h4l2-6 5 3-2 3M17 13l2 4',
  soft: 'M5 3v18M19 3v18M5 8h14M5 15h14M5 15l14-7', clean: 'M2 17h13V9H5l-3 4zM15 17h6v-5l-3-3h-3M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', pipe: 'M3 13v6M21 13v6M3 16h5l4-2 4 2h5M12 14V7M8 7h8',
  fac: 'M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5M9 11h.01M15 11h.01', loc: 'M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  safe: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5', qual: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 13.5L7 22l5-3 5 3-1.5-8.5M9.5 9l2 2 3.5-3.5',
  exp: 'M4 21h8M6 21V5l12 3M6 5l4 3H6M18 8v5M16 13h4v3h-4zM8 21v-3h2v3', jobs: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M18 21v-1a6 6 0 0 0-3-5.2',
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
// grouped lists in chamfered boxes (services by contract type, safety program, welding)
const groups = g => `<div class="svcgrid">${g.map(([h, a]) => `<div><h4>${h}</h4>${list(a)}</div>`).join('')}</div>`;
const SERVICES = [
  ['Construction', ['Small &amp; large capital', 'Procurement', 'Heavy civil', 'Piping &amp; vessel fabrication', 'Piping system installation', 'Structural steel erection', 'Equipment setting', 'Scaffolding', 'Insulation', 'Blasting &amp; painting', 'Fireproofing']],
  ['Maintenance', ['Planning &amp; scheduling', 'Craft workforce', 'Mechanical', 'Warehouse', 'Administrative', 'Scaffolding', 'Blasting &amp; painting', 'Insulation', 'Heat exchanger repairs &amp; retubes', 'Code vessel repairs &amp; alterations', 'Fireproofing']],
  ['Fabrication', ['Pipe fabrication', 'ASME code vessel fabrication', 'Skid fabrication', 'Module fabrication', 'Shop-applied paint &amp; linings', 'Insulation', 'Fireproofing']],
  ['Shutdowns / Turnarounds', ['General mechanical execution', 'Planning &amp; scheduling', 'Subcontract management', 'Scaffolding', 'Blasting &amp; painting', 'Insulation', 'Heat exchanger repairs &amp; retubes', 'Code vessel repairs &amp; alterations', 'Fireproofing']],
  ['Terminal services', ['Tank repair', 'Tank cleaning', 'Tank foundations', 'Bottom replacement &amp; shell weld repairs', 'In-service seal repairs &amp; replacement', 'Internal / external floating roofs']],
  ['Industrial cleaning', ['Dry / wet vacuum services', 'Exchanger cleaning', 'Hydro-excavation', 'Hydroblasting', 'Vapor blasting']],
  ['Facility services', ['Janitorial services', 'Grounds maintenance', 'Pre / post construction cleaning', 'Carpet extraction', 'Floor scrub &amp; recoat', 'Pressure washing']],
];
const WP = 'https://palaciosmarineindustrial.com/wp-content/uploads/';
const GALLERY = [['2023/11/Modular-Installation-Projects.jpeg', 'Modular installation'], ['2023/09/modularinstallproject2.jpg', 'Modular installation'], ['2023/09/piping.jpg', 'Piping'], ['2023/09/fieldblastingpainting.jpg', 'Field blasting &amp; painting'], ['2023/09/blastingpainting.jpg', 'Blasting &amp; painting'], ['2023/09/boringinpipeline.jpg', 'Pipeline boring'], ['slider2/SprayerDryer.jpeg', 'Spray dryer'], ['2023/09/pmi2.jpg', ''], ['slider2/IMG_5280.jpeg', ''], ['slider2/IMG_5286.jpeg', ''], ['slider2/IMG_99212023-07-1916_21_13.jpeg', ''], ['slider2/IMG20221117105958.jpeg', ''], ['slider2/Attachment.jpeg', ''], ['slider2/IMG_00921.jpeg', ''], ['slider2/IMG_03791.jpeg', ''], ['slider2/IMG_03721.jpeg', '']];
const JOBS = 'https://recruiting.paylocity.com/recruiting/jobs/All/03354591-1515-4072-970b-8b8b6216b89f/Palacios-Marine-Industrial';

const TOPICS = [
  { key: 'intro', eyebrow: 'Turnkey industrial contractor · Since 2003', title: 'Reducing complexity. <span>Delivering results.</span>', lead: 'One contractor. Turnkey execution. Fewer handoffs.', name: 'Why PMI', cta: 'Why PMI?', rot: 0.5, hot: [
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
  { key: 'safe', eyebrow: 'Health &amp; Safety', title: 'Zero is <span>achievable.</span>', items: ['Zero accidents', 'Zero incidents', 'Zero harm to the environment'], name: 'Safety', rot: 0.5, hot: [
    { label: 'Our safety goal', icon: IC.safe, html: head('Health &amp; Safety', 'Zero is achievable') + diagram(IC.safe, ['Zero accidents', 'Zero incidents', 'Zero harm to the environment']) + `<div class="cols"><div class="big"><b>0</b><span>the only acceptable target</span></div><div><p>PMI runs on a <b>Shared Responsibility for Safety</b> culture: every team member thinks through, plans, and carries out their work so the job site stays free of risk and incidents.</p><p>Any person on a PMI crew can stop work. As the company grows, so does its commitment to improving how it keeps people safe.</p></div></div>` },
    { label: 'Safety program', icon: IC.list, html: head('Safety program', 'How we get to zero') + groups([['Leadership', ['Management-driven safety', 'Dedicated safety personnel', 'Contractor Safety Council', 'Associated Builders and Contractors (ABC)']], ['Planning', ['Pre-task analysis', 'Training and certification', 'The right tools for the job']], ['In the field', ['Stop Work Authority', 'Buddy system for at-risk employees', 'Observations and interventions']], ['Verification', ['Focused, weekly and “fresh eyes” audits', 'Exposure-hour tracking']]]) },
  ] },
  { key: 'qual', eyebrow: 'Quality', title: 'Our word is <span>our bond.</span>', items: ['ASME “U” and “S” stamps', 'NBIC “R” repairs and alterations', 'API 510 / 570 / 653 and AWS CWI inspectors', 'SSPC-QP 3 shop coatings'], name: 'Quality', rot: 0.5, hot: [
    { label: 'Certifications', icon: IC.qual, html: head('Certifications', 'Certified to build and repair') + diagram(IC.qual, ['ASME “U”: design and fabrication of pressure vessels', 'ASME “S”: fabrication of boiler piping', 'NBIC “R”: repairs and alterations of pressure vessels', 'API 510, 570 and 653 inspection personnel', 'AWS CWI inspection personnel', 'SSPC-QP 3: shop-applied protective coatings']) },
    { label: 'Welding capabilities', icon: IC.mech, html: head('Welding capabilities', 'Metals and processes') + groups([['Metals', ['Carbon steel', 'Stainless steel', 'Nickel alloys', 'Chrome', 'Titanium', 'Aluminum']], ['Processes', ['SMAW (stick)', 'GMAW (MIG)', 'GTAW (TIG)', 'FCAW (flux-core)', 'SAW (submerged arc)']]]) },
    { label: 'Quality mission', icon: IC.star, html: head('Our quality mission', 'First-class workmanship') + `<p>PMI’s quality system builds a culture of continuous improvement in every employee, with procedures that direct work and workmanship toward quality and customer satisfaction.</p>` + diagram(IC.qual, ['Top-class workmanship', 'A safe project', 'A timely project']) + `<p>That is the promise on every job. Our word is our bond.</p>` },
  ] },
  { key: 'exp', eyebrow: 'Experience', title: 'Proven <span>in the field.</span>', items: ['Modular installation', 'Pipe fabrication and installation', 'Field blasting and painting', 'Pipeline boring'], name: 'Experience', rot: 0.5, hot: [
    { label: 'Project gallery', icon: IC.exp, html: head('Experience', 'Proven in the field') + `<p>PMI’s experience shows in every completed project: modular installs, piping, coatings, pipeline and plant work across the Gulf Coast.</p><div class="pics">${GALLERY.map(([f, n]) => `<figure><img loading="lazy" src="${WP}${f}" alt="${n || 'PMI project'}" onerror="this.parentNode.remove()">${n ? `<figcaption>${n}</figcaption>` : ''}</figure>`).join('')}</div>` },
    { label: 'All services', icon: IC.list, html: head('Services', 'Dedicated to service excellence') + groups(SERVICES) },
  ] },
  { key: 'jobs', eyebrow: 'Jobs &amp; Careers', title: 'Our people are <span>our greatest asset.</span>', items: ['A people-first culture', 'Stop Work Authority for everyone', 'Training and certification', 'Gulf Coast locations'], name: 'Careers', cta: 'Join the team', rot: 0.45, hot: [
    { label: 'Join the PMI team', icon: IC.jobs, html: head('Jobs &amp; careers', 'Join the PMI team') + `<p>Our people are our greatest asset. Current openings are posted on PMI’s careers portal.</p>` + list(['Phone: 361.893.5390', '2392 State Highway 35 N, Port Lavaca, TX 77979']) + `<a class="cta" href="${JOBS}" target="_blank" rel="noopener">View open positions</a>` },
    { label: 'Why work here', icon: IC.star, html: head('Why PMI', 'People. Grit. Integrity.') + diagram(IC.jobs, ['A people-first culture', 'Safety is a shared responsibility', 'Training and certification', 'Work close to home across the Gulf Coast']) + `<p>Join a self-perform contractor where crews, supervisors and leadership work as one team.</p><a class="cta" href="${JOBS}" target="_blank" rel="noopener">View open positions</a>` },
  ] },
  { key: 'loc', eyebrow: 'Locations', title: 'Gulf Coast <span>and beyond</span>', items: ['Texas', 'Louisiana', 'Alabama', 'Clarendon, Jamaica'], states: ['TX', 'LA', 'AL', 'JM'], name: 'Locations', cta: 'Contact PMI', rot: 0, flat: true, hot: [
    { label: 'All locations', icon: IC.loc, html: head('Locations', 'Gulf Coast and beyond') + diagram(IC.loc, ['Corporate Office: Port Lavaca, Texas', 'Texas: Corpus Christi · Victoria · Freeport · Deer Park · Houston', 'Louisiana: Lake Charles · Baton Rouge', 'Alabama: Mobile', 'International: Clarendon, Jamaica']) },
    { label: 'Contact PMI', icon: IC.mail, html: head('Let’s discuss', 'Your next project') + `<p>Planning an upcoming maintenance event, turnaround, capital project, or specialty service scope? Connect with PMI to discuss your project goals and execution requirements.</p>` + list(['888.744.9699', 'bids@palaciosmarineindustrial.com', '2392 State Highway 35 N, Port Lavaca, TX 77979']) + `<a class="cta" href="mailto:bids@palaciosmarineindustrial.com">Request a bid</a>` },
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
const U = { uInk: { value: new THREE.Vector3(0.07, 0.075, 0.09) }, uT: { value: 0 }, uTime: { value: 0 }, uPix: { value: 1 }, uMouse: { value: new THREE.Vector2(9, 9) }, uAspect: { value: 1 }, uSize: { value: 0.0085 }, uScale: { value: 1 }, uMin: { value: DPR * 0.8 }, uIntro: { value: 0 } };
const mat = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false,
  vertexShader: `
    attribute vec3 aFrom, aTo; attribute vec4 aRnd; attribute float aT0, aT1;
    uniform float uT, uTime, uPix, uAspect, uSize, uScale, uMin, uIntro; uniform vec2 uMouse; varying float vA; varying float vTint; varying float vR;
    void main(){
      float dl = mix(aRnd.x, clamp(aFrom.x / 1.7 + 0.5, 0.0, 1.0) * 0.9 + aRnd.x * 0.1, uIntro);      // opening: a clean left-to-right wipe
      float t = clamp(uT * 1.8 - dl * 0.8, 0.0, 1.0);
      float e = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
      vec3 p = mix(aFrom, aTo, e);
      float burst = sin(3.14159 * e) * (1.0 - 0.72 * uIntro);
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
      float spark = clamp(vTint - 2.0, 0.0, 1.0); vR = aRnd.y;
      p += spark * 0.012 * vec3(sin(uTime * 23.0 + aRnd.x * 90.0), cos(uTime * 19.0 + aRnd.y * 90.0), sin(uTime * 17.0 + aRnd.z * 90.0));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      vec2 d = (gl_Position.xy / gl_Position.w - uMouse) * vec2(uAspect, 1.0);
      float f = smoothstep(0.11, 0.0, length(d));
      gl_Position.xy += normalize(d + 1e-5) / vec2(uAspect, 1.0) * f * 0.045 * gl_Position.w;
      float sz = uSize * uScale * (0.6 + aRnd.z * 0.9) * (1.0 + burst * 0.5 + min(vTint, 1.0) * 0.3 + clamp(vTint - 1.0, 0.0, 1.0) * (0.6 + 0.5 * sin(uTime * 30.0 + aRnd.x * 60.0)) + spark * (0.15 + 0.7 * step(0.0, sin(uTime * (14.0 + aRnd.z * 20.0) + aRnd.x * 60.0)))) * uPix / -mv.z;
      gl_PointSize = min(max(sz, uMin), uMin * 14.0);
      float depth = clamp((-mv.z - 5.4) / 3.6, 0.0, 1.0);
      vA = (0.75 + 0.25 * aRnd.x) * mix(1.0, 0.22, depth * depth) * (1.0 - loose * 0.4) * min(1.0, sz / uMin + 0.35) * mix(1.0, smoothstep(0.0, 0.05, t), uIntro);      // opening: a particle only appears as it leaves the crisp logo
    }`,
  fragmentShader: `varying float vA; varying float vTint; varying float vR; uniform vec3 uInk; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.38, d); vec3 col = mix(mix(uInk, vec3(0.89, 0.12, 0.14), clamp(vTint, 0.0, 1.0)), vec3(0.1, 0.45, 0.95), clamp(vTint - 1.0, 0.0, 1.0)); col = mix(col, mix(vec3(1.0, 0.36, 0.0), vec3(1.0, 0.74, 0.05), vR), clamp(vTint - 2.0, 0.0, 1.0)); gl_FragColor = vec4(col, a * min(1.0, vA * 0.92 + min(vTint, 1.0) * 0.4)); }`,
});
const cloud = new THREE.Points(geo, mat); cloud.frustumCulled = false; spin.add(cloud);

// ambient dust and soft bokeh drifting through the frame
const DN = mobile ? 420 : 900, dgeo = new THREE.BufferGeometry(), dp = new Float32Array(DN * 3), dr = new Float32Array(DN * 3);
for (let i = 0; i < DN; i++) { dp[i * 3] = (R() - 0.5) * 22; dp[i * 3 + 1] = (R() - 0.5) * 12; dp[i * 3 + 2] = (R() - 0.5) * 12; dr[i * 3] = R(); dr[i * 3 + 1] = R(); dr[i * 3 + 2] = R(); }
dgeo.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dgeo.setAttribute('aR', new THREE.BufferAttribute(dr, 3));
const DU = { uDk: { value: 0 }, uTime: { value: 0 }, uPix: { value: 1 }, uRush: { value: 0 } };
const dust = new THREE.Points(dgeo, new THREE.ShaderMaterial({
  uniforms: DU, transparent: true, depthWrite: false,
  vertexShader: `attribute vec3 aR; uniform float uTime, uPix, uRush; varying float vA; varying float vB; varying float vC;
    void main(){ vec3 p = position; p.x = mod(p.x + uTime * (0.06 + aR.x * 0.2) + uRush * (2.0 + aR.y * 6.0) + 11.0, 22.0) - 11.0; p.y += sin(uTime * 0.25 + aR.y * 20.0) * 0.4 + p.x * 0.14;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      vB = step(0.8, aR.z); vC = aR.y; gl_PointSize = (vB > 0.5 ? 0.3 + aR.x * 0.3 : 0.022 + aR.z * 0.035) * uPix / -mv.z; vA = vB > 0.5 ? 0.09 : 0.35 + aR.x * 0.5; }`,
  fragmentShader: `uniform float uDk; varying float vA; varying float vB; varying float vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = vB > 0.5 ? smoothstep(0.5, 0.28, d) : smoothstep(0.5, 0.2, d); vec3 col = vB > 0.5 ? vec3(0.55, 0.6, 0.66) : mix(vec3(0.35, 0.38, 0.42), vec3(0.89, 0.12, 0.14), step(0.78, vC)); col = mix(col, vec3(1.0) - col * 0.35, uDk * (1.0 - step(0.78, vC) * step(vB, 0.5))); gl_FragColor = vec4(col, a * vA * 0.8); }`,
}));
dust.frustumCulled = false; scene.add(dust);

/* =========================================================
   UI: overview (one icon + name pill) -> detail (title, hotspots, Close pill) -> content panel
   ========================================================= */
const snd = new Snd();
// ---- light / dark: remembered per browser; first visit follows the phone's or computer's setting
function setTheme(dk) { document.body.classList.toggle('dark', dk); U.uInk.value.set(...(dk ? [0.9, 0.91, 0.93] : [0.07, 0.075, 0.09])); DU.uDk.value = dk ? 1 : 0; const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dk ? '#0c0d0f' : '#ffffff'; try { localStorage.setItem('pmi-theme', dk ? 'dark' : 'light'); } catch (e) {} }
{ let saved = null; try { saved = localStorage.getItem('pmi-theme'); } catch (e) {} setTheme(saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches); }
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
function hotspot(icon, label, at, fn, k) { const el = wire(document.createElement('button')); el.className = 'hot' + (k !== undefined ? ' tile' : ''); el.innerHTML = k !== undefined ? `<i class="ix">0${k + 1}</i><b>${svg(icon)}</b><span>${label}</span>` : `<b>${svg(icon)}</b>${label ? `<span>${label}</span>` : ''}`; el.onclick = fn; hots.appendChild(el); const h = { el, at: new THREE.Vector3(...at), k, t0: performance.now() + 350 + (k || 0) * 140 }; hotEls.push(h); return h; }
function showHots() { hotEls.forEach((h, k) => setTimeout(() => h.el.classList.add('show'), 150 + k * 170)); }
function layout() { document.body.classList.toggle('map', cur >= 0 && !!TOPICS[cur].flat); area(); closeLoc(); hintText();      // (re)build hotspots for the current mode
  hots.innerHTML = ''; pins.innerHTML = ''; hotEls = []; pinEls = [];
  const t = TOPICS[cur], s = SH[cur];
  if (mode === 'over') { if (!t.flat) hotspot(IC[t.key], '', s.hot.enter, enter); }
  else t.hot.forEach((h, k) => hotspot(h.icon, h.label, s.hot['abc'[k]], () => openCard(h.html), k));
  if (t.flat) CITIES.forEach(([n, lo, la, hq], k) => { const el = document.createElement('div'); el.className = 'pin' + (hq ? ' hq' : ''); el.innerHTML = `<svg viewBox="0 0 24 32"><path d="M12 31C12 31 2 18.5 2 11.5a10 10 0 0 1 20 0C22 18.5 12 31 12 31z"/><circle cx="12" cy="11.5" r="3.6"/></svg><span style="left:${PL[k][0]}px;top:${PL[k][1]}px${PL[k][2] ? ';transform:translateX(-100%)' : ''}">${n}</span>`; pins.appendChild(el); const ph = { el, at: new THREE.Vector3(...s.city(lo, la)) }; pinEls.push(ph); wire(el.querySelector('svg')).addEventListener('click', e => { e.stopPropagation(); if (!focus || focus.code !== CITY_ST[k]) setFocus(CITY_ST[k]); else openLoc(k, ph); }); setTimeout(() => el.classList.add('show'), (mode === 'over' ? 1900 : 300) + k * 110); });
  pill.querySelector('span').textContent = mode === 'over' ? (t.cta || 'Explore ' + t.name) : 'Close';
  pill.classList.toggle('x', mode === 'detail');
  document.body.classList.toggle('detail', mode === 'detail');
}
// location window: tap a pin for a small card about that site
const LOCS = [['Texas', 'refinery-red', 'Corporate Office<br>2392 State Highway 35 N, Port Lavaca, TX 77979<br>888.744.9699'], ['Texas', 'ind-refining'], ['Texas', 'ind-power'], ['Texas', 'ind-petrochemical'], ['Texas', 'ind-refining'], ['Texas', 'ind-midstream'], ['Louisiana', 'ind-petrochemical'], ['Louisiana', 'ind-refining'], ['Alabama', 'ind-petrochemical'], ['International', 'ind-power']];
const CITY_ST = ['TX', 'TX', 'TX', 'TX', 'TX', 'TX', 'LA', 'LA', 'AL', 'JM'];
const locEl = document.createElement('div'); locEl.className = 'loc'; document.body.appendChild(locEl); let locPin = null;
function openLoc(k, ph) {
  if (locPin === ph) { closeLoc(); return; }
  const [region, img, extra] = LOCS[k];
  locEl.innerHTML = `<button class="loc-x" aria-label="Close">×</button><figure><img src="../assets/${img}.jpg" alt=""><i></i></figure><div><p class="eyebrow">${region}</p><h4>${CITIES[k][0]}</h4><p class="t">${extra || 'PMI location'}</p><a class="cta" href="mailto:bids@palaciosmarineindustrial.com">Request a bid</a></div>`;
  wire(locEl.querySelector('.loc-x')).onclick = e => { e.stopPropagation(); closeLoc(); };
  pinEls.forEach(p => p.el.classList.toggle('sel', p === ph)); locPin = ph; placeLoc(); locEl.classList.add('open'); snd.open();
}
function closeLoc() { if (!locPin) return; locPin = null; locEl.classList.remove('open'); pinEls.forEach(p => p.el.classList.remove('sel')); }
function placeLoc() { if (!locPin || locPin.x === undefined) return; const W = locEl.offsetWidth, H = locEl.offsetHeight, x = Math.min(innerWidth - W - 8, Math.max(8, locPin.x - W / 2)), top = locPin.y - 40 - H, y = top > 70 ? top : Math.min(innerHeight - H - 8, locPin.y + 16); locEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; }
window.addEventListener('pointerdown', e => { if (locPin && !e.target.closest('.loc') && !e.target.closest('.pin')) closeLoc(); });
const PL = [[13, -6], [-13, -8, 1], [-14, -30, 1], [14, -19], [-10, -64, 1], [-12, -47, 1], [-14, -44], [-8, -58], [14, -26], [14, -22]];   // label offsets per city so the Texas cluster stays readable
const hint = $('.hint'), touch = matchMedia('(pointer:coarse)').matches; let moves = 0;
hint.classList.toggle('touch', touch);
function go(i) {
  if (mode === 'intro' || performance.now() < lock) return;
  i = (i + TOPICS.length) % TOPICS.length; if (i === cur && mode === 'over') return;
  const same = i === cur; lock = performance.now() + 900; if (!same) focus = null; cur = i; mode = 'over'; closeCard(true);
  if (!same) { snd.morph(); setTarget(SH[i], 2.5); if (++moves > 3) hint.classList.add('seen'); }
  title.textContent = TOPICS[i].name;
  if (!same) { copy.classList.add('swap'); setTimeout(() => { if (cur !== i) return; const t = TOPICS[i]; copy.querySelector('.eyebrow').innerHTML = t.eyebrow; copy.querySelector('h1').innerHTML = t.title; copy.querySelector('.lead').textContent = t.lead || ''; copy.querySelector('ul').innerHTML = (t.items || []).map((x, n) => t.states ? `<li><button class="st" data-s="${t.states[n]}">${x}<b></b></button></li>` : `<li>${x}</li>`).join(''); stateBtns(); copy.classList.remove('swap'); }, 650); }
  [...rail.children].forEach((b, k) => b.classList.toggle('on', k === i)); [...$('.all-grid').children].forEach((b, k) => b.classList.toggle('on', k === i));
  layout(); setTimeout(() => { if (cur === i && mode === 'over') showHots(); }, same ? 0 : 1700);
}
function enter() { if (mode !== 'over') return; if (TOPICS[cur].flat) { openCard(TOPICS[cur].hot[1].html); return; } mode = 'detail'; snd.open(); layout(); showHots(); }
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
$('.thm').onclick = () => setTheme(!document.body.classList.contains('dark'));
$('.snd').onclick = e => { const on = !snd.on; snd.set(on); e.currentTarget.classList.toggle('off', !on); };
$('.logo').onclick = e => { e.preventDefault(); go(0); };

let lastWheel = 0, ty = null;
// ---- map zoom: tap a state to move in on its sites; any swipe / scroll / arrow zooms back out
const FO0 = { x: 0, y: 0, k: 1 }, FOCUS = { TX: [-96.25, 28.8, 3.0, 'Texas'], LA: [-92.2, 30.3, 3.0, 'Louisiana'], AL: [-88.04, 30.69, 3.2, 'Alabama'], JM: [-77.3, 18.1, 2.3, 'Jamaica'] };
let focus = null, fz = 1; const ray = new THREE.Raycaster(), inv = new THREE.Matrix4();
function hintText() { document.body.classList.toggle('zoomed', !!focus); const sp = hint.querySelector('span'), map = mode !== 'intro' && cur >= 0 && TOPICS[cur].flat; sp.textContent = focus ? 'Tap a pin for site details' : map ? 'Tap a state or a pin to zoom in' : (touch ? 'Swipe up to explore' : 'Scroll to explore'); }
function stateBtns() { copy.querySelectorAll('.st').forEach(b => { b.classList.toggle('on', !!focus && focus.code === b.dataset.s); b.querySelector('b').textContent = focus && focus.code === b.dataset.s ? 'Show all' : ''; if (!b.wired) { b.wired = 1; wire(b).onclick = e => { e.stopPropagation(); setFocus(focus && focus.code === b.dataset.s ? null : b.dataset.s); }; } }); }
function setFocus(code) {
  const f = code && FOCUS[code]; if (!f) { if (focus) { focus = null; snd.close(); closeLoc(); hintText(); stateBtns(); } return; }
  const pts = CITIES.filter((q, k) => CITY_ST[k] === code).map(q => SH[cur].city(q[1], q[2])), xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), S = view.ts * (innerHeight / 2) / (Math.tan(camera.fov * Math.PI / 360) * camera.position.z);
  const kMax = f[2], fitK = pts.length > 1 ? Math.min(view.w * 0.72 / ((x1 - x0) * S), view.h * 0.62 / ((y1 - y0) * S * 0.95)) : kMax;
  focus = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, k: Math.max(1.3, Math.min(kMax, fitK)), code }; closeLoc(); snd.open(); hintText(); stateBtns();
}
const nav = d => { if (focus) { setFocus(null); lock = performance.now() + 500; return; } go(cur + d); };
window.addEventListener('click', e => {
  if (mode === 'intro' || cur < 0 || !TOPICS[cur].flat || blocked() || e.target !== canvas) return;
  ray.setFromCamera({ x: e.clientX / innerWidth * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }, camera);
  const o = ray.ray.origin.clone(), d = ray.ray.direction.clone(); inv.copy(cloud.matrixWorld).invert(); o.applyMatrix4(inv); d.transformDirection(inv); if (Math.abs(d.z) < 1e-6) return;
  const k = -o.z / d.z, code = SH[cur].state(o.x + d.x * k, o.y + d.y * k);
  if (code && FOCUS[code] && (!focus || focus.code !== code)) setFocus(code);
});
const blocked = () => cardEl.classList.contains('open') || allEl.classList.contains('open');
window.addEventListener('wheel', e => { if (blocked()) return; const now = performance.now(), fresh = now - lastWheel > 200; lastWheel = now; if (fresh && Math.abs(e.deltaY) > 4) nav(Math.sign(e.deltaY)); }, { passive: true });
window.addEventListener('touchstart', e => { ty = e.touches[0].clientY; }, { passive: true });
window.addEventListener('touchend', e => { U.uMouse.value.set(9, 9); if (ty === null || blocked()) return; const dy = ty - e.changedTouches[0].clientY; ty = null; if (Math.abs(dy) > 45) nav(Math.sign(dy)); }, { passive: true });
window.addEventListener('keydown', e => { if (e.key === 'Escape') { if (blocked()) { closeCard(); closeAll(); } else leave(); return; } if (blocked()) return; if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) nav(1); if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) nav(-1); if (e.key === 'Enter') mode === 'detail' ? leave() : enter(); });

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
const DOCK = () => innerWidth <= 900 ? 96 : 108;      // height of the docked buttons in detail mode
function area() {
  const w = innerWidth, h = innerHeight, narrow = w <= 900, detail = mode === 'detail', navB = $('.nav').getBoundingClientRect().bottom, pillT = pill.getBoundingClientRect().top || h - 80;
  let l = 0, r = w, t = navB + 8, b = h;
  if (mode !== 'intro') {
    const c = copy.getBoundingClientRect();
    if (narrow) b = (detail ? pillT - DOCK() - 10 : Math.min(c.top, pillT)) - 8;
    else { l = c.right + 10; r = (rail.getBoundingClientRect().left || w) - 16; b = pillT - 10 - (detail ? DOCK() + 6 : 0); }
  }
  const ppu = (h / 2) / (Math.tan(camera.fov * Math.PI / 360) * camera.position.z);
  view.w = r - l; view.h = b - t; view.tx = (l + r) / 2 - w / 2; view.ty = (t + b) / 2 - h / 2;
  view.ts = mode === 'intro' ? Math.min(0.9, w / h * 1.1) : Math.min(1.15, view.w / (4.5 * ppu), view.h / (3.15 * ppu));
  if (mode !== 'intro' && !narrow && TOPICS[Math.max(0, cur)].flat) { view.ts = Math.min(view.ts, view.w / (6.3 * ppu)); view.tx += 0.85 * view.ts * ppu; }      // wide screens: leave room for west Texas beside the text
}
window.addEventListener('resize', fit); fit();

const v = new THREE.Vector3(); let t0 = performance.now(), el = 0, rush = 0;
function place(h, ox, oy, clamp) { v.copy(h.at).applyMatrix4(cloud.matrixWorld).project(camera); let x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight; if (clamp) { const mx = Math.min(70, innerWidth * 0.16); x = Math.min(innerWidth - mx, Math.max(mx, x)); y = Math.min(innerHeight - 150, Math.max(130, y)); } h.x = x; h.y = y; h.el.style.transform = `translate(${(x - ox).toFixed(1)}px, ${(y - oy).toFixed(1)}px)`; }
// detail buttons: a row of equal tiles centred under the model. Each one starts as a small chip on its part of the model,
// flies down and opens out into its slot. The row is centred on the Close button.
const easeO = x => 1 - Math.pow(1 - x, 4);
function dock(h, now) {
  const n = hotEls.length, narrow = innerWidth <= 900, gap = narrow ? 8 : 12, th = DOCK(), maxW = innerWidth - 24;
  const tw = Math.min(narrow ? 150 : 178, (maxW - gap * (n - 1)) / n), cx = (() => { const q = pill.getBoundingClientRect(); return q.width ? q.left + q.width / 2 : innerWidth / 2; })(), top = (pill.getBoundingClientRect().top || innerHeight - 80) - 12 - th;
  const sx = cx - (n * tw + (n - 1) * gap) / 2 + h.k * (tw + gap);
  v.copy(h.at).applyMatrix4(cloud.matrixWorld).project(camera); const ax = (v.x + 1) / 2 * innerWidth, ay = (1 - v.y) / 2 * innerHeight;
  const e = easeO(Math.min(1, Math.max(0, (now - h.t0) / 900))), sc = 0.32 + 0.68 * e;
  const x = (ax - tw * sc / 2) + (sx - (ax - tw * sc / 2)) * e, y = (ay - th * sc / 2) + (top - (ay - th * sc / 2)) * e;
  h.el.style.width = tw.toFixed(1) + 'px'; h.el.style.height = th + 'px'; h.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${sc.toFixed(3)})`;
  h.el.style.opacity = e > 0 ? 1 : 0; h.x = sx + tw / 2; h.y = top;
}
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = Math.min(0.05, (now - t0) / 1000); t0 = now; el += dt;
  U.uTime.value = DU.uTime.value = el;
  let k = 1; if (morph.on) { k = Math.min(1, (now - morph.t0) / morph.dur); U.uT.value = k; if (U.uIntro.value) loader.style.setProperty('--w', (Math.min(1.1, Math.max(0, (k - 0.012) / 0.4)) * 100).toFixed(1) + '%'); if (k >= 1) { morph.on = false; U.uIntro.value = 0; } }
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
  const fo = focus && flat ? focus : FO0; fz += (fo.k - fz) * 0.07; cloud.position.x += (-fo.x - cloud.position.x) * 0.07; cloud.position.y += (-fo.y - cloud.position.y) * 0.07;
  const sc = view.s * zoom * fz; group.scale.setScalar(sc); U.uScale.value = view.s * zoom * Math.pow(fz, 0.6);
  if (fly) ang += dt * 0.17;
  else { const home = mode === 'intro' ? 0 : t.rot + Math.sin(el * 0.2) * (flat ? 0.08 : 0.16); ang += (home + Math.PI * 2 * Math.round((ang - home) / (Math.PI * 2)) - ang) * 0.05; }
  group.rotation.set(mode === 'intro' ? 0.1 : flat ? -0.32 : 0.36, 0, 0);
  spin.rotation.y = ang;
  group.updateMatrixWorld();
  hotEls.forEach(h => { if (mode === 'over') h.el.style.transform = `translate(${(innerWidth / 2 + view.tx + Math.min(view.w * 0.36, 300) - 23).toFixed(1)}px, ${(innerHeight / 2 + view.ty - view.h * 0.36 - 23).toFixed(1)}px)`; else dock(h, now); }); pinEls.forEach(h => place(h, 0, 0)); placeLoc();
  renderer.render(scene, camera);
}
// Opening: the crisp PMI logo dissolves in place into the same logo made of particles, which then break apart and
// re-form as the ring of discipline models before the welcome card appears.
const loader = document.getElementById('loader'), LW = 1.7, born = performance.now();
function logoShape(img) {
  const W = 220, H = Math.round(W * img.naturalHeight / img.naturalWidth), c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data, px = [];
  for (let i = 0; i < W * H; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; if (d[i * 4 + 3] < 128) continue; if (r > 150 && g < 100 && b < 100) px.push(i, 1); else if (r + g + b < 330) px.push(i, 0); }
  if (px.length < 200) return false;
  const from = geo.attributes.aFrom.array, t0 = geo.attributes.aT0.array, n = px.length / 2;
  for (let i = 0; i < N; i++) { const k = (R() * n) | 0, p = px[k * 2]; from[i * 3] = ((p % W + R()) / W - 0.5) * LW; from[i * 3 + 1] = (0.5 - (((p / W) | 0) + R()) / H) * LW * H / W; from[i * 3 + 2] = (R() - 0.5) * 0.02; t0[i] = px[k * 2 + 1]; }
  geo.attributes.aFrom.needsUpdate = true; geo.attributes.aT0.needsUpdate = true; return true;
}
function opening(img) {
  let ok = false; try { ok = img && logoShape(img); } catch (e) { ok = false; }
  area(); view.s = view.ts; view.x = view.tx; view.y = view.ty; U.uIntro.value = ok ? 1 : 0;
  const ppu = (innerHeight / 2) / (Math.tan(camera.fov * Math.PI / 360) * camera.position.z);
  loader.style.setProperty('--lw', (LW * view.ts * ppu).toFixed(1) + 'px'); loader.style.setProperty('--ly', view.ty.toFixed(1) + 'px');
  setTimeout(() => {
    U.uIntro.value = ok ? 1 : 0; morph = { t0: performance.now() + 420, dur: 1700, on: true }; loader.classList.add('go');
    setTimeout(() => { loader.classList.add('done'); $('.intro').classList.remove('gone'); }, 1750);
  }, Math.max(150, 750 - (performance.now() - born)));
}
U.uT.value = 0; frame();
{ const img = new Image(); let fired = false; const once = ok => { if (fired) return; fired = true; opening(ok ? img : null); }; img.onload = () => once(true); img.onerror = () => once(false); setTimeout(() => once(false), 4000); img.src = '../assets/pmi-logo.png'; }
window.__d2 = { go, enter, leave, snd };
