/**
 * Tone output for buzzers and speakers.
 *
 * One shared AudioContext with one oscillator per sounding part. Browsers only
 * allow audio after a user gesture, so the context is created lazily on the
 * first request and silently stays suspended until the user has clicked
 * something — pressing Start Simulation counts.
 */

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
  frequency: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private voices = new Map<string, Voice>();
  private master: GainNode | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Start or retune a voice. `amplitude` is 0–1 and scales the volume. */
  play(id: string, frequency: number, amplitude = 1, wave: OscillatorType = 'square') {
    if (this.muted || !Number.isFinite(frequency) || frequency < 20 || frequency > 20000) {
      return this.stop(id);
    }
    const ctx = this.ensure();
    if (!ctx || !this.master) return;

    let v = this.voices.get(id);
    if (!v) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      v = { osc, gain, frequency: 0 };
      this.voices.set(id, v);
    }
    if (Math.abs(v.frequency - frequency) > 0.5) {
      v.osc.frequency.setTargetAtTime(frequency, ctx.currentTime, 0.005);
      v.frequency = frequency;
    }
    v.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, amplitude)), ctx.currentTime, 0.01);
  }

  stop(id: string) {
    const v = this.voices.get(id);
    if (!v || !this.ctx) return;
    // Fade to silence, then actually tear the voice down. Without the
    // teardown a long piezo melody (or a debug/replay loop) stacks hundreds
    // of orphan OscillatorNode + GainNode pairs for the rest of the tab.
    v.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    this.voices.delete(id);
    const { osc, gain } = v;
    window.setTimeout(() => {
      try {
        osc.stop();
      } catch {
        // already stopped
      }
      osc.disconnect();
      gain.disconnect();
    }, 60);
  }

  stopAll() {
    // Snapshot keys because stop() mutates the map.
    for (const id of Array.from(this.voices.keys())) this.stop(id);
  }

  dispose() {
    for (const v of this.voices.values()) {
      try {
        v.osc.stop();
      } catch {
        // already stopped
      }
      v.osc.disconnect();
      v.gain.disconnect();
    }
    this.voices.clear();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}

export const audio = new AudioEngine();

// Silence every voice whenever the tab is backgrounded. A piezo playing a
// melody while the tab is hidden is disorientating and — on iOS — will keep
// running even after the tab closes.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.stopAll();
  });
  // A hard nav or a tab close should never leave a voice ringing either.
  window.addEventListener('pagehide', () => audio.stopAll());
}
