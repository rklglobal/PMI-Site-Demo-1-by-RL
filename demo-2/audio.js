// Demo 2 sound: industrial / futuristic bed and UI. Fully synthesized; no audio files.
// Bed: chill lounge (electric-piano chords, round bass, soft kick and rim, sparse melody).
// UI: soft airy ticks, short glides and low thumps (no pure-tone beeps).
// To use a recorded track instead of the generated one, put the file in this folder and set its name here (e.g. 'music.mp3').
const MUSIC_FILE = '';
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
    this.rev = ctx.createConvolver(); this.rev.buffer = ir; const rg = ctx.createGain(); rg.gain.value = 0.5; this.rev.connect(rg).connect(this.master);
    // tempo-synced echo for the sequence
    this.step = 60 / 100 / 4;
    this.echo = ctx.createDelay(1); this.echo.delayTime.value = this.step * 3; const fb = ctx.createGain(); fb.gain.value = 0.42; const el = ctx.createBiquadFilter(); el.type = 'lowpass'; el.frequency.value = 1400;
    this.echo.connect(el).connect(fb).connect(this.echo); const eg = ctx.createGain(); eg.gain.value = 0.5; el.connect(eg).connect(this.master);
    this.bed = ctx.createGain(); this.bed.gain.value = 0.85; this.bed.connect(this.master);
    this.ui = ctx.createGain(); this.ui.gain.value = 0.9; this.ui.connect(this.master); const us = ctx.createGain(); us.gain.value = 0.3; this.ui.connect(us).connect(this.rev);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; this.noise = nb;
    this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, ctx.currentTime, 1.5);
    if (MUSIC_FILE) { const a = this.track = new Audio(MUSIC_FILE); a.loop = true; a.preload = 'auto'; const tg = ctx.createGain(); tg.gain.value = 0.8; ctx.createMediaElementSource(a).connect(tg).connect(ctx.destination); this.trackGain = tg; a.play().catch(() => {}); }
    else { this._drone(); this._seq(); }
  }
  set(on) { this.on = on; if (!this.ctx) return; if (on) this.ctx.resume(); if (this.track) { this.trackGain.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.2); if (on) this.track.play().catch(() => {}); } this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, on ? 0.6 : 0.1); }
  ok() { return this.ctx && this.on && this.ctx.state === 'running'; }
  _hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // Chill lounge bed, 88 BPM, C major: soft electric-piano chords (Fmaj7 - Em7 - Dm9 - G11, two bars each), a round sine bass,
  // a quiet kick and rim, a barely-there shaker and a sparse melody with echo. Nothing sharp, nothing loud.
  _drone() {
    const ctx = this.ctx;
    this.step = 60 / 88 / 4; this.echo.delayTime.value = this.step * 3;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.4;
    const trem = ctx.createGain(); trem.gain.value = 0.85; const lfo = ctx.createOscillator(); lfo.frequency.value = 4.2; const ld = ctx.createGain(); ld.gain.value = 0.1; lfo.connect(ld).connect(trem.gain); lfo.start();
    const eg = ctx.createGain(); eg.gain.value = 0.85; lp.connect(trem).connect(eg); eg.connect(this.bed); const er = ctx.createGain(); er.gain.value = 0.45; eg.connect(er).connect(this.rev);
    this.ep = lp; this.mel = ctx.createGain(); this.mel.gain.value = 1; this.mel.connect(lp); const me = ctx.createGain(); me.gain.value = 0.35; this.mel.connect(me).connect(this.echo);
    this.bassLp = ctx.createBiquadFilter(); this.bassLp.type = 'lowpass'; this.bassLp.frequency.value = 320; const bg = ctx.createGain(); bg.gain.value = 0.36; this.bassLp.connect(bg).connect(this.bed);
  }
  _seq() {
    const ctx = this.ctx, step = this.step;
    const CH = [[41, [53, 57, 60, 64]], [40, [52, 55, 59, 62]], [38, [50, 53, 57, 60, 64]], [43, [55, 60, 62, 65]]];
    const MEL = [[[4, 76], [10, 72]], [[2, 69], [12, 72]], [[4, 74], [10, 71]], [[2, 67]], [[4, 77], [8, 76], [12, 72]], [[6, 69]], [[4, 72], [10, 74], [14, 72]], [[4, 67]]];
    let n = 0, next = 0;
    setInterval(() => {
      if (ctx.state !== 'running') return;
      if (next < ctx.currentTime) next = ctx.currentTime + 0.05;
      while (next < ctx.currentTime + 0.3) {
        const s = n % 16, bar = Math.floor(n / 16), t = next + (s % 2 ? step * 0.12 : 0), [root, notes] = CH[(bar >> 1) % 4];
        if (s === 0) notes.forEach((m, i) => this._ep(m, t + i * 0.014, 2.6, 0.075, this.ep));
        if (s === 10 && bar % 2) notes.slice(1).forEach((m, i) => this._ep(m, t + i * 0.012, 1.4, 0.04, this.ep));
        if (s === 0) this._bass(root, t, 1.3); if (s === 8) this._bass(bar % 2 ? root + 7 : root, t, 0.8); if (s === 14 && bar % 2) this._bass(root + 5, t, 0.3);
        if (s === 0 || s === 8) this._kick(t, 0.28);
        if (s === 4 || s === 12) this._shot(t, 'bandpass', 1500, 2, 0.05, 0.028, this.rev);
        if (s % 2 === 0) this._shot(t, 'highpass', 8000, 0.7, 0.03, s % 4 === 2 ? 0.012 : 0.006);
        if (bar >= 4) MEL[bar % 8].forEach(([ms, m]) => { if (ms === s) this._ep(m, t, 1.6, 0.06, this.mel); });
        next += step; n++;
      }
    }, 50);
  }
  // soft electric-piano note: sine with a little second and third harmonic, quick attack, long gentle decay
  _ep(m, t, dur, g, dest) { const ctx = this.ctx, f = this._hz(m), e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.008); e.gain.exponentialRampToValueAtTime(g * 0.35, t + 0.3); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); [[1, 1], [2, 0.3], [3, 0.06]].forEach(([k, lv]) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * k; og.gain.value = lv; o.connect(og).connect(e); o.start(t); o.stop(t + dur + 0.05); }); e.connect(dest); }
  _bass(m, t, dur) { const ctx = this.ctx, e = ctx.createGain(), f = this._hz(m); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.5, t + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); [['sine', 1, 1], ['triangle', 2, 0.18]].forEach(([type, k, lv]) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * k; og.gain.value = lv; o.connect(og).connect(e); o.start(t); o.stop(t + dur + 0.05); }); e.connect(this.bassLp); }
  _kick(t, g) { const ctx = this.ctx, o = ctx.createOscillator(), e = ctx.createGain(); o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.08); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(g, t + 0.005); e.gain.exponentialRampToValueAtTime(0.001, t + 0.24); o.connect(e).connect(this.bed); o.start(t); o.stop(t + 0.26); }
  _shot(t, type, f, q, dur, g, dest) { const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const e = ctx.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl).connect(e).connect(dest || this.bed); s.start(t, Math.random()); s.stop(t + dur + 0.02); return fl; }
  _hat(t, g) { this._shot(t, 'highpass', 8000, 0.7, 0.03, g); }
  _clap(t) { [0, 0.011, 0.023].forEach(d => this._shot(t + d, 'bandpass', 1700, 1.2, 0.1, 0.3)); this._shot(t + 0.023, 'bandpass', 1700, 1, 0.24, 0.14, this.rev); }
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
  // section change: one soft breath of air that swells and fades. No tones.
  morph() {
    if (!this.ok()) return; const ctx = this.ctx, t = ctx.currentTime, n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), e = ctx.createGain();
    n.buffer = this.noise; f.type = 'bandpass'; f.Q.value = 0.7; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.22); f.frequency.exponentialRampToValueAtTime(1100, t + 0.6);
    e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(0.05, t + 0.2); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    n.connect(f).connect(e).connect(this.ui); n.start(t, Math.random()); n.stop(t + 0.65);
  }
}
