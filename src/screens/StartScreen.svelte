<script lang="ts">
  import { LEVEL_COUNT, levelNotes, newestNote, PASS_MARK, ROUNDS_PER_LEVEL } from "../game/levels";
  import {
    continueLevel,
    isCleared,
    unlockedLevels,
    type Difficulty,
    type LevelId,
    type Progress,
  } from "../game/progress";
  import { levelName } from "./levelName";

  interface Props {
    progress: Progress;
    onplay: (level: LevelId) => void;
  }

  let { progress, onplay }: Props = $props();

  const LEVELS = Array.from({ length: LEVEL_COUNT }, (_, level) => level);

  const resume = $derived(continueLevel(progress));
  const isNewPlayer = $derived(progress.normal === 0);
  const hardOpen = $derived(unlockedLevels(progress, "hard") > 0);

  const adds = (level: number) => (level === 0 ? levelNotes(0).join(" ") : `+${newestNote(level)}`);
</script>

{#snippet levels(difficulty: Difficulty)}
  <div class="levels">
    {#each LEVELS as level}
      {@const open = level < unlockedLevels(progress, difficulty)}
      {@const passed = level < progress[difficulty]}
      <button
        class="level"
        class:passed
        class:hard={difficulty === "hard"}
        disabled={!open}
        aria-label="{levelName({ difficulty, level })}{passed ? ', passed' : ''}{open ? '' : ', locked'}"
        onclick={() => onplay({ difficulty, level })}
      >
        <span class="number">{level + 1}</span>
        <span class="adds">{adds(level)}</span>
      </button>
    {/each}
  </div>
{/snippet}

<section class="start">
  <h1 class="wordmark">
    <span class="wonkey">Won<span class="flicker">k</span>ey</span>
    <span class="ear">Ear</span>
  </h1>
  <p class="tagline">
    Hear a note over a held tonic and name its scale degree. Score {PASS_MARK} out of {ROUNDS_PER_LEVEL} to unlock the
    next note.
  </p>

  {#if isCleared(progress)}
    <p class="cleared">Cleared. Every level stays open.</p>
  {/if}

  <button class="btn primary continue" onclick={() => onplay(resume)}>
    {isNewPlayer ? "Start" : `Continue: ${levelName(resume)}`}
  </button>

  <div class="group">
    <h2>Levels</h2>
    {@render levels("normal")}
  </div>

  <div class="group">
    <h2 class="hard-title">Hard mode</h2>
    {#if hardOpen}
      {@render levels("hard")}
    {:else}
      <p class="locked-note">Unlocks after level {LEVEL_COUNT}.</p>
    {/if}
  </div>
</section>

<style>
  .start {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding-top: 6vh;
    text-align: center;
  }
  .wordmark {
    font-family: var(--font-neon);
    font-size: clamp(44px, 14vw, 72px);
    font-weight: 400;
    line-height: 1.1;
  }
  .wonkey {
    color: #ffe3f8;
    text-shadow:
      0 0 6px var(--magenta),
      0 0 18px var(--magenta),
      0 0 42px #ff4fd880;
  }
  .ear {
    color: #dff9ff;
    text-shadow:
      0 0 6px var(--cyan),
      0 0 18px var(--cyan),
      0 0 42px #38e8ff80;
  }
  .flicker {
    animation: flicker 7s linear infinite;
  }
  @keyframes flicker {
    0%,
    91%,
    93%,
    95%,
    100% {
      opacity: 1;
    }
    92%,
    94% {
      opacity: 0.35;
    }
  }
  .tagline {
    max-width: 34ch;
    color: var(--muted);
  }
  .cleared {
    color: var(--good);
    font-family: var(--font-neon);
    font-size: 20px;
  }
  .continue {
    width: 100%;
    max-width: 320px;
    min-height: 56px;
  }
  .group {
    width: 100%;
    max-width: 420px;
  }
  h2 {
    margin-bottom: 8px;
    color: var(--cyan);
    font-family: var(--font-neon);
    font-size: 16px;
    font-weight: 400;
  }
  .hard-title {
    color: var(--magenta);
  }
  .locked-note {
    color: var(--muted);
    font-size: 14px;
  }
  .levels {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
  }
  .level {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60px;
    padding: 0;
    border: 1px solid #38e8ff73;
    border-radius: 10px;
    background: var(--panel);
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }
  .level.hard {
    border-color: #ff4fd873;
  }
  .level.passed {
    background: #0c2a33;
  }
  .level.hard.passed {
    background: #33102c;
  }
  .level:disabled {
    border-color: var(--line);
    background: var(--slot-locked);
    color: var(--dim);
    cursor: not-allowed;
  }
  .level:focus-visible {
    outline: 2px solid var(--text);
    outline-offset: 2px;
  }
  @media (hover: hover) {
    .level:not(:disabled):hover {
      border-color: var(--cyan);
      box-shadow: 0 0 12px #38e8ff40;
    }
    .level.hard:not(:disabled):hover {
      border-color: var(--magenta);
      box-shadow: 0 0 12px #ff4fd840;
    }
  }
  .number {
    font-family: var(--font-neon);
    font-size: 20px;
    line-height: 1.2;
  }
  .adds {
    color: var(--muted);
    font-size: 12px;
  }
  .level:disabled .adds {
    color: var(--dim);
  }
  @media (prefers-reduced-motion: reduce) {
    .flicker {
      animation: none;
    }
  }
</style>
