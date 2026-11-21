// SOLMAR — procedural WebAudio sound. No audio files: every sound is built
// from oscillators and noise buffers at runtime. The engine hum follows the
// car's speed, the siren wails in two tones while wanted, and short blips
// mark pickups, crashes and mission moments.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.muted = false;
    this.started = false;
  }

  // Browsers only allow audio after a user gesture; call from the first click/key.
  ensure() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine hum: a low sawtooth whose pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: a square wave that alternates between two tones.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.started = true;
    } catch {
      this.started = false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.value = muted ? 0 : 0.5;
    }
  }

  // Called every frame: speedRatio 0..1 while driving, wantedStars 0..5.
  update(speedRatio, wantedStars) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.engineOsc) {
      this.engineOsc.frequency.setTargetAtTime(50 + speedRatio * 140, t, 0.08);
      this.engineGain.gain.setTargetAtTime(speedRatio > 0.02 ? 0.05 + speedRatio * 0.05 : 0, t, 0.1);
    }
    if (this.sirenOsc) {
      if (wantedStars > 0 && !this.muted) {
        this.sirenTimer += 1 / 60;
        const hi = Math.floor(this.sirenTimer * 2) % 2 === 0;
        this.sirenOsc.frequency.setTargetAtTime(hi ? 880 : 620, t, 0.05);
        this.sirenGain.gain.setTargetAtTime(0.035, t, 0.1);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, t, 0.1);
      }
    }
  }

  blip(freq, dur, type, vol) {
    if (!this.started || !this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  pickup() {
    this.blip(880, 0.12, 'sine', 0.2);
    setTimeout(() => this.blip(1320, 0.16, 'sine', 0.2), 90);
  }

  crash(strength) {
    if (!this.started || !this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const dur = 0.18 + Math.min(0.25, strength * 0.02);
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    const g = this.ctx.createGain();
    g.gain.value = Math.min(0.5, 0.15 + strength * 0.03);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  punch() {
    this.blip(180, 0.08, 'square', 0.12);
  }

  jingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.22, 'triangle', 0.22), i * 130);
    });
  }

  busted() {
    const notes = [392, 330, 262];
    notes.forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.12), i * 180);
    });
  }
}
