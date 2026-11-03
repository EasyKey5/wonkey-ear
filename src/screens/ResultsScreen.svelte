<script lang="ts">
  import { GameAudio } from "../audio/GameAudio";
  import Wheel, { DEGREES, type SlotState } from "../components/Wheel.svelte";
  import { levelNotes, newestNote, PASS_MARK } from "../game/levels";
  import { degreeMidi } from "../game/notes";
  import { nextLevel, type LevelId, type Progress } from "../game/progress";
  import { hasPassed, missedNotes, score, type Run } from "../game/run";
  import { levelName } from "./levelName";

  interface Props {
    audio: GameAudio;
    tonic: number;
    id: LevelId;
    run: Run;
    progress: Progress;
    onnext: (level: LevelId) => void;
    onretry: () => void;
    onhome: () => void;
  }

  let { audio, tonic, id, run, progress, onnext, onretry, onhome }: Props = $props();

  const passed = $derived(hasPassed(run));
  const next = $derived(nextLevel(progress, id));
  const movesOnSameDifficulty = $derived(passed && next?.difficulty === id.difficulty);
  const freshNote = $derived(movesOnSameDifficulty && id.difficulty === "normal" ? newestNote(next!.level) : null);
  const notes = $derived(levelNotes(movesOnSameDifficulty ? next!.level : id.level));
  const missed = $derived(missedNotes(run));
  const unlockedHard = $derived(passed && next?.difficulty === "hard" && id.difficulty === "normal");
  const cleared = $derived(passed && !next);

  let lit = $state<number | null>(null);
  let litTimer: ReturnType<typeof setTimeout>;

  const slots = $derived(Object.fromEntries(DEGREES.map((degree) => [degree, slotState(degree)])));

  function slotState(degree: number): SlotState {
    if (!notes.includes(degree)) return "locked";
    if (lit === degree) return "lit";
    return degree === freshNote ? "fresh" : "idle";
  }

  function tryNote(degree: number) {
    if (!notes.includes(degree)) return;
    audio.playNote(degreeMidi(tonic, degree, "above"));
    lit = degree;
    clearTimeout(litTimer);
    litTimer = setTimeout(() => (lit = null), 400);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (/^[1-7]$/.test(event.key)) tryNote(Number(event.key));
  }
</script>

<svelte:window {onkeydown} />

<section class="results">
  <h2>
    {#if cleared}
      Wonkey Ear cleared
    {:else if passed}
      {levelName(id)} passed
    {:else}
      Not this time
    {/if}
  </h2>

  {#if cleared}
    <p>All levels stay open, so play any of them again.</p>
  {:else if unlockedHard}
    <p>Hard mode unlocked: the tonic fades out and only comes back now and then.</p>
  {:else if freshNote}
    <p>New note: {freshNote}. Tap it on the wheel to hear it.</p>
  {:else if !passed}
    <p>You need {PASS_MARK} out of {run.rounds.length} to pass.</p>
  {/if}

  <Wheel {slots} droneOn active onpick={tryNote}>
    {#snippet center()}
      <p class="score" class:passed>{score(run)}/{run.rounds.length}</p>
    {/snippet}
  </Wheel>

  <p class="missed">
    {#if missed.length === 0}
      No notes missed
    {:else}
      Missed:
      {#each missed as { degree, count }, i}
        {i > 0 ? ", " : ""}{degree}{count > 1 ? ` ×${count}` : ""}
      {/each}
    {/if}
  </p>
  <p class="try">Tap any open note to hear it over the tonic</p>

  <div class="actions">
    {#if passed && next}
      <button class="btn primary" onclick={() => onnext(next)}>
        {unlockedHard ? "Start hard mode" : "Next level"}
      </button>
      <button class="btn" onclick={onretry}>Play again</button>
    {:else if passed}
      <button class="btn primary" onclick={onhome}>Back to start</button>
      <button class="btn" onclick={onretry}>Play again</button>
    {:else}
      <button class="btn primary" onclick={onretry}>Try again</button>
      {#if next}
        <button class="btn" onclick={() => onnext(next)}>Next level</button>
      {/if}
    {/if}
  </div>
</section>

<style>
  .results {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }
  h2 {
    font-family: var(--font-neon);
    font-size: 28px;
    font-weight: 400;
  }
  .score {
    color: var(--bad);
    font-family: var(--font-neon);
    font-size: clamp(30px, 10vw, 44px);
  }
  .score.passed {
    color: var(--good);
    text-shadow: 0 0 16px #3dffa080;
  }
  .missed {
    min-height: 24px;
  }
  .try {
    color: var(--muted);
    font-size: 14px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin-top: 4px;
  }
</style>
