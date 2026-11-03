// PROTOTYPE, throwaway. Question: what should Wonkey Ear sound like?
// Neither prototype branch is about sound, so this adapts the UI one: several
// different voices, switched live and judged by ear. Rewrite the winning voices
// properly when folding them into the game.

export const DRONES = { warm: "Warm pad", organ: "Soft organ", shimmer: "Shimmer" } as const;
export const TONES = { pluck: "Pluck", glass: "Glass keys", lead: "Neon lead" } as const;

export type DroneVoice = keyof typeof DRONES;
export type ToneVoice = keyof typeof TONES;
export type Side = "above" | "below";

export interface Levels {
  master: number;
  drone: number;
  tone: number;
  space: number;
}

export const DEFAULT_LEVELS: Levels = { master: 0.8, drone: 0.3, tone: 1, space: 0.2 };

export const TONE_SECONDS = 1.5;
export const NOTE_BEAT = 0.75;

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Degree 1 always sits an octave from the tonic, because a unison vanishes into the drone.
export function degreeMidi(tonic: number, degree: number, side: Side): number {
  const semitones = MAJOR[degree - 1];
  if (side === "below") return tonic + semitones - 12;
  return tonic + (degree === 1 ? 12 : semitones);
}

export const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
export const midiName = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

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

export class SoundEngine {
  readonly analyser: AnalyserNode;
  private master: GainNode;
  private droneBus: GainNode;
  private droneGate: GainNode;
  private toneBus: GainNode;
  private spaceSend: GainNode;
  private held: { oscillators: OscillatorNode[]; out: GainNode } | null = null;

  constructor(
    readonly ctx: BaseAudioContext,
    levels: Levels,
  ) {
    this.master = ctx.createGain();
    this.droneBus = ctx.createGain();
    this.droneGate = ctx.createGain();
    this.toneBus = ctx.createGain();
    this.spaceSend = ctx.createGain();

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 3;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    const reverb = ctx.createConvolver();
    reverb.buffer = reverbImpulse(ctx);

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    this.droneGate.connect(this.droneBus).connect(this.master);
    this.toneBus.connect(this.master);
    this.toneBus.connect(this.spaceSend);
    this.spaceSend.connect(reverb).connect(this.master);
    this.master.connect(limiter).connect(this.analyser).connect(ctx.destination);

    this.setLevels(levels);
  }

  setLevels(levels: Levels) {
    this.master.gain.value = levels.master;
    this.droneBus.gain.value = levels.drone;
    this.toneBus.gain.value = levels.tone;
    this.spaceSend.gain.value = levels.space;
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

  private filter(type: BiquadFilterType, hz: number, q: number) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = hz;
    filter.Q.value = q;
    return filter;
  }

  // --- Drones: each should stay pleasant for many minutes. ---

  private warmDrone(hz: number, out: GainNode) {
    const lowpass = this.filter("lowpass", hz * 4, 0.4);
    lowpass.connect(out);
    return [
      this.osc("sine", hz, 0.33, out),
      this.osc("sawtooth", hz, 0.13, lowpass, -4),
      this.osc("sawtooth", hz, 0.13, lowpass, 4),
      this.osc("sine", 0.07, hz * 1.2, lowpass.frequency),
    ];
  }

  private organDrone(hz: number, out: GainNode) {
    const wave = this.ctx.createPeriodicWave(
      new Float32Array(6),
      new Float32Array([0, 1, 0.5, 0.25, 0.12, 0.06]),
    );
    const osc = this.osc("sine", hz, 0.42, out);
    osc.setPeriodicWave(wave);
    return [osc];
  }

  private shimmerDrone(hz: number, out: GainNode) {
    const oscillators = [this.osc("triangle", hz, 0.42, out)];
    const bands: [number, number][] = [
      [3, 0.05],
      [6, 0.083],
    ];
    for (const [harmonic, rate] of bands) {
      const band = this.filter("bandpass", hz * harmonic, 6);
      const swell = this.ctx.createGain();
      swell.gain.value = 0.5;
      band.connect(swell).connect(out);
      oscillators.push(this.osc("sawtooth", hz, 0.75, band));
      oscillators.push(this.osc("sine", rate, 0.5, swell.gain));
    }
    return oscillators;
  }

