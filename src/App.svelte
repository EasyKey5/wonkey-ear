<script lang="ts">
  import { DEFAULT_VOLUME, GameAudio } from "./audio/GameAudio";
  import { randomTonic } from "./game/notes";
  import {
    browserStore,
    loadProgress,
    recordPass,
    saveProgress,
    type LevelId,
  } from "./game/progress";
  import { hasPassed, type Run } from "./game/run";
  import { levelName } from "./screens/levelName";
  import LevelScreen from "./screens/LevelScreen.svelte";
  import ResultsScreen from "./screens/ResultsScreen.svelte";
  import StartScreen from "./screens/StartScreen.svelte";

  let progress = $state.raw(loadProgress(browserStore));
  let audio = $state.raw<GameAudio | null>(null);
  let screen = $state<"start" | "level" | "results">("start");
  let tonic = $state(48);
  let id = $state.raw<LevelId>({ difficulty: "normal", level: 0 });
  let lastRun = $state.raw<Run | null>(null);
  let attempt = $state(0);
  let volume = $state(DEFAULT_VOLUME);

  $effect(() => {
    audio?.setVolume(volume);
  });

  async function startGame(level: LevelId) {
    audio ??= await GameAudio.forBrowser();
    tonic = randomTonic();
    audio.startDrone(tonic);
    playLevel(level);
  }

  function playLevel(level: LevelId) {
    id = level;
    attempt++;
    screen = "level";
  }

  function finishLevel(run: Run) {
    lastRun = run;
    if (hasPassed(run)) {
      progress = recordPass(progress, id);
      saveProgress(browserStore, progress);
    }
    audio?.setDroneAudible(true, 0.6);
    screen = "results";
  }

  function quit() {
    audio?.stopDrone();
    screen = "start";
  }

  function onvisibilitychange() {
    audio?.setPaused(document.hidden);
  }

  // iPhones can leave audio suspended after a call or lock, and only a tap may wake it.
  function onpointerdown() {
    if (!document.hidden) audio?.setPaused(false);
  }
</script>

<svelte:document {onvisibilitychange} {onpointerdown} />

<main>
  {#if screen === "start" || !audio}
    <StartScreen {progress} onplay={startGame} />
  {:else}
    <header>
      <span class="name" class:hard={id.difficulty === "hard"}>{levelName(id)}</span>
      <label class="volume">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9H4Z" />
          <path class="waves" d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" />
        </svg>
        <span class="sr-only">Volume</span>
        <input type="range" min="0" max="1" step="0.01" bind:value={volume} />
      </label>
      <button class="btn quit" onclick={quit}>Quit</button>
    </header>

    {#key attempt}
      {#if screen === "level"}
        <LevelScreen {audio} {tonic} {id} onfinish={finishLevel} />
      {:else if lastRun}
        <ResultsScreen
          {audio}
          {tonic}
          {id}
          {progress}
          run={lastRun}
          onnext={playLevel}
          onretry={() => playLevel(id)}
          onhome={quit}
        />
      {/if}
    {/key}
  {/if}
</main>

<style>
  main {
    max-width: 480px;
    min-height: 100dvh;
    margin: 0 auto;
    padding: 12px 16px 32px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .name {
    flex: 1;
    color: var(--cyan);
    font-family: var(--font-neon);
    font-size: 18px;
    white-space: nowrap;
  }
  .name.hard {
    color: var(--magenta);
  }
  .volume {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .volume svg {
    flex: none;
    width: 22px;
    fill: var(--muted);
  }
  .volume .waves {
    fill: none;
    stroke: var(--muted);
    stroke-width: 2;
    stroke-linecap: round;
  }
  input {
    width: 88px;
    height: 28px;
    margin: 0;
    accent-color: var(--cyan);
  }
  .quit {
    min-height: 44px;
    padding: 0 14px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
