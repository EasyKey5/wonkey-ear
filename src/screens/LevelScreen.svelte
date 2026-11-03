<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { GameAudio, NOTE_BEAT, ONE_FIVE_ONE, TONE_SECONDS } from "../audio/GameAudio";
  import Wheel, { DEGREES, type SlotState } from "../components/Wheel.svelte";
  import { buildRounds, levelNotes, tonicReturnsBefore, type Round } from "../game/levels";
  import { degreeMidi } from "../game/notes";
  import type { LevelId } from "../game/progress";
  import { answerRound, currentRound, isFinished, score, startRun, type Run } from "../game/run";

  interface Props {
    audio: GameAudio;
    tonic: number;
    id: LevelId;
    onfinish: (run: Run) => void;
  }

  let { audio, tonic, id, onfinish }: Props = $props();

  type Phase = "intro" | "tonic" | "listening" | "feedback";

  const LEAD_IN = 1;
  const AFTER_INTRO = 1;
  const DRONE_FADE = 1.5;
  const TONIC_RETURN = 2;
  const AFTER_TONIC_RETURN = 1.2;
  const NEXT_ROUND_DELAY = 1;

  let run = $state.raw(untrack(() => startRun(buildRounds(id.level))));
  let phase = $state<Phase>("intro");
  let lit = $state<number | null>(null);
  let droneOn = $state(true);
  let replayingKey = $state(false);
  let feedback = $state.raw<{ picked: number; round: Round } | null>(null);

  const hard = $derived(id.difficulty === "hard");
  const notes = $derived(levelNotes(id.level));
  const answered = $derived(run.answers.length);

  const slots = $derived(Object.fromEntries(DEGREES.map((degree) => [degree, slotState(degree)])));

  function slotState(degree: number): SlotState {
    if (!notes.includes(degree)) return "locked";
    if (feedback?.round.degree === degree) return "right";
    if (feedback?.picked === degree) return "wrong";
    return lit === degree ? "lit" : "idle";
  }

  const status = $derived.by(() => {
    if (phase === "intro") return "Get the key in your ear";
    if (phase === "tonic") return "Here's the tonic again";
    if (!feedback) return "Which note was that?";
    const { picked, round } = feedback;
    return picked === round.degree ? "Right!" : `It was ${round.degree}, ${round.side} the tonic`;
  });

  const stop = new AbortController();
  const wait = (seconds: number) => audio.wait(seconds, stop.signal);

  function spawn(task: () => Promise<void>) {
    task().catch((error) => {
      if (!stop.signal.aborted) throw error;
    });
  }

  onMount(() => {
    spawn(begin);
    return () => stop.abort();
  });

  if (import.meta.env.DEV) {
    Object.assign(window, { wonkeyRound: () => currentRound(run) });
  }

  function setDrone(audible: boolean, fade: number) {
    audio.setDroneAudible(audible, fade);
    droneOn = audible;
  }

  async function begin() {
    setDrone(true, 0.6);
    await wait(LEAD_IN);
    await oneFiveOne();
    await wait(AFTER_INTRO);
    if (hard) {
      setDrone(false, DRONE_FADE);
      await wait(DRONE_FADE);
    }
    await startRound();
  }

  async function oneFiveOne() {
    audio.playOneFiveOne(tonic);
    for (const degree of ONE_FIVE_ONE) {
      lit = degree;
      await wait(NOTE_BEAT);
    }
    lit = null;
  }

  function playRound(round: Round) {
    audio.playNote(degreeMidi(tonic, round.degree, round.side));
  }

  async function startRound() {
    if (hard && tonicReturnsBefore(answered)) {
      phase = "tonic";
      setDrone(true, 0.4);
      await wait(TONIC_RETURN);
      setDrone(false, DRONE_FADE);
      await wait(AFTER_TONIC_RETURN);
    }
    playRound(currentRound(run)!);
    phase = "listening";
  }

  function pick(degree: number) {
    if (phase !== "listening" || !notes.includes(degree)) return;
    const round = currentRound(run)!;
    run = answerRound(run, degree);
    feedback = { picked: degree, round };
    phase = "feedback";
    spawn(async () => {
      if (degree !== round.degree) {
        playRound(round);
        await wait(TONE_SECONDS);
      }
      await wait(NEXT_ROUND_DELAY);
      feedback = null;
      if (isFinished(run)) onfinish(run);
      else await startRound();
    });
  }

  function replayNote() {
    if (phase === "listening") playRound(currentRound(run)!);
  }

  function replayKey() {
    if (phase !== "listening" || replayingKey) return;
    replayingKey = true;
    spawn(async () => {
      await oneFiveOne();
      replayingKey = false;
    });
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (/^[1-7]$/.test(event.key)) {
      pick(Number(event.key));
    } else if (event.key === " " && !(event.target instanceof Element && event.target.closest("button, input, a"))) {
      event.preventDefault();
      replayNote();
    }
  }
