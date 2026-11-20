// Demo 2 sound: industrial / futuristic bed and UI. Fully synthesized; no audio files.
// Bed: cyberpunk industrial house (kick, reese bass, hats, clap, resonant arp, stabs, metal hits).
// UI: soft airy ticks, short glides and low thumps (no pure-tone beeps).
export class Snd {
  constructor() { this.ctx = null; this.on = true; }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination); this.out = comp;
    const len = 3.5 * ctx.sampleRate, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
    this.rev = ctx.createConvolver(); this.rev.buffer = ir; const rg = ctx.createGain(); rg.gain.value = 0.55; this.rev.connect(rg).connect(this.master);
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

  // Cyberpunk industrial house, 120 BPM: four-on-the-floor kick, gritty off-beat reese bass with sidechain pump,
  // open hats, clap on 2 and 4, resonant arp with echo, dark stabs, metal hits, low drone.
  _drone() {
    const ctx = this.ctx;
    this.step = 60 / 120 / 4; this.echo.delayTime.value = this.step * 3;
    this.pump = ctx.createGain(); this.pump.connect(this.bed);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; const g = ctx.createGain(); g.gain.value = 0.07; lp.connect(g).connect(this.pump);
    [[26, -8], [26, 9], [38, 0]].forEach(([m, d]) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this._hz(m); o.detune.value = d; o.connect(lp); o.start(); });
    // bass chain: filter -> soft clip for grit -> pump
    this.bassLp = ctx.createBiquadFilter(); this.bassLp.type = 'lowpass'; this.bassLp.Q.value = 5; this.bassLp.frequency.value = 420;
    const ws = ctx.createWaveShaper(), cv = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 256 - 1; cv[i] = Math.tanh(x * 3.2); } ws.curve = cv;
    const bg = ctx.createGain(); bg.gain.value = 0.2; this.bassLp.connect(ws).connect(bg).connect(this.pump);
    // arp chain: resonant low-pass on a slow sweep, into the echo
    this.seqLp = ctx.createBiquadFilter(); this.seqLp.type = 'lowpass'; this.seqLp.Q.value = 9; this.seqLp.frequency.value = 1100;
    const sl = ctx.createOscillator(); sl.frequency.value = 0.035; const sa = ctx.createGain(); sa.gain.value = 750; sl.connect(sa).connect(this.seqLp.frequency); sl.start();
    const sg = ctx.createGain(); sg.gain.value = 0.42; this.seqLp.connect(sg); sg.connect(this.pump); sg.connect(this.echo);
  }
  _seq() {
    const ctx = this.ctx, step = this.step, roots = [38, 38, 38, 38, 34, 34, 36, 36], arp = [0, 12, 7, 15, 12, 19, 15, 7, 0, 12, 10, 15, 12, 22, 19, 10];
    let n = 0, next = 0;
    setInterval(() => {
      if (ctx.state !== 'running') return;
      if (next < ctx.currentTime) next = ctx.currentTime + 0.05;
      while (next < ctx.currentTime + 0.3) {
        const s = n % 16, bar = Math.floor(n / 16), t = next, root = roots[bar % 8];
        if (s % 4 === 0) this._kick(t, 0.75);
        if (s % 4 === 2) { this._bass(root - 12, t, step * 1.7); this._shot(t, 'highpass', 6500, 0.6, 0.14, 0.045); }       // off-beat bass + open hat
        else if (s % 4 === 3 && bar % 2) this._bass(root, t, step * 0.8);
        this._hat(t, s % 2 ? 0.012 : 0.02);
        if (s === 4 || s === 12) this._clap(t);
        if (bar >= 2) this._pluck(this._hz(root + 12 + arp[s]), t, s % 4 === 0 ? 0.075 : 0.05);
        if (s === 0 && bar % 4 === 0) { this._stab(root, t); this._steam(t); }
        if (s === 14 && bar % 2) this._clank(t, bar % 4 === 3 ? 1.6 : 1, 0.04);
        if (s === 7 && bar % 4 === 2) this._clank(t, 2.3, 0.025);
        next += step; n++;
      }
    }, 50);
  }
  _pluck(f, t, g) { const ctx = this.ctx, o = ctx.createOscillator(), e = ctx.createGain(); o.type = 'square'; o.frequency.value = f; e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.13); o.connect(e).connect(this.seqLp); o.start(t); o.stop(t + 0.15); }
  _bass(m, t, dur) {
    const ctx = this.ctx, e = ctx.createGain(), f = this._hz(m); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.9, t + 0.01); e.gain.setValueAtTime(0.9, t + dur * 0.6); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [[-14, 'sawtooth', 1], [13, 'sawtooth', 1], [0, 'square', 2]].forEach(([d, type, mul]) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mul; o.detune.value = d; o.connect(e); o.start(t); o.stop(t + dur + 0.02); });
    e.connect(this.bassLp); this.bassLp.frequency.cancelScheduledValues(t); this.bassLp.frequency.setValueAtTime(900, t); this.bassLp.frequency.exponentialRampToValueAtTime(300, t + dur);
  }
  _kick(t, g) {
    const ctx = this.ctx, o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.11); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.32); o.connect(e).connect(this.bed); o.start(t); o.stop(t + 0.34);
    this._shot(t, 'bandpass', 3200, 1, 0.012, 0.12);
    this.pump.gain.cancelScheduledValues(t); this.pump.gain.setValueAtTime(0.25, t); this.pump.gain.linearRampToValueAtTime(1, t + 0.24);
  }
  _shot(t, type, f, q, dur, g, dest) { const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const e = ctx.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl).connect(e).connect(dest || this.bed); s.start(t, Math.random()); s.stop(t + dur + 0.02); return fl; }
  _hat(t, g) { this._shot(t, 'highpass', 9000, 0.7, 0.03, g); }
  _clap(t) { [0, 0.011, 0.023].forEach(d => this._shot(t + d, 'bandpass', 1500, 1.4, 0.09, 0.09)); this._shot(t + 0.023, 'bandpass', 1500, 1, 0.22, 0.05, this.rev); }
  _stab(root, t) {
    const ctx = this.ctx, e = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(350, t + 0.9);
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.045, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    [12, 15, 19, 22].forEach(i => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this._hz(root + i); o.detune.value = (i % 2 ? 7 : -7); o.connect(lp); o.start(t); o.stop(t + 1.15); });
    lp.connect(e); e.connect(this.pump); e.connect(this.rev);
  }
  _clank(t, pitch, g) {
    const ctx = this.ctx, e = ctx.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); e.connect(this.bed); e.connect(this.rev);
    [211, 583, 947, 1432].forEach((f, i) => { const o = ctx.createOscillator(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = f * pitch; const og = ctx.createGain(); og.gain.value = 1 / (i + 1.5); o.connect(og).connect(e); o.start(t); o.stop(t + 0.52); });
    this._shot(t, 'bandpass', 2600 * pitch, 3, 0.06, g * 1.2);
  }
  _steam(t) { const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(3200, t + 1.2); const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.02, t + 0.5); e.gain.exponentialRampToValueAtTime(0.0001, t + 1.6); s.connect(f).connect(e); e.connect(this.bed); e.connect(this.rev); s.start(t); s.stop(t + 1.7); }

  // ---- UI ----
  _glide(f0, f1, dur, g, type = 'sine', lp = 2400, delay = 0) { const ctx = this.ctx, t = ctx.currentTime + delay, o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), e = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.type = 'lowpass'; fl.frequency.value = lp; e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + dur * 0.2); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(fl).connect(e).connect(this.ui); o.start(t); o.stop(t + dur + 0.02); }
  _air(f0, f1, dur, g, q = 4) { const ctx = this.ctx, t = ctx.currentTime, fl = this._shot(t, 'bandpass', f0, q, dur, g, this.ui); fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur); }
  hover() { if (!this.ok()) return; this._air(3200, 6200, 0.05, 0.05, 6); }
  click() { if (!this.ok()) return; this._air(1800, 5200, 0.07, 0.07, 5); this._glide(160, 70, 0.12, 0.2); this._glide(420, 1300, 0.07, 0.03, 'triangle', 3000); }
  open() { if (!this.ok()) return; this._air(500, 3600, 0.4, 0.05, 2); this._glide(90, 180, 0.4, 0.14, 'sawtooth', 500); this._glide(360, 720, 0.28, 0.03, 'triangle', 2200, 0.05); }
  close() { if (!this.ok()) return; this._air(3200, 500, 0.3, 0.045, 2); this._glide(180, 80, 0.3, 0.13, 'sawtooth', 450); }
  morph() { if (!this.ok()) return; this._air(300, 4200, 1.3, 0.05, 1.2); this._glide(55, 110, 1.4, 0.16, 'sawtooth', 380); this._glide(110, 164.8, 1.4, 0.08, 'sawtooth', 500, 0.1); const t = this.ctx.currentTime; this._clank(t + 1.25, 0.8, 0.04); }
}
