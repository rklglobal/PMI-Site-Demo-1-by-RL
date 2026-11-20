// Demo 2 sound: soft pulsing chord bed (~107 BPM), low swells on chord changes, light UI ticks and chimes.
// Fully synthesized; no audio files.
export class Snd {
  constructor() { this.ctx = null; this.on = true; }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20;
    this.master.connect(comp).connect(ctx.destination); this.out = comp;
    const len = 4 * ctx.sampleRate, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
    this.rev = ctx.createConvolver(); this.rev.buffer = ir;
    const rg = ctx.createGain(); rg.gain.value = 0.5; this.rev.connect(rg).connect(this.master);
    this.bed = ctx.createGain(); this.bed.gain.value = 0.8;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
    this.bed.connect(lp); lp.connect(this.master); lp.connect(this.rev);
    this.ui = ctx.createGain(); this.ui.gain.value = 0.9; this.ui.connect(this.master);
    const us = ctx.createGain(); us.gain.value = 0.35; this.ui.connect(us).connect(this.rev);
    const nl = ctx.sampleRate, nb = ctx.createBuffer(1, nl, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = nb;
    this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, ctx.currentTime, 1.5);
    this._bed();
  }
  set(on) { this.on = on; if (!this.ctx) return; if (on) this.ctx.resume(); this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, on ? 0.6 : 0.1); }
  _hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  _bed() {
    const ctx = this.ctx, step = 60 / 107 / 2;
    const chords = [[57, 60, 64], [60, 64, 67], [62, 65, 69], [57, 64, 72]];   // Am, C, Dm, Am (open)
    let n = 0, next = 0;
    setInterval(() => {
      if (ctx.state !== 'running') return;
      if (next < ctx.currentTime) next = ctx.currentTime + 0.05;
      while (next < ctx.currentTime + 0.3) {
        const s = n % 16, ch = chords[Math.floor(n / 16) % 4], t = next;
        const acc = s % 4 === 0 ? 1 : s % 2 === 0 ? 0.7 : 0.45;
        ch.forEach((m, i) => this._pluck(this._hz(m), t + i * 0.012, 0.03 * acc));
        if (s === 0) { this._swell(this._hz(ch[0] - 24), t, step * 15, 0.16); this._swell(this._hz(ch[0] - 12), t, step * 15, 0.05); }
        if (s === 8 && Math.random() < 0.6) this._pluck(this._hz(ch[2] + 12), t, 0.018);
        next += step; n++;
      }
    }, 70);
  }
  _pluck(f, t, g) {
    const ctx = this.ctx, a = ctx.createOscillator(), b = ctx.createOscillator(), e = ctx.createGain(), bg = ctx.createGain();
    a.type = 'sine'; b.type = 'triangle'; a.frequency.value = f; b.frequency.value = f * 2; bg.gain.value = 0.25;
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    a.connect(e); b.connect(bg).connect(e); e.connect(this.bed); a.start(t); b.start(t); a.stop(t + 0.45); b.stop(t + 0.45);
  }
  _swell(f, t, dur, g) {
    const ctx = this.ctx, o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.value = f;
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + dur * 0.3); e.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(e).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  _tick(g, hp = 6000, dur = 0.03) {
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const e = ctx.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(e).connect(this.ui); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  _bell(f, g, dur, delay = 0) {
    const ctx = this.ctx, t = ctx.currentTime + delay, o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.value = f;
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.008); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(e).connect(this.ui); o.start(t); o.stop(t + dur + 0.02);
  }
  ok() { return this.ctx && this.on && this.ctx.state === 'running'; }
  hover() { if (!this.ok()) return; this._tick(0.05); this._bell(2637, 0.012, 0.08); }
  click() { if (!this.ok()) return; this._tick(0.08, 5000, 0.04); this._bell(880, 0.05, 0.35); this._bell(1318.5, 0.035, 0.45, 0.06); }
  open() { if (!this.ok()) return; this._bell(440, 0.05, 0.5); this._bell(659.3, 0.04, 0.6, 0.09); this._bell(880, 0.03, 0.7, 0.18); }
  close() { if (!this.ok()) return; this._bell(659.3, 0.04, 0.3); this._bell(440, 0.035, 0.4, 0.07); }
  morph() {
    if (!this.ok()) return;
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(350, t); f.frequency.exponentialRampToValueAtTime(2800, t + 1.0); f.frequency.exponentialRampToValueAtTime(700, t + 1.9);
    const e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.05, t + 0.7); e.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    s.connect(f).connect(e).connect(this.ui); s.start(t); s.stop(t + 2);
    [523.25, 659.3, 784, 1046.5].forEach((fq, i) => this._bell(fq, 0.022, 0.5, 0.9 + i * 0.11));
  }
}
