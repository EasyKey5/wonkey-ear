<script lang="ts" module>
  export type SlotState = "locked" | "idle" | "fresh" | "lit" | "right" | "wrong";
  export const DEGREES = [1, 2, 3, 4, 5, 6, 7];
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    slots: Record<number, SlotState>;
    droneOn: boolean;
    active: boolean;
    onpick: (degree: number) => void;
    center?: Snippet;
  }

  let { slots, droneOn, active, onpick, center }: Props = $props();

  const MIDDLE = 200;
  const OUTER = 178;
  const INNER = 86;
  const STEP = 360 / DEGREES.length;
  const GAP = 3;
  const NUMBER_RADIUS = 120;
  const MARK_RADIUS = 156;

  const midAngle = (degree: number) => -90 + (degree - 1) * STEP;

  function point(radius: number, angle: number) {
    const radians = (angle * Math.PI) / 180;
    return { x: MIDDLE + radius * Math.cos(radians), y: MIDDLE + radius * Math.sin(radians) };
  }

  function slotPath(degree: number) {
    const start = midAngle(degree) - STEP / 2 + GAP / 2;
    const end = midAngle(degree) + STEP / 2 - GAP / 2;
    const [a, b, c, d] = [point(OUTER, start), point(OUTER, end), point(INNER, end), point(INNER, start)];
    return `M${a.x} ${a.y}A${OUTER} ${OUTER} 0 0 1 ${b.x} ${b.y}L${c.x} ${c.y}A${INNER} ${INNER} 0 0 0 ${d.x} ${d.y}Z`;
  }

  const glows = (state: SlotState) => state === "lit" || state === "right" || state === "wrong";

  function onkeydown(event: KeyboardEvent, degree: number) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    onpick(degree);
  }
</script>

<div class="wheel" class:active>
  <svg viewBox="0 0 400 400" role="group" aria-label="Scale degree wheel">
    <defs>
      <filter id="neon-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="7" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <circle class="ring" class:on={droneOn} cx={MIDDLE} cy={MIDDLE} r="192" filter="url(#neon-glow)" />

    {#each DEGREES as degree}
      <!-- A mouse press never keeps focus, so Space goes on replaying the note after a click. -->
      <path
        class="slot {slots[degree]}"
        d={slotPath(degree)}
        role="button"
        tabindex={slots[degree] === "locked" ? -1 : 0}
        aria-label="Note {degree}"
        aria-disabled={slots[degree] === "locked"}
        onclick={() => onpick(degree)}
        onkeydown={(event) => onkeydown(event, degree)}
        onmousedown={(event) => event.preventDefault()}
      />
    {/each}

    {#each DEGREES as degree}
      {#if glows(slots[degree])}
        <path class="glow {slots[degree]}" d={slotPath(degree)} filter="url(#neon-glow)" />
      {/if}
    {/each}

    {#each DEGREES as degree}
      {@const number = point(NUMBER_RADIUS, midAngle(degree))}
      {@const mark = point(MARK_RADIUS, midAngle(degree))}
      <text class="number {slots[degree]}" x={number.x} y={number.y}>{degree}</text>
      {#if slots[degree] === "right"}
        <path class="mark right" transform="translate({mark.x} {mark.y})" d="M-8 0L-2 6L9-7" />
      {:else if slots[degree] === "wrong"}
        <path class="mark wrong" transform="translate({mark.x} {mark.y})" d="M-7-7L7 7M7-7L-7 7" />
      {/if}
    {/each}
  </svg>

  {#if center}
    <div class="center">{@render center()}</div>
  {/if}
</div>

<style>
  .wheel {
    position: relative;
    width: 100%;
    max-width: min(440px, 56dvh);
    margin: 0 auto;
    aspect-ratio: 1;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    user-select: none;
    -webkit-user-select: none;
  }
  .ring {
    fill: none;
    stroke: var(--cyan);
    stroke-width: 2;
    opacity: 0.08;
    transition: opacity 0.8s;
  }
  .ring.on {
    animation: drone-pulse 4s ease-in-out infinite;
  }
  @keyframes drone-pulse {
    0%,
    100% {
      opacity: 0.25;
    }
    50% {
      opacity: 0.85;
    }
  }
  .slot {
    fill: var(--slot);
    stroke: #38e8ff73;
    stroke-width: 2;
    stroke-linejoin: round;
    outline: none;
    transition:
      fill 0.12s,
      stroke 0.12s;
  }
  .active .slot:not(.locked) {
    cursor: pointer;
  }
  .slot.locked {
    fill: var(--slot-locked);
    stroke: var(--line);
    cursor: not-allowed;
  }
  .slot.fresh {
    stroke: var(--magenta);
    stroke-dasharray: 7 6;
  }
  .slot:focus-visible {
    stroke: var(--text);
    stroke-width: 3;
  }
  @media (hover: hover) {
    .active .slot:not(.locked):hover {
      fill: #182233;
      stroke: var(--cyan);
    }
  }
  .glow {
    stroke-width: 2.5;
    stroke-linejoin: round;
    pointer-events: none;
  }
  .glow.lit {
    fill: #ff4fd859;
    stroke: var(--magenta);
  }
  .glow.right {
    fill: #3dffa04d;
    stroke: var(--good);
  }
  .glow.wrong {
    fill: #ff4d6d4d;
    stroke: var(--bad);
  }
  .number {
    fill: var(--text);
    font-family: var(--font-neon);
    font-size: 36px;
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
  }
  .number.locked {
    fill: var(--dim);
  }
  .mark {
    fill: none;
    stroke-width: 3.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    pointer-events: none;
  }
  .mark.right {
    stroke: var(--good);
  }
  .mark.wrong {
    stroke: var(--bad);
  }
  .center {
    position: absolute;
    top: 50%;
    left: 50%;
    display: grid;
    place-items: center;
    width: 37%;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
  }
  @media (prefers-reduced-motion: reduce) {
    .ring,
    .slot {
      transition: none;
    }
    .ring.on {
      opacity: 0.6;
      animation: none;
    }
  }
</style>
