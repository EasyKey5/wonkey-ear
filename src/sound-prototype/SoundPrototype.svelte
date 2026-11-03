<script lang="ts">
  // PROTOTYPE, throwaway. Three drones and three guess tones,
  // switched live and remembered in the URL. Nothing here is saved.
  import { onDestroy } from "svelte";
  import {
    DEFAULT_LEVELS,
    degreeMidi,
    DRONES,
    midiHz,
    midiName,
    NOTE_BEAT,
    SoundEngine,
    TONE_SECONDS,
    TONES,
    type DroneVoice,
    type Side,
    type ToneVoice,
  } from "./synth";

  const TONICS = Array.from({ length: 12 }, (_, i) => 48 + i);
  const DEGREES = [1, 2, 3, 4, 5, 6, 7];
  const SIDES: Side[] = ["above", "below"];

  const params = new URLSearchParams(location.search);
  function fromUrl<T extends string>(key: string, options: Record<T, string>, fallback: T): T {
    const value = params.get(key);
    return value && value in options ? (value as T) : fallback;
  }

  let drone = $state<DroneVoice>(fromUrl("drone", DRONES, "warm"));
  let tone = $state<ToneVoice>(fromUrl("tone", TONES, "pluck"));
  let tonic = $state(48);
  let levels = $state({ ...DEFAULT_LEVELS });

  let engine = $state.raw<SoundEngine | null>(null);
  let context: AudioContext | null = null;
  let droneOn = $state(false);
  let droneOpen = $state(true);
  let last = $state<{ degree: number; side: Side } | null>(null);
  let lit = $state<number | null>(null);
  let peakDb = $state(-Infinity);
  let maxPeakDb = $state(-Infinity);
  let contextState = $state("not started");

  let demoId = 0;
  let demoRunning = $state(false);
  let demoLine = $state("");
  let answerHidden = $state(false);

  const lastLabel = $derived.by(() => {
    if (answerHidden) return "hidden during demo";
    if (!last) return "none yet";
    const midi = degreeMidi(tonic, last.degree, last.side);
    return `${last.degree} ${last.side} = ${midiName(midi)} (${midiHz(midi).toFixed(2)} Hz)`;
  });

  $effect(() => {
    history.replaceState(null, "", `?${new URLSearchParams({ drone, tone })}`);
  });

  $effect(() => {
    engine?.setLevels({ ...levels });
  });

  const sleep = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

  const meter = setInterval(() => {
    if (!engine) return;
    contextState = context?.state ?? "closed";
    const samples = new Float32Array(engine.analyser.fftSize);
    engine.analyser.getFloatTimeDomainData(samples);
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
    peakDb = 20 * Math.log10(Math.max(peak, 1e-5));
    maxPeakDb = Math.max(maxPeakDb, peakDb);
  }, 100);

  onDestroy(() => {
    clearInterval(meter);
    context?.close();
  });

  async function start() {
    // Without this, an iPhone on silent plays nothing at all.
    const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (audioSession) audioSession.type = "playback";
    context = new AudioContext();
    await context.resume();
    engine = new SoundEngine(context, { ...levels });
    engine.startDrone(drone, tonic);
    droneOn = true;
  }

  function toggleDrone() {
    if (!engine) return;
    if (droneOn) engine.stopDrone();
    else engine.startDrone(drone, tonic);
    droneOn = !droneOn;
  }

  function chooseDrone(voice: DroneVoice) {
    drone = voice;
    if (engine && droneOn) engine.startDrone(voice, tonic);
  }

  function chooseTonic(midi: number) {
    tonic = midi;
    if (engine && droneOn) engine.startDrone(drone, midi);
  }

  function randomTonic() {
    chooseTonic(TONICS[Math.floor(Math.random() * TONICS.length)]);
  }

  // Picking a voice replays the last sound, so comparing two takes one click.
  function chooseTone(voice: ToneVoice) {
    tone = voice;
    if (last) playDegree(last.degree, last.side);
  }

  function playDegree(degree: number, side: Side) {
    if (!engine) return;
    last = { degree, side };
    engine.playTone(tone, degreeMidi(tonic, degree, side));
  }

  function playOneFiveOne() {
    if (!engine) return;
    engine.playOneFiveOne(tone, tonic);
    [1, 5, 1].forEach((degree, i) => setTimeout(() => (lit = degree), i * NOTE_BEAT * 1000));
    setTimeout(() => (lit = null), 3 * NOTE_BEAT * 1000 + 500);
  }

  async function runDemo(hard: boolean) {
    if (!engine) return;
    const id = ++demoId;
    const live = () => id === demoId && engine;
    demoRunning = true;
    droneOpen = true;
    engine.gateDrone(true);
    demoLine = "1-5-1";
    playOneFiveOne();
    await sleep(NOTE_BEAT * 3 + 1);
    if (hard && live()) {
      engine.gateDrone(false);
      droneOpen = false;
      await sleep(1.5);
    }
    for (let round = 1; round <= 10 && live(); round++) {
      if (hard && round % 3 === 0) {
        demoLine = `Round ${round}/10: tonic returns`;
        engine.gateDrone(true, 0.4);
        droneOpen = true;
        await sleep(2);
        if (!live()) break;
        engine.gateDrone(false);
        droneOpen = false;
        await sleep(1.2);
        if (!live()) break;
      }
      const degree = DEGREES[Math.floor(Math.random() * DEGREES.length)];
      const side = SIDES[Math.floor(Math.random() * SIDES.length)];
      answerHidden = true;
      demoLine = `Round ${round}/10: which degree?`;
      playDegree(degree, side);
      await sleep(TONE_SECONDS + 1.5);
      if (!live()) break;
      answerHidden = false;
      demoLine = `Round ${round}/10: it was ${degree} ${side}`;
      await sleep(1);
    }
    if (id === demoId) stopDemo();
  }

  function stopDemo() {
    demoId++;
    demoRunning = false;
    answerHidden = false;
    demoLine = "";
    droneOpen = true;
    engine?.gateDrone(true, 0.6);
  }
