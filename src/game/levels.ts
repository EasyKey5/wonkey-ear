export type Side = "above" | "below";

export interface Round {
  degree: number;
  side: Side;
}

export const LEVEL_COUNT = 6;
export const ROUNDS_PER_LEVEL = 10;
export const PASS_MARK = 9;

// Consonant notes first: 2 and 7 clash most with the drone, so they come last.
const NOTE_ORDER = [1, 5, 3, 4, 6, 2, 7];

export const levelNotes = (level: number) => NOTE_ORDER.slice(0, level + 2);
export const newestNote = (level: number) => NOTE_ORDER[level + 1];

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function noteCounts(level: number, random: () => number): Map<number, number> {
  const earlier = levelNotes(level).slice(0, -1);
  const newestRounds = level === 0 ? 5 : 4;
  const shared = ROUNDS_PER_LEVEL - newestRounds;
  const each = Math.floor(shared / earlier.length);
  const spare = new Set(shuffled(earlier, random).slice(0, shared % earlier.length));
  const counts = new Map(earlier.map((degree) => [degree, each + (spare.has(degree) ? 1 : 0)]));
  return counts.set(newestNote(level), newestRounds);
}

// A note with an odd count gets its extra round on a random side.
function roundsForNote(degree: number, count: number, random: () => number): Round[] {
  let above = Math.floor(count / 2);
  if (count % 2 === 1 && random() < 0.5) above++;
  return Array.from({ length: count }, (_, i) => ({ degree, side: i < above ? "above" : "below" }));
}

// A fixed mix of notes in a random order, so the newest note can't dodge the level.
export function buildRounds(level: number, random: () => number = Math.random): Round[] {
  const rounds = [...noteCounts(level, random)].flatMap(([degree, count]) => roundsForNote(degree, count, random));
  return shuffled(rounds, random);
}

// Hard mode brings the tonic back before rounds 3, 6 and 9.
export const tonicReturnsBefore = (roundIndex: number) => (roundIndex + 1) % 3 === 0;
