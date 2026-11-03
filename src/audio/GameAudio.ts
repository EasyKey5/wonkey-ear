import { degreeMidi, midiHz } from "../game/notes";

// The sound approved in the sound prototype: Warm pad drone and Pluck tone at this balance.
const DRONE_LEVEL = 0.3;
const SPACE_LEVEL = 0.2;
export const DEFAULT_VOLUME = 0.8;

export const TONE_SECONDS = 1.5;
export const NOTE_BEAT = 0.75;
export const ONE_FIVE_ONE = [1, 5, 1];

function reverbImpulse(ctx: BaseAudioContext, seconds = 1.4): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
  }
  return buffer;
}

export class GameAudio {
  private master: GainNode;
  private droneGate: GainNode;
  private toneBus: GainNode;
  private held: { oscillators: OscillatorNode[]; out: GainNode } | null = null;

  // Must run inside a click or tap, or the browser keeps the audio blocked.
  static async forBrowser(): Promise<GameAudio> {
    // Without this, an iPhone on silent plays nothing at all.
    const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (audioSession) audioSession.type = "playback";
    const ctx = new AudioContext();
    await ctx.resume();
    return new GameAudio(ctx);
  }

  constructor(readonly ctx: BaseAudioContext) {
    this.master = ctx.createGain();
    this.master.gain.value = DEFAULT_VOLUME;

    this.droneGate = ctx.createGain();
    const droneBus = ctx.createGain();
    droneBus.gain.value = DRONE_LEVEL;

    this.toneBus = ctx.createGain();
    const spaceSend = ctx.createGain();
    spaceSend.gain.value = SPACE_LEVEL;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 3;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    const reverb = ctx.createConvolver();
    reverb.buffer = reverbImpulse(ctx);

    this.droneGate.connect(droneBus).connect(this.master);
    this.toneBus.connect(this.master);
    this.toneBus.connect(spaceSend).connect(reverb).connect(this.master);
    this.master.connect(limiter).connect(ctx.destination);
  }

  setVolume(volume: number) {
    this.master.gain.value = volume;
  }

  // Suspending freezes the audio clock, which also freezes anything using wait().
  async setPaused(paused: boolean) {
    if (!(this.ctx instanceof AudioContext)) return;
    if (paused) await this.ctx.suspend();
    else await this.ctx.resume();
  }

  // Waits on the audio clock, so the game's pacing stays locked to what's heard.
  wait(seconds: number, signal: AbortSignal): Promise<void> {
    const until = this.ctx.currentTime + seconds;
    return new Promise((resolve, reject) => {
      const tick = () => {
        if (signal.aborted) reject(signal.reason);
        else if (this.ctx.currentTime >= until) resolve();
        else setTimeout(tick, 15);
      };
      tick();
    });
  }

  private now() {
    return this.ctx.currentTime + 0.02;
  }

  private osc(type: OscillatorType, hz: number, gain: number, dest: AudioNode | AudioParam, detune = 0) {
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = hz;
    osc.detune.value = detune;
    amp.gain.value = gain;
    osc.connect(amp);
    amp.connect(dest as AudioNode);
    return osc;
  }

  private lowpass(hz: number, q: number) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = hz;
    filter.Q.value = q;
    return filter;
  }

  startDrone(midi: number, when = this.now(), fadeIn = 1.2) {
    this.stopDrone(0.5);
    const hz = midiHz(midi);
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(1, when + fadeIn);
    out.connect(this.droneGate);
    const filter = this.lowpass(hz * 4, 0.4);
    filter.connect(out);
    const oscillators = [
      this.osc("sine", hz, 0.33, out),
      this.osc("sawtooth", hz, 0.13, filter, -4),
      this.osc("sawtooth", hz, 0.13, filter, 4),
      this.osc("sine", 0.07, hz * 1.2, filter.frequency),
    ];
    for (const osc of oscillators) osc.start(when);
    this.held = { oscillators, out };
  }

  stopDrone(fade = 0.8) {
    if (!this.held) return;
    const { oscillators, out } = this.held;
    const now = this.ctx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setValueAtTime(out.gain.value, now);
    out.gain.linearRampToValueAtTime(0, now + fade);
    for (const osc of oscillators) osc.stop(now + fade + 0.05);
    this.held = null;
  }

  // Fades the held drone in or out without restarting it, for hard mode.
  setDroneAudible(audible: boolean, fade = 1.2, when = this.now()) {
    this.droneGate.gain.cancelScheduledValues(when);
    this.droneGate.gain.setTargetAtTime(audible ? 1 : 0, when, fade / 3);
  }

  playNote(midi: number, when = this.now(), seconds = TONE_SECONDS) {
    const hz = midiHz(midi);
    const end = when + seconds;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(0.5, when + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.03, end - 0.1);
    amp.gain.linearRampToValueAtTime(0, end);
    const filter = this.lowpass(hz, 2);
    filter.frequency.setValueAtTime(Math.min(hz * 12, 12000), when);
    filter.frequency.exponentialRampToValueAtTime(hz * 2.5, when + 0.35);
    filter.connect(amp).connect(this.toneBus);
    // The detune is symmetrical so the note stays centred on its true pitch.
    for (const osc of [
      this.osc("sawtooth", hz, 0.35, filter, -2),
      this.osc("sawtooth", hz, 0.35, filter, 2),
      this.osc("square", hz, 0.3, filter),
    ]) {
      osc.start(when);
      osc.stop(end + 0.05);
    }
  }

  playOneFiveOne(tonic: number, when = this.now()) {
    ONE_FIVE_ONE.forEach((degree, i) => {
      // Each note ends before the next starts, so two never sound together.
      const seconds = i === ONE_FIVE_ONE.length - 1 ? NOTE_BEAT * 2 : NOTE_BEAT - 0.05;
      this.playNote(degreeMidi(tonic, degree, "above"), when + i * NOTE_BEAT, seconds);
    });
  }
}