  startDrone(voice: DroneVoice, midi: number, when = this.now(), fadeIn = 1.2) {
    this.stopDrone(0.5);
    const hz = midiHz(midi);
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0, when);
    out.gain.linearRampToValueAtTime(1, when + fadeIn);
    out.connect(this.droneGate);
    const oscillators =
      voice === "warm" ? this.warmDrone(hz, out) : voice === "organ" ? this.organDrone(hz, out) : this.shimmerDrone(hz, out);
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

  // Hard mode: fades the held drone without restarting it.
  gateDrone(open: boolean, fade = 1.2, when = this.now()) {
    this.droneGate.gain.cancelScheduledValues(when);
    this.droneGate.gain.setTargetAtTime(open ? 1 : 0, when, fade / 3);
  }

  // --- Guess tones: each should stand out from any drone. ---

  playTone(voice: ToneVoice, midi: number, when = this.now(), seconds = TONE_SECONDS) {
    const hz = midiHz(midi);
    const end = when + seconds;
    if (voice === "pluck") this.pluckTone(hz, when, end);
    else if (voice === "glass") this.glassTone(hz, when, end);
    else this.leadTone(hz, when, end);
  }

  private pluckTone(hz: number, t: number, end: number) {
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.5, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.03, end - 0.1);
    amp.gain.linearRampToValueAtTime(0, end);
    const lowpass = this.filter("lowpass", hz, 2);
    lowpass.frequency.setValueAtTime(Math.min(hz * 12, 12000), t);
    lowpass.frequency.exponentialRampToValueAtTime(hz * 2.5, t + 0.35);
    lowpass.connect(amp).connect(this.toneBus);
    // The detune is symmetrical so the note stays centred on its true pitch.
    for (const osc of [
      this.osc("sawtooth", hz, 0.35, lowpass, -2),
      this.osc("sawtooth", hz, 0.35, lowpass, 2),
      this.osc("square", hz, 0.3, lowpass),
    ]) {
      osc.start(t);
      osc.stop(end + 0.05);
    }
  }

  private glassTone(hz: number, t: number, end: number) {
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.5, t + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.03, end - 0.1);
    amp.gain.linearRampToValueAtTime(0, end);
    amp.connect(this.toneBus);
    const carrier = this.osc("sine", hz, 1, amp);
    const body = this.ctx.createGain();
    body.gain.setValueAtTime(hz * 2.2, t);
    body.gain.exponentialRampToValueAtTime(hz * 0.8, t + 0.6);
    const tine = this.ctx.createGain();
    tine.gain.setValueAtTime(hz * 2.5, t);
    tine.gain.exponentialRampToValueAtTime(1, t + 0.09);
    body.connect(carrier.frequency);
    tine.connect(carrier.frequency);
    for (const osc of [carrier, this.osc("sine", hz * 2, 1, body), this.osc("sine", hz * 7, 1, tine)]) {
      osc.start(t);
      osc.stop(end + 0.05);
    }
  }

  private leadTone(hz: number, t: number, end: number) {
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.25, t + 0.012);
    amp.gain.setValueAtTime(0.25, end - 0.3);
    amp.gain.linearRampToValueAtTime(0, end);
    const lowpass = this.filter("lowpass", Math.max(hz * 4, 900), 0.7);
    lowpass.connect(amp).connect(this.toneBus);
    for (const osc of [
      this.osc("square", hz, 0.6, lowpass),
      this.osc("sawtooth", hz, 0.2, lowpass, -4),
      this.osc("sawtooth", hz, 0.2, lowpass, 4),
    ]) {
      osc.start(t);
      osc.stop(end + 0.05);
    }
  }

  // --- 1-5-1: single notes in the guess tone's voice, at the pitches the game asks about. ---

  playOneFiveOne(voice: ToneVoice, tonic: number, when = this.now()) {
    [1, 5, 1].forEach((degree, i) => {
      // Each note ends before the next starts, so two never sound together.
      const seconds = i === 2 ? NOTE_BEAT * 2 : NOTE_BEAT - 0.05;
      this.playTone(voice, degreeMidi(tonic, degree, "above"), when + i * NOTE_BEAT, seconds);
    });
  }
}