</script>

<main>
  <header>
    <span class="tag">PROTOTYPE, throwaway</span>
    <h1>Wonkey Ear sound check</h1>
  </header>

  {#if !engine}
    <button class="start" onclick={start}>Start sound</button>
  {:else}
    <section>
      <h2>Drone</h2>
      <div class="row">
        {#each Object.entries(DRONES) as [key, label]}
          <button class:on={drone === key} onclick={() => chooseDrone(key as DroneVoice)}>{label}</button>
        {/each}
        <button class="quiet" onclick={toggleDrone}>{droneOn ? "Turn drone off" : "Turn drone on"}</button>
      </div>
      <div class="row tonics">
        {#each TONICS as midi}
          <button class:on={tonic === midi} onclick={() => chooseTonic(midi)}>{midiName(midi)}</button>
        {/each}
        <button class="quiet" onclick={randomTonic}>Random</button>
      </div>
    </section>

    <section>
      <h2>Guess tone</h2>
      <div class="row">
        {#each Object.entries(TONES) as [key, label]}
          <button class:on={tone === key} onclick={() => chooseTone(key as ToneVoice)}>{label}</button>
        {/each}
        <button class="quiet" onclick={playOneFiveOne}>Play 1-5-1</button>
      </div>
      {#each SIDES as side}
        <div class="row degrees">
          <span class="side">{side}</span>
          {#each DEGREES as degree}
            <button class:lit={side === "above" && lit === degree} onclick={() => playDegree(degree, side)}>
              {degree}
            </button>
          {/each}
        </div>
      {/each}
    </section>

    <section>
      <h2>Try a whole level</h2>
      <div class="row">
        <button onclick={() => runDemo(false)}>Normal level</button>
        <button onclick={() => runDemo(true)}>Hard level</button>
        {#if demoRunning}
          <button class="quiet" onclick={stopDemo}>Stop</button>
        {/if}
      </div>
      <p class="demo-line">{demoLine || "Plays 1-5-1, then ten random notes at game pace. Guess along."}</p>
    </section>

    <section>
      <h2>Balance</h2>
      {#each Object.keys(levels) as (keyof typeof levels)[] as key}
        <label>
          <span>{key}</span>
          <input type="range" min="0" max="1" step="0.01" bind:value={levels[key]} />
          <output>{levels[key].toFixed(2)}</output>
        </label>
      {/each}
    </section>

    <section>
      <h2>Current state</h2>
      <pre id="state">audio: {contextState}
tonic: {midiName(tonic)} ({midiHz(tonic).toFixed(2)} Hz)
drone: {DRONES[drone]} ({droneOn ? (droneOpen ? "on" : "faded out") : "off"})
guess tone: {TONES[tone]}
last note: {lastLabel}
output peak: {peakDb.toFixed(1)} dBFS (highest {maxPeakDb.toFixed(1)})</pre>
    </section>
  {/if}

  <section>
    <h2>What to listen for</h2>
    <ul>
      <li>Which drone could you sit with for ten minutes?</li>
      <li>Does each guess tone stand out, especially 1 above and 1 below?</li>
      <li>Do the 1-5-1 notes put you in the key?</li>
      <li>With the tonic on C3, can you still hear the notes below it on laptop speakers?</li>
      <li>Do 2 and 7 sound interesting or just unpleasant against the drone?</li>
    </ul>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #0a0a12;
    color: #e6e6f0;
    font: 15px/1.5 system-ui, sans-serif;
  }
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 24px 16px 64px;
  }
  .tag {
    color: #ff4fd8;
    font-size: 12px;
    letter-spacing: 0.08em;
  }
  h1 {
    margin: 4px 0 20px;
    font-size: 24px;
  }
  h2 {
    margin: 0 0 8px;
    color: #38e8ff;
    font-size: 14px;
    font-weight: 600;
  }
  section {
    margin-bottom: 24px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }
  button {
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid #34344a;
    border-radius: 8px;
    background: #16161f;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  button:hover {
    border-color: #38e8ff;
  }
  button.on {
    border-color: #38e8ff;
    background: #0f3640;
  }
  button.lit {
    border-color: #ff4fd8;
    background: #4a1740;
    box-shadow: 0 0 16px #ff4fd8;
  }
  button.quiet {
    border-style: dashed;
  }
  button.start {
    width: 100%;
    min-height: 64px;
    margin-bottom: 24px;
    border-color: #38e8ff;
    font-size: 18px;
    box-shadow: 0 0 20px #38e8ff55;
  }
  .tonics button {
    min-width: 48px;
    padding: 0 8px;
  }
  .degrees button {
    width: 48px;
    padding: 0;
  }
  .side {
    width: 56px;
    color: #9a9ab0;
  }
  .demo-line {
    margin: 0;
    color: #9a9ab0;
  }
  label {
    display: grid;
    grid-template-columns: 64px 1fr 40px;
    align-items: center;
    gap: 8px;
  }
  input {
    width: 100%;
    accent-color: #38e8ff;
  }
  pre {
    margin: 0;
    padding: 12px;
    overflow-x: auto;
    border-radius: 8px;
    background: #16161f;
    font-size: 13px;
  }
  ul {
    margin: 0;
    padding-left: 20px;
  }
</style>
