// PROTOTYPE, throwaway. Measures what can be measured without ears: levels, clipping,
// pitch accuracy, and how much of a sound survives on a small speaker.
// Run from the browser console with: await wonkeySignalCheck()

import {
  DEFAULT_LEVELS,
  degreeMidi,
  DRONES,
  midiHz,
  NOTE_BEAT,
  SoundEngine,
  TONE_SECONDS,
  TONES,
  type DroneVoice,
  type Levels,
  type Side,
  type ToneVoice,
} from "./synth";

const SAMPLE_RATE = 44100;
const LEVELS: Levels = { master: 1, drone: 1, tone: 1, space: 0 };

async function render(seconds: number, build: (engine: SoundEngine) => void, levels = LEVELS) {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  build(new SoundEngine(ctx, levels));
  return (await ctx.startRendering()).getChannelData(0);
}

const db = (value: number) => Math.round(20 * Math.log10(Math.max(value, 1e-6)) * 10) / 10;

function stats(samples: Float32Array, from = 0) {
  let peak = 0;
  let sum = 0;
  let squares = 0;
  for (let i = from; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i]));
    sum += samples[i];
    squares += samples[i] ** 2;
  }
  const count = samples.length - from;
  return { peakDb: db(peak), rmsDb: db(Math.sqrt(squares / count)), dc: Math.round((sum / count) * 1e4) / 1e4 };
}

// Two cascaded biquads stand in for a phone speaker's bass roll-off.
async function smallSpeakerLossDb(samples: Float32Array) {
  const ctx = new OfflineAudioContext(1, samples.length, SAMPLE_RATE);
  const buffer = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
  buffer.getChannelData(0).set(samples);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  let node: AudioNode = source;
  for (let i = 0; i < 2; i++) {
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 300;
    node = node.connect(highpass);
  }
  node.connect(ctx.destination);
  source.start();
  const filtered = await ctx.startRendering();
  const rms = (data: Float32Array) => Math.sqrt(data.reduce((total, x) => total + x * x, 0) / data.length);
  return Math.round((db(rms(filtered.getChannelData(0))) - db(rms(samples))) * 10) / 10;
}

// YIN pitch estimate, so tuning is measured from the audio and not read off the code.
function estimateHz(samples: Float32Array, start: number) {
  const window = 8192;
  const maxLag = Math.floor(SAMPLE_RATE / 40);
  const minLag = Math.floor(SAMPLE_RATE / 1500);
  const diff = new Float64Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    for (let i = 0; i < window; i++) {
      diff[lag] += (samples[start + i] - samples[start + i + lag]) ** 2;
    }
  }
  const normal = new Float64Array(maxLag + 1).fill(1);
  let running = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    running += diff[lag];
    normal[lag] = running > 0 ? (diff[lag] * lag) / running : 1;
  }
  let best = -1;
  for (let lag = minLag; lag < maxLag; lag++) {
    if (normal[lag] < 0.15) {
      while (lag + 1 < maxLag && normal[lag + 1] < normal[lag]) lag++;
      best = lag;
      break;
    }
  }
  if (best < 0) return NaN;
  const [a, b, c] = [normal[best - 1], normal[best], normal[best + 1]];
  return SAMPLE_RATE / (best + (a - c) / (2 * (a - 2 * b + c)));
}

export async function wonkeySignalCheck() {
  const drones: Record<string, unknown> = {};
  for (const voice of Object.keys(DRONES) as DroneVoice[]) {
    const low = await render(20, (engine) => engine.startDrone(voice, 48, 0));
    const high = await render(20, (engine) => engine.startDrone(voice, 59, 0));
    const from = SAMPLE_RATE * 2;
    const cents = (samples: Float32Array, midi: number) =>
      Math.round(1200 * Math.log2(estimateHz(samples, from) / midiHz(midi)) * 10) / 10;
    drones[voice] = {
      centsOff: [cents(low, 48), cents(high, 59)],
      lowest: stats(low, from),
      highest: stats(high, from),
      smallSpeakerLossDb: await smallSpeakerLossDb(low.subarray(from)),
    };
  }

  const tones: Record<string, unknown> = {};
  for (const voice of Object.keys(TONES) as ToneVoice[]) {
    let worstCents = 0;
    let unmeasured = 0;
    for (const tonic of [48, 53, 59]) {
      for (const side of ["above", "below"] as Side[]) {
        for (let degree = 1; degree <= 7; degree++) {
          const midi = degreeMidi(tonic, degree, side);
          // Measured after Pluck's filter sweep ends, because the sweep bends the attack slightly.
          const samples = await render(0.8, (engine) => engine.playTone(voice, midi, 0));
          const hz = estimateHz(samples, Math.floor(SAMPLE_RATE * 0.4));
          if (Number.isNaN(hz)) unmeasured++;
          else worstCents = Math.max(worstCents, Math.abs(1200 * Math.log2(hz / midiHz(midi))));
        }
      }
    }
    const lowest = await render(TONE_SECONDS + 0.1, (engine) => engine.playTone(voice, 36, 0));
    const highest = await render(TONE_SECONDS + 0.1, (engine) => engine.playTone(voice, 71, 0));
    tones[voice] = {
      worstCents: Math.round(worstCents * 10) / 10,
      unmeasured,
      lowest: stats(lowest),
      highest: stats(highest),
      lowestSmallSpeakerLossDb: await smallSpeakerLossDb(lowest),
    };
  }

  // The silence just before note two proves the 1-5-1 never sounds two notes at once.
  const oneFiveOne: Record<string, unknown> = {};
  for (const voice of Object.keys(TONES) as ToneVoice[]) {
    const samples = await render(3.5, (engine) => engine.playOneFiveOne(voice, 48, 0));
    const at = (seconds: number) => Math.floor(SAMPLE_RATE * seconds);
    const gap = samples.subarray(at(NOTE_BEAT - 0.04), at(NOTE_BEAT - 0.005));
    oneFiveOne[voice] = {
      hz: [0, 1, 2].map((i) => Math.round(estimateHz(samples, at(i * NOTE_BEAT + 0.4)) * 10) / 10),
      gapRmsDb: stats(gap).rmsDb,
      ...stats(samples),
    };
  }

  // Worst case at the page's default levels: every voice sounding together.
  let worstMixPeakDb = -Infinity;
  for (const drone of Object.keys(DRONES) as DroneVoice[]) {
    for (const tone of Object.keys(TONES) as ToneVoice[]) {
      const mix = await render(
        5,
        (engine) => {
          engine.startDrone(drone, 48, 0);
          engine.playOneFiveOne(tone, 48, 1.5);
          engine.playTone(tone, 60, 3);
        },
        DEFAULT_LEVELS,
      );
      worstMixPeakDb = Math.max(worstMixPeakDb, stats(mix).peakDb);
    }
  }

  return { drones, tones, oneFiveOne, worstMixPeakDb };
}
