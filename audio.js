// Procedural sound design (Web Audio API): no audio files, nothing licensed.
// Calm ambient pad + soft plant ambience + noise-based diesel + gentle UI ticks.

export class SoundEngine {
  constructor() { this.ctx = null; this.enabled = false; this.started = false; }

  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.started = true;

    this.master = ctx.createGain(); this.master.gain.value = 0;
    const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 110; low.gain.value = -4;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3;
    this.master.connect(low).connect(comp).connect(ctx.destination);
    this.out = comp;

    this.reverb = ctx.createConvolver(); this.reverb.buffer = this._impulse(4.5, 2.2);
    const rev = ctx.createGain(); rev.gain.value = 0.6;
    this.reverb.connect(rev).connect(this.master);

    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.7;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3200;
    this.musicBus.connect(tone); tone.connect(this.master); tone.connect(this.reverb);

    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.6;
    this.sfxBus.connect(this.master);
    const send = ctx.createGain(); send.gain.value = 0.2; this.sfxBus.connect(send).connect(this.reverb);

    this.brown = this._noise(4, true);
    this.white = this._noise(2, false);
    this._ambience(); this._engine(); this._winch(); this._music();
  }

  resume() { if (this.ctx && this.enabled && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.start();
    if (!this.ctx) return;
    if (on) {
      this.ctx.resume().catch(() => {});
      const b = this.ctx.createBufferSource(); b.buffer = this.ctx.createBuffer(1, 1, 22050); b.connect(this.ctx.destination); b.start(0);
    }
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, t, on ? 1.2 : 0.12);
  }

  _noise(sec, brown) {
    const len = sec * this.ctx.sampleRate, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return buf;
  }
  _impulse(sec, decay) {
    const len = sec * this.ctx.sampleRate, buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return buf;
  }
  _loop(buf) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }

  // Chill lounge-house loop, 112 BPM: soft four-on-the-floor kick, offbeat hats, snap on 2 and 4,
  // warm electric-piano chord stabs, round bass, gentle sidechain pump. All synthesized.
  _music() {
    const ctx = this.ctx;
    this.drumBus = ctx.createGain(); this.drumBus.gain.value = 0.5; this.drumBus.connect(this.master);
    this.pump = ctx.createGain(); this.pump.connect(this.musicBus);
    const step = 60 / 112 / 4;
    const chords = [[50, 57, 60, 64, 65], [43, 59, 62, 64, 65], [48, 55, 59, 62, 64], [45, 55, 59, 60, 64]]; // Dm9, G13, Cmaj9, Am9
    let n = 0, next = 0;
    const tick = () => {
      if (ctx.state !== 'running') return;
      if (next < ctx.currentTime) next = ctx.currentTime + 0.05;
      while (next < ctx.currentTime + 0.25) {
        const s = n % 16, ch = chords[Math.floor(n / 16) % 4], t = next;
        if (s % 4 === 0) this._kick(t);
        if (s % 4 === 2) this._hat(t, 0.06, 0.05); else if (s % 2 === 1) this._hat(t, 0.018, 0.03);
        if (s === 4 || s === 12) this._snap(t);
        if (s === 0) ch.slice(1).forEach(m => this._tone(m + 12, t, step * 15, 0.012, 'sine', 1.2));           // pad
        if (s === 3 || s === 6 || s === 11) ch.slice(1).forEach(m => this._tone(m, t, 0.45, 0.04, 'triangle', 0.01)); // keys
        if (s === 2 || s === 7 || s === 10 || s === 14) this._bass(ch[0] - 12, t, s === 7 ? step * 1.5 : step * 2.5);
        next += step; n++;
      }
    };
    this.musicTimer = setInterval(tick, 60);
  }
  _hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  _kick(t) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(this.drumBus); o.start(t); o.stop(t + 0.32);
    this.pump.gain.cancelScheduledValues(t); this.pump.gain.setValueAtTime(0.45, t); this.pump.gain.linearRampToValueAtTime(1, t + 0.3);
  }
  _noiseShot(t, type, freq, q, dur, gain) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.white;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.drumBus); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  _hat(t, gain, dur) { this._noiseShot(t, 'highpass', 7500, 0.7, dur, gain); }
  _snap(t) { this._noiseShot(t, 'bandpass', 1700, 1.2, 0.13, 0.11); }
  _tone(m, t, dur, peak, type, attack) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = this._hz(m);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    o.connect(g).connect(this.pump); o.start(t); o.stop(t + attack + dur + 0.05);
  }
  _bass(m, t, dur) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    ['sine', 'triangle'].forEach((type, i) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = this._hz(m + i * 12); o.connect(lp); o.start(t); o.stop(t + dur + 0.05); });
    lp.connect(g).connect(this.pump);
  }

  _ambience() {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0.02;
    this._loop(this.brown).connect(lp).connect(this.humGain).connect(this.sfxBus);
    const flp = ctx.createBiquadFilter(); flp.type = 'lowpass'; flp.frequency.value = 350;
    this.flareGain = ctx.createGain(); this.flareGain.gain.value = 0;
    this._loop(this.brown).connect(flp).connect(this.flareGain).connect(this.sfxBus);
  }

  // Diesel: filtered noise chopped by a slow LFO (no pitched tones, so nothing siren-like)
  _engine() {
    const ctx = this.ctx;
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 260;
    const am = ctx.createGain(); am.gain.value = 0.6;
    this.engLfo = ctx.createOscillator(); this.engLfo.type = 'sine'; this.engLfo.frequency.value = 18;
    const depth = ctx.createGain(); depth.gain.value = 0.4;
    this.engLfo.connect(depth).connect(am.gain); this.engLfo.start();
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this._loop(this.brown).connect(this.engFilter).connect(am).connect(this.engGain).connect(this.sfxBus);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.4;
    this.roadGain = ctx.createGain(); this.roadGain.gain.value = 0;
    this._loop(this.brown).connect(bp).connect(this.roadGain).connect(this.sfxBus);
  }
  _winch() {
    const ctx = this.ctx, bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 2.5;
    this.winchGain = ctx.createGain(); this.winchGain.gain.value = 0;
    this._loop(this.brown).connect(bp).connect(this.winchGain).connect(this.sfxBus);
  }

  update({ truckSpeed = 0, truckNear = 0, winch = 0, flare = 0, plant = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime, s = Math.min(1, truckSpeed), near = Math.max(0, Math.min(1, truckNear));
    this.engGain.gain.setTargetAtTime((0.1 + 0.22 * s) * near, t, 0.25);
    this.engLfo.frequency.setTargetAtTime(16 + 16 * s, t, 0.4);
    this.engFilter.frequency.setTargetAtTime(240 + 420 * s, t, 0.3);
    this.roadGain.gain.setTargetAtTime(0.1 * s * near, t, 0.25);
    this.winchGain.gain.setTargetAtTime(winch > 0 ? 0.12 : 0, t, 0.15);
    this.flareGain.gain.setTargetAtTime(0.06 * flare, t, 0.4);
    this.humGain.gain.setTargetAtTime(0.02 + 0.04 * plant, t, 0.5);
  }

  _hit(dur, type, freq, q, gain, sweepTo) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = this.white;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfxBus); s.start(t); s.stop(t + dur + 0.05);
  }
  _blip(f0, f1, dur, gain) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  hover() { this._blip(1300, 1000, 0.05, 0.03); }
  click() { this._blip(620, 300, 0.09, 0.16); this._hit(0.03, 'highpass', 2500, 0.7, 0.03); }
  whoosh() { this._hit(0.9, 'bandpass', 400, 0.8, 0.04, 1600); }
  airBrake() { this._hit(0.8, 'highpass', 2200, 0.5, 0.1, 4500); }
  clank() { this._blip(240, 180, 0.5, 0.07); this._hit(0.1, 'lowpass', 800, 0.7, 0.08); }
}
