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

    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.55;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 1500;
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

  // Slow overlapping chords: each note fades in over ~4 s and out over ~7 s
  _music() {
    const hz = n => 440 * Math.pow(2, (n - 69) / 12);
    const chords = [[48, 55, 62, 64], [45, 52, 60, 64], [41, 53, 57, 64], [43, 55, 59, 62]];
    let i = 0;
    const play = () => {
      if (this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime + 0.05;
      chords[i++ % chords.length].forEach((n, k) => this._note(hz(n), t + k * 0.35, 0.05));
      if (i % 2 === 0) this._note(hz([72, 76, 79, 74][(i / 2) % 4]), t + 5, 0.018);
    };
    play();
    this.musicTimer = setInterval(play, 11000);
  }
  _note(f, t, peak) {
    const ctx = this.ctx, g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 4);
    g.gain.setValueAtTime(peak, t + 8);
    g.gain.linearRampToValueAtTime(0.0001, t + 15);
    const a = ctx.createOscillator(); a.type = 'sine'; a.frequency.value = f;
    const b = ctx.createOscillator(); b.type = 'triangle'; b.frequency.value = f * 1.003;
    const bg = ctx.createGain(); bg.gain.value = 0.35;
    a.connect(g); b.connect(bg).connect(g); g.connect(this.musicBus);
    a.start(t); b.start(t); a.stop(t + 15.2); b.stop(t + 15.2);
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
