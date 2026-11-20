// Demo 2 sound: industrial / futuristic bed and UI. Fully synthesized; no audio files.
// Bed: low detuned drone, slow machine pulse, filtered bass sequence with echo, sparse metallic hits, steam swells.
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

  _drone() {
    const ctx = this.ctx, lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 1.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.045; const la = ctx.createGain(); la.gain.value = 90; lfo.connect(la).connect(lp.frequency); lfo.start();
    const g = ctx.createGain(); g.gain.value = 0.1; lp.connect(g).connect(this.bed);
    [[38, -9], [38, 8], [45, 0], [50, 5]].forEach(([m, det], i) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this._hz(m); o.detune.value = det; const og = ctx.createGain(); og.gain.value = i < 2 ? 0.5 : 0.22; o.connect(og).connect(lp); o.start(); });
    this.seqLp = ctx.createBiquadFilter(); this.seqLp.type = 'lowpass'; this.seqLp.Q.value = 7; this.seqLp.frequency.value = 500;
    const sl = ctx.createOscillator(); sl.frequency.value = 0.03; const sa = ctx.createGain(); sa.gain.value = 320; sl.connect(sa).connect(this.seqLp.frequency); sl.start();
    const sg = ctx.createGain(); sg.gain.value = 0.5; this.seqLp.connect(sg); sg.connect(this.bed); sg.connect(this.echo);
  }
  _seq() {
    const ctx = this.ctx, step = this.step;
    const lines = [[38, 0, 45, 50, 0, 45, 53, 0, 38, 0, 45, 50, 0, 57, 53, 0], [36, 0, 43, 48, 0, 43, 52, 0, 36, 0, 43, 48, 0, 55, 52, 0], [34, 0, 41, 46, 0, 41, 50, 0, 34, 0, 41, 46, 0, 53, 50, 0], [33, 0, 40, 45, 0, 40, 49, 0, 33, 0, 40, 45, 0, 52, 57, 0]];
    let n = 0, next = 0;
    setInterval(() => {
      if (ctx.state !== 'running') return;
      if (next < ctx.currentTime) next = ctx.currentTime + 0.05;
      while (next < ctx.currentTime + 0.3) {
        const s = n % 16, bar = Math.floor(n / 16), t = next, m = lines[Math.floor(bar / 2) % 4][s];
        if (m) this._pluck(this._hz(m), t, s % 4 === 0 ? 0.11 : 0.07);
        if (s === 0 || s === 10) this._kick(t, s === 0 ? 0.5 : 0.32);
        this._hat(t, s % 4 === 2 ? 0.03 : s % 2 ? 0.008 : 0.014);
        if (s === 4 || s === 12) this._clank(t, s === 12 && bar % 2 ? 1.5 : 1, 0.05);
        if (s === 14 && bar % 4 === 3) this._clank(t, 2.2, 0.035);
        if (s === 0 && bar % 4 === 0) this._steam(t);
        next += step; n++;
      }
    }, 60);
  }
  _pluck(f, t, g) { const ctx = this.ctx, o = ctx.createOscillator(), e = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f; e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.006); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(e).connect(this.seqLp); o.start(t); o.stop(t + 0.22); }
  _kick(t, g) { const ctx = this.ctx, o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.34); o.connect(e).connect(this.bed); o.start(t); o.stop(t + 0.36); }
  _shot(t, type, f, q, dur, g, dest) { const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const e = ctx.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl).connect(e).connect(dest || this.bed); s.start(t, Math.random()); s.stop(t + dur + 0.02); return fl; }
  _hat(t, g) { this._shot(t, 'highpass', 8000, 0.7, 0.03, g); }
  _clank(t, pitch, g) {      // inharmonic metal hit, sent to the room
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