</script>

<svelte:window {onkeydown} />

<section class="level">
  <ol class="dots" aria-label="Round {Math.min(answered + 1, run.rounds.length)} of {run.rounds.length}">
    {#each run.rounds as round, i}
      <li
        class:current={i === answered}
        class:right={i < answered && run.answers[i] === round.degree}
        class:wrong={i < answered && run.answers[i] !== round.degree}
      ></li>
    {/each}
  </ol>

  <Wheel {slots} {droneOn} active={phase === "listening"} onpick={pick}>
    {#snippet center()}
      <button
        class="replay"
        disabled={phase !== "listening"}
        aria-label="Replay the note, score {score(run)} out of {run.rounds.length}"
        onclick={replayNote}
        onmousedown={(event) => event.preventDefault()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12a8 8 0 1 0 2.6-5.9M4 3.5V8h4.5" />
        </svg>
        <span>{score(run)}/{run.rounds.length}</span>
      </button>
    {/snippet}
  </Wheel>

  <p class="status" aria-live="polite">{status}</p>

  <button
    class="btn"
    disabled={phase !== "listening" || replayingKey}
    onclick={replayKey}
    onmousedown={(event) => event.preventDefault()}
  >
    Hear 1-5-1
  </button>
  <p class="keys">Keys 1 to 7 answer, Space replays the note</p>
</section>

<style>
  .level {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }
  .dots {
    display: flex;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .dots li {
    width: 10px;
    height: 10px;
    border: 1px solid var(--line);
    border-radius: 50%;
    background: var(--slot);
  }
  .dots li.current {
    border-color: var(--cyan);
    box-shadow: 0 0 8px var(--cyan);
  }
  .dots li.right {
    border-color: var(--good);
    background: var(--good);
  }
  .dots li.wrong {
    border-color: var(--bad);
    background: var(--bad);
  }
  .replay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    gap: 2px;
    padding: 0;
    border: 1px solid #38e8ff73;
    border-radius: 50%;
    background: var(--panel);
    color: var(--text);
    font-family: var(--font-neon);
    font-size: clamp(18px, 6vw, 26px);
    cursor: pointer;
  }
  .replay:disabled {
    border-color: var(--line);
    color: var(--muted);
    cursor: default;
  }
  .replay:focus-visible {
    outline: 2px solid var(--text);
    outline-offset: 2px;
  }
  .replay svg {
    width: 34%;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  @media (hover: hover) {
    .replay:not(:disabled):hover {
      border-color: var(--cyan);
      box-shadow: 0 0 14px #38e8ff40;
    }
  }
  .status {
    min-height: 28px;
    font-family: var(--font-neon);
    font-size: 20px;
    text-align: center;
  }
  .keys {
    display: none;
    color: var(--muted);
    font-size: 13px;
  }
  @media (hover: hover) {
    .keys {
      display: block;
    }
  }
</style>
