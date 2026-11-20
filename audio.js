// Procedural sound design (Web Audio API): no audio files, nothing licensed.
// Ambient score + plant hum + diesel engine tied to truck speed + crane winch + UI ticks.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.started = false;
  }

  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.started = true;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // Voicing EQ: trim sub-bass, lift mids so laptop/phone speakers carry it
    const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 140; low.gain.value = -7;
    const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 900; mid.Q.value = 0.8; mid.gain.value = 7;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(low).connect(mid).connect(comp).connect(ctx.destination);
    this.out = comp;

    // Shared reverb (generated impulse response)
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(3.8, 2.6);
    const revGain = ctx.createGain(); revGain.gain.value = 0.55;
    this.reverb.connect(revGain).connect(this.master);

    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.75;
    this.musicBus.connect(this.master);
    this.musicBus.connect(this.reverb);

    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.8;
    this.sfxBus.connect(this.master);
    const sfxSend = ctx.createGain(); sfxSend.gain.value = 0.25;
    this.sfxBus.connect(sfxSend).connect(this.reverb);

    this.noiseBuf = this._noiseBuffer(4, 'brown');
    this.whiteBuf = this._noiseBuffer(2, 'white');

    this._buildPad();
    this._buildHum();
    this._buildEngine();
    this._buildWinch();
    this._scheduleMusic();
  }

  resume() {
    if (this.ctx && this.enabled && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.start();
    if (!this.ctx) return;
    if (on) {
      this.ctx.resume().catch(() => {});
      // Unlock on mobile: play a short silent buffer inside the user gesture
      const b = this.ctx.createBufferSource(); b.buffer = this.ctx.createBuffer(1, 1, 22050);
      b.connect(this.ctx.destination); b.start(0);
    }
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, t, on ? 0.8 : 0.15);
  }

  // ---------- building blocks ----------
  _noiseBuffer(sec, type) {
    const ctx = this.ctx, len = sec * ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return buf;
  }
  _impulse(sec, decay) {
    const ctx = this.ctx, len = sec * ctx.sampleRate;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  _loopNoise(buf) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = true; s.start();
    return s;
  }

  // Warm detuned pad, chords change on a schedule
  _buildPad() {
    const ctx = this.ctx;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 1400; this.padFilter.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 450;
    lfo.connect(lfoAmt).connect(this.padFilter.frequency); lfo.start();
    this.padGain = ctx.createGain(); this.padGain.gain.value = 0.26;
    this.padFilter.connect(this.padGain).connect(this.musicBus);
    this.voices = [];
    for (let i = 0; i < 4; i++) {
      const g = ctx.createGain(); g.gain.value = 0.25;
      const oscs = [-7, 7].map(det => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = det;
        o.frequency.value = 110; o.connect(g); o.start(); return o;
      });
      g.connect(this.padFilter);
      this.voices.push(oscs);
    }
    // Sub drone
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 36.71; // D1
    const subG = ctx.createGain(); subG.gain.value = 0.06;
    sub.connect(subG).connect(this.musicBus); sub.start();
    this.sub = sub;
  }

  _scheduleMusic() {
    const midi = n => 440 * Math.pow(2, (n - 69) / 12);
    // D minor, slow and wide: Dm9, Bbmaj7, Fmaj7, C(add9)
    const chords = [[62, 69, 76, 77], [58, 65, 69, 74], [53, 65, 69, 76], [60, 67, 74, 79]];
    const roots = [38, 34, 41, 36];
    const scale = [74, 76, 77, 81, 84, 86, 88, 89, 93];
    let idx = 0;
    const step = () => {
      const t = this.ctx.currentTime;
      const ch = chords[idx % chords.length];
      this.voices.forEach((oscs, i) => oscs.forEach(o => o.frequency.setTargetAtTime(midi(ch[i]), t, 1.2)));
      this.sub.frequency.setTargetAtTime(midi(roots[idx % roots.length] - 12), t, 1.5);
      idx++;
      // Sparse bell plucks over the pad
      const n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const when = t + 0.6 + k * (1.4 + Math.random() * 1.6);
        this._bell(midi(scale[Math.floor(Math.random() * scale.length)]), when);
      }
    };
    step();
    this.musicTimer = setInterval(step, 8000);
  }

  _bell(freq, when) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.01;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.09, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 3.2);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2).connect(g);
    g.connect(this.musicBus);
    o.start(when); o2.start(when); o.stop(when + 3.3); o2.stop(when + 3.3);
  }

  // Refinery hum: brown noise band + 60 Hz electrical buzz
  _buildHum() {
    const ctx = this.ctx;
    const src = this._loopNoise(this.noiseBuf);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 0.6;
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0.05;
    src.connect(bp).connect(this.humGain).connect(this.sfxBus);
    const buzz = ctx.createOscillator(); buzz.type = 'triangle'; buzz.frequency.value = 60;
    this.buzzGain = ctx.createGain(); this.buzzGain.gain.value = 0;
    buzz.connect(this.buzzGain).connect(this.sfxBus); buzz.start();
    // Flare roar
    const fsrc = this._loopNoise(this.noiseBuf);
    const flp = ctx.createBiquadFilter(); flp.type = 'lowpass'; flp.frequency.value = 400;
    this.flareGain = ctx.createGain(); this.flareGain.gain.value = 0;
    fsrc.connect(flp).connect(this.flareGain).connect(this.sfxBus);
  }

  // Diesel: low saw + pulse with filter that opens with load
  _buildEngine() {
    const ctx = this.ctx;
    this.engOsc = ctx.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 32;
    this.engOsc2 = ctx.createOscillator(); this.engOsc2.type = 'square'; this.engOsc2.frequency.value = 16;
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 400; this.engFilter.Q.value = 2;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    this.engOsc.connect(this.engFilter);
    this.engOsc2.connect(g2).connect(this.engFilter);
    // Tire/road noise
    const road = this._loopNoise(this.noiseBuf);
    const rbp = ctx.createBiquadFilter(); rbp.type = 'bandpass'; rbp.frequency.value = 500; rbp.Q.value = 0.5;
    this.roadGain = ctx.createGain(); this.roadGain.gain.value = 0;
    road.connect(rbp).connect(this.roadGain).connect(this.sfxBus);
    this.engFilter.connect(this.engGain).connect(this.sfxBus);
    // Mid-range growl so phone speakers can reproduce the engine
    this.engOsc3 = ctx.createOscillator(); this.engOsc3.type = 'sawtooth'; this.engOsc3.frequency.value = 220;
    const bp3 = ctx.createBiquadFilter(); bp3.type = 'bandpass'; bp3.frequency.value = 650; bp3.Q.value = 0.9;
    const g3 = ctx.createGain(); g3.gain.value = 0.55;
    this.engOsc3.connect(bp3).connect(g3).connect(this.engGain);
    this.engOsc.start(); this.engOsc2.start(); this.engOsc3.start();
  }

  _buildWinch() {
    const ctx = this.ctx;
    this.winchOsc = ctx.createOscillator(); this.winchOsc.type = 'square'; this.winchOsc.frequency.value = 110;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 4;
    this.winchGain = ctx.createGain(); this.winchGain.gain.value = 0;
    this.winchOsc.connect(bp).connect(this.winchGain).connect(this.sfxBus);
    this.winchOsc.start();
  }

  // ---------- per-frame scene coupling ----------
  update({ truckSpeed = 0, truckNear = 0, winch = 0, flare = 0, plant = 0 }) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime, k = 0.12;
    const s = Math.min(1, truckSpeed);
    const near = Math.max(0, Math.min(1, truckNear));
    this.engGain.gain.setTargetAtTime((0.12 + 0.3 * s) * near, t, k);
    this.engOsc.frequency.setTargetAtTime(55 + 55 * s, t, 0.25);
    this.engOsc2.frequency.setTargetAtTime(27.5 + 27.5 * s, t, 0.25);
    this.engOsc3.frequency.setTargetAtTime(220 + 220 * s, t, 0.25);
    this.engFilter.frequency.setTargetAtTime(380 + 900 * s, t, 0.2);
    this.roadGain.gain.setTargetAtTime(0.16 * s * near, t, k);
    this.winchGain.gain.setTargetAtTime(winch > 0 ? 0.06 : 0, t, 0.08);
    this.winchOsc.frequency.setTargetAtTime(90 + 60 * winch, t, 0.1);
    this.flareGain.gain.setTargetAtTime(0.12 * flare, t, 0.3);
    this.humGain.gain.setTargetAtTime(0.04 + 0.08 * plant, t, 0.4);
    this.buzzGain.gain.setTargetAtTime(0.006 * plant, t, 0.4);
  }

  // ---------- one-shots ----------
  _noiseHit(dur, type, freq, q, gain, sweepTo) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.whiteBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfxBus);
    s.start(t); s.stop(t + dur + 0.05);
  }
  hover() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(2400, t); o.frequency.exponentialRampToValueAtTime(1600, t + 0.05);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + 0.08);
  }
  click() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(1100, t); o.frequency.exponentialRampToValueAtTime(260, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + 0.25);
    this._noiseHit(0.05, 'highpass', 3000, 0.7, 0.06);
  }
  whoosh() { this._noiseHit(1.0, 'bandpass', 500, 1.0, 0.14, 3200); }
  airBrake() { this._noiseHit(0.9, 'highpass', 2500, 0.5, 0.22, 5000); }
  clank() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [180, 431, 797].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.09 / (i + 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + 1);
    });
    this._noiseHit(0.12, 'lowpass', 900, 0.7, 0.12);
  }
}
