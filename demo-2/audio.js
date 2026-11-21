// Demo 2 sound: industrial / futuristic bed and UI. Fully synthesized; no audio files.
// Bed: melodic / progressive house (pad chords, rolling bass, pluck arp, lead, shakers, hand percussion).
// UI: soft airy ticks, short glides and low thumps (no pure-tone beeps).
export class Snd {
  constructor() { this.ctx = null; this.on = true; }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination); this.out = comp;
    const len = 2.2 * ctx.sampleRate, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
    this.rev = ctx.createConvolver(); this.rev.buffer = ir; const rg = ctx.createGain(); rg.gain.value = 0.38; this.rev.connect(rg).connect(this.master);
    // tempo-synced echo for the sequence
    this.step = 60 / 100 / 4;
    this.echo = ctx.createDelay(1); this.echo.delayTime.value = this.step * 3; const fb = ctx.createGain(); fb.gain.value = 0.42; const el = ctx.createBiquadFilter(); el.type = 'lowpass'; el.frequency.value = 1400;
    this.echo.connect(el).connect(fb).connect(this.echo); const eg = ctx.createGain(); eg.gain.value = 0.5; el.connect(eg).connect(this.master);
    this.bed = ctx.createGain(); this.bed.gain.value = 0.85; this.bed.connect(this.master);
    this.ui = ctx.createGain(); this.ui.gain.value = 0.9; this.ui.connect(this.master); const us = ctx.createGain(); us.gain.value = 0.3; this.ui.connect(us).connect(this.rev);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; this.noise = nb;
    this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, ctx.currentTime, 1.5);
    this._drone(); this._seq();
  }
  set(on) { this.on = on; if (!this.ctx) return; if (on) this.ctx.resume(); this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, on ? 0.6 : 0.1); }
  ok() { return this.ctx && this.on && this.ctx.state === 'running'; }
  _hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // Deep melodic / progressive house bed, 123 BPM, D minor: sub-heavy four-on-the-floor kick, syncopated off-beat sub bass,
  // dark sidechained pad chords, 16th shakers with a gap before each beat, filtered stab pairs and a sparse lead through a
  // dotted-eighth echo. Tempo, key, low-end balance and groove placement were measured from a reference clip; the notes are original.
  // 48-bar arrangement: intro (8) -> groove (16) -> breakdown without kick or bass (8) -> peak with lead (16).
  _drone() {
    const ctx = this.ctx;
    this.step = 60 / 123 / 4; this.echo.delayTime.value = this.step * 3;
    this.pump = ctx.createGain(); this.pump.connect(this.bed);
    // pad bus: slow breathing low-pass, a lot of reverb
    this.padLp = ctx.createBiquadFilter(); this.padLp.type = 'lowpass'; this.padLp.Q.value = 0.8; this.padLp.frequency.value = 720;
    const pl = ctx.createOscillator(); pl.frequency.value = 0.05; const pa = ctx.createGain(); pa.gain.value = 260; pl.connect(pa).connect(this.padLp.frequency); pl.start();
    const ph = ctx.createBiquadFilter(); ph.type = 'highpass'; ph.frequency.value = 260; const pg = ctx.createGain(); pg.gain.value = 0.055; this.padLp.connect(ph).connect(pg); pg.connect(this.pump); const ps = ctx.createGain(); ps.gain.value = 0.3; pg.connect(ps).connect(this.rev);
    // bass bus: round low-pass, light saturation, pumped
    this.bassLp = ctx.createBiquadFilter(); this.bassLp.type = 'lowpass'; this.bassLp.Q.value = 3; this.bassLp.frequency.value = 300;
    const ws = ctx.createWaveShaper(), cv = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 256 - 1; cv[i] = Math.tanh(x * 1.6); } ws.curve = cv;
    const bg = ctx.createGain(); bg.gain.value = 0.42; this.bassLp.connect(ws).connect(bg).connect(this.pump);
    // arp / lead bus: resonant low-pass on a slow sweep, into echo and reverb
    this.seqLp = ctx.createBiquadFilter(); this.seqLp.type = 'lowpass'; this.seqLp.Q.value = 6; this.seqLp.frequency.value = 1050;
    const sl = ctx.createOscillator(); sl.frequency.value = 0.03; const sa = ctx.createGain(); sa.gain.value = 600; sl.connect(sa).connect(this.seqLp.frequency); sl.start();
    const sg = ctx.createGain(); sg.gain.value = 0.4; this.seqLp.connect(sg); sg.connect(this.pump); sg.connect(this.echo); const ss = ctx.createGain(); ss.gain.value = 0.35; sg.connect(ss).connect(this.rev);
  }
  _seq() {
    const ctx = this.ctx, step = this.step;
    const GRV = [[31, [55, 58, 62, 65, 69]], [31, [55, 58, 62, 65, 69]], [34, [58, 62, 65, 69, 72]], [36, [55, 60, 64, 67, 74]]];   // Gm9, Gm9, Bbmaj7, Cadd9
    const BRK = [[38, [62, 65, 69, 72, 76]], [29, [57, 60, 64, 65, 72]], [31, [55, 58, 62, 65, 70]], [36, [55, 60, 64, 67, 72]]];   // Dm9, Fmaj7, Gm7, C
    const LEAD = [[[0, 74], [6, 72], [12, 69]], [[4, 65], [10, 69]], [[0, 70], [6, 69], [12, 65]], [[4, 62]], [[0, 67], [6, 70], [12, 74]], [[4, 72], [10, 70]], [[0, 69], [6, 72], [12, 76]], [[4, 72], [8, 69]]];
    let n = 0, next = 0;
    setInterval(() => {
      if (ctx.state !== 'running') return;
      if (next < ctx.currentTime) next = ctx.currentTime + 0.05;
      while (next < ctx.currentTime + 0.3) {
        const s = n % 16, bar = Math.floor(n / 16), b = bar % 48, t = next + (s % 2 ? step * 0.08 : 0);
        const intro = b < 8, brk = b >= 24 && b < 32, peak = b >= 32, [root, notes] = (brk ? BRK : GRV)[(bar >> 1) % 4];
        if (s === 0 && bar % 2 === 0) this._pad(notes, t, step * 32, brk ? 2.2 : 1);
        if (!brk) {
          if (s % 4 === 0) this._kick(t, 0.85);
          if (s % 8 === 1) this._bass(root, t, step * 1.5, intro ? 0.7 : 1); else if (s % 8 === 6) this._bass(s === 14 && bar % 2 ? root + 12 : root, t, step * 1.3, intro ? 0.7 : 1);   // syncopated sub bass
          if ((s === 4 || s === 12) && !intro) this._clap(t);
          if ((s === 11 && bar % 2) || (s === 15 && bar % 4 === 3)) this._tom(t, 150, 0.07);
        }
        if (s % 4 !== 3) this._hat(t, (s % 4 === 2 ? 0.02 : 0.009) * (brk ? 0.5 : 1));                                // shaker, silent on the last 16th of each beat
        if (!intro && s < 12 && (s % 4 === 1 || s % 4 === 2)) this._pluck(this._hz(notes[(s + bar) % 5] + (s % 4 === 2 ? 12 : 0)), t, brk ? 0.05 : 0.06);   // stab pairs
        if (peak || (brk && b >= 28)) LEAD[bar % 8].forEach(([ls, m]) => { if (ls === s) this._lead(this._hz(m), t); });
        if (b === 30 && s === 0) this._rise(t, step * 32);
        if ((b === 8 || b === 32) && s === 0) this._shot(t, 'highpass', 5000, 0.5, 1.6, 0.05, this.rev);      // crash on the drop
        next += step; n++;
      }
    }, 50);
  }
  _pad(notes, t, dur, lvl) {
    const ctx = this.ctx, e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.2 * lvl, t + dur * 0.25); e.gain.linearRampToValueAtTime(0.07 * lvl, t + dur * 0.7); e.gain.linearRampToValueAtTime(0.0001, t + dur);
    notes.forEach((m, i) => [-9, 8].forEach(d => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this._hz(m); o.detune.value = d + i; o.connect(e); o.start(t); o.stop(t + dur * 1.02); }));
    e.connect(this.padLp);
  }
  _pluck(f, t, g) { const ctx = this.ctx, e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.005); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); [['sawtooth', 0, 0.6], ['triangle', 6, 1]].forEach(([type, d, lv]) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f; o.detune.value = d; og.gain.value = lv; o.connect(og).connect(e); o.start(t); o.stop(t + 0.18); }); e.connect(this.seqLp); }
  _lead(f, t) {
    const ctx = this.ctx, e = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.5);
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.05, t + 0.012); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    [['triangle', 0], ['sine', 1200], ['sawtooth', -5]].forEach(([type, d], i) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f; o.detune.value = d; og.gain.value = i === 2 ? 0.25 : i ? 0.3 : 1; o.connect(og).connect(lp); o.start(t); o.stop(t + 0.75); });
    lp.connect(e); e.connect(this.pump); e.connect(this.echo); e.connect(this.rev);
  }
  _bass(m, t, dur, lvl) {
    const ctx = this.ctx, e = ctx.createGain(), f = this._hz(m); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.8 * lvl, t + 0.006); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [['sine', 1, 1], ['sawtooth', 1, 0.45], ['square', 2, 0.22]].forEach(([type, mul, lv]) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * mul; og.gain.value = lv; o.connect(og).connect(e); o.start(t); o.stop(t + dur + 0.02); });
    e.connect(this.bassLp); this.bassLp.frequency.cancelScheduledValues(t); this.bassLp.frequency.setValueAtTime(460, t); this.bassLp.frequency.exponentialRampToValueAtTime(180, t + dur);
  }
  _kick(t, g) {
    const ctx = this.ctx, o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(47, t + 0.09); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.28); o.connect(e).connect(this.bed); o.start(t); o.stop(t + 0.3);
    this._shot(t, 'bandpass', 2200, 1, 0.01, 0.05);
    this.pump.gain.cancelScheduledValues(t); this.pump.gain.setValueAtTime(0.3, t); this.pump.gain.linearRampToValueAtTime(1, t + 0.22);
  }
  _tom(t, f, g) { const ctx = this.ctx, o = ctx.createOscillator(), e = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(e); e.connect(this.bed); e.connect(this.rev); o.start(t); o.stop(t + 0.18); }
  _rise(t, dur) { const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(6000, t + dur); const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.05, t + dur * 0.95); e.gain.linearRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(e); e.connect(this.bed); e.connect(this.rev); s.start(t); s.stop(t + dur + 0.05); }
  _shot(t, type, f, q, dur, g, dest) { const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const e = ctx.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl).connect(e).connect(dest || this.bed); s.start(t, Math.random()); s.stop(t + dur + 0.02); return fl; }
  _hat(t, g) { this._shot(t, 'highpass', 7500, 0.7, 0.035, g); }
  _clap(t) { [0, 0.011, 0.023].forEach(d => this._shot(t + d, 'bandpass', 1500, 1.4, 0.09, 0.09)); this._shot(t + 0.023, 'bandpass', 1500, 1, 0.22, 0.05, this.rev); }
  _clank(t, pitch, g) {
    const ctx = this.ctx, e = ctx.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); e.connect(this.bed); e.connect(this.rev);
    [211, 583, 947, 1432].forEach((f, i) => { const o = ctx.createOscillator(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = f * pitch; const og = ctx.createGain(); og.gain.value = 1 / (i + 1.5); o.connect(og).connect(e); o.start(t); o.stop(t + 0.52); });
    this._shot(t, 'bandpass', 2600 * pitch, 3, 0.06, g * 1.2);
  }
  _steam(t) { const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(3200, t + 1.2); const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.02, t + 0.5); e.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); s.connect(f).connect(e); e.connect(this.bed); e.connect(this.rev); s.start(t); s.stop(t + 1.7); }

  // ---- UI ----
  _glide(f0, f1, dur, g, type = 'sine', lp = 2400, delay = 0) { const ctx = this.ctx, t = ctx.currentTime + delay, o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), e = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.type = 'lowpass'; fl.frequency.value = lp; e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + dur * 0.2); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(fl).connect(e).connect(this.ui); o.start(t); o.stop(t + dur + 0.02); }
  _air(f0, f1, dur, g, q = 4) { const ctx = this.ctx, t = ctx.currentTime, fl = this._shot(t, 'bandpass', f0, q, dur, g, this.ui); fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur); }
  // UI sounds are air and clean sine tones only: no low sawtooth glides.
  hover() { if (!this.ok()) return; this._air(3200, 6200, 0.05, 0.05, 6); }
  click() { if (!this.ok()) return; this._air(2200, 5600, 0.06, 0.06, 5); this._glide(520, 1040, 0.07, 0.04, 'sine', 4000); }
  open() { if (!this.ok()) return; this._air(700, 4200, 0.35, 0.045, 2); this._glide(440, 880, 0.22, 0.035, 'sine', 4000); this._glide(660, 1320, 0.26, 0.02, 'sine', 5000, 0.06); }
  close() { if (!this.ok()) return; this._air(3600, 700, 0.28, 0.04, 2); this._glide(880, 440, 0.2, 0.03, 'sine', 4000); }
  morph() { if (!this.ok()) return; this._air(500, 5200, 0.9, 0.05, 1.4); this._air(6000, 1800, 0.5, 0.025, 2.5); this._glide(587, 880, 0.5, 0.022, 'sine', 5000, 0.15); this._glide(880, 1175, 0.6, 0.016, 'sine', 6000, 0.45); }
}
