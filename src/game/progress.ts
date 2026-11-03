import { LEVEL_COUNT } from "./levels";

export type Difficulty = "normal" | "hard";

export interface LevelId {
  difficulty: Difficulty;
  level: number;
}

// How many levels are passed on each difficulty. Levels unlock in order, so a count is enough.
export interface Progress {
  normal: number;
  hard: number;
}

export const NEW_PROGRESS: Progress = { normal: 0, hard: 0 };

export function recordPass(progress: Progress, { difficulty, level }: LevelId): Progress {
  return { ...progress, [difficulty]: Math.max(progress[difficulty], level + 1) };
}

export function unlockedLevels(progress: Progress, difficulty: Difficulty): number {
  if (difficulty === "hard" && progress.normal < LEVEL_COUNT) return 0;
  return Math.min(progress[difficulty] + 1, LEVEL_COUNT);
}

export const isCleared = (progress: Progress) => progress.hard >= LEVEL_COUNT;

export function continueLevel(progress: Progress): LevelId {
  if (progress.normal < LEVEL_COUNT) return { difficulty: "normal", level: progress.normal };
  return { difficulty: "hard", level: Math.min(progress.hard, LEVEL_COUNT - 1) };
}

export function nextLevel(progress: Progress, { difficulty, level }: LevelId): LevelId | null {
  let next: LevelId | null = null;
  if (level + 1 < LEVEL_COUNT) next = { difficulty, level: level + 1 };
  else if (difficulty === "normal") next = { difficulty: "hard", level: 0 };
  return next && next.level < unlockedLevels(progress, next.difficulty) ? next : null;
}

const STORAGE_KEY = "wonkey-ear.progress";

export type ProgressStore = Pick<Storage, "getItem" | "setItem">;

// Touching localStorage can itself throw, so it stays inside loadProgress and saveProgress's try blocks.
export const browserStore: ProgressStore = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= LEVEL_COUNT;

export function loadProgress(store: ProgressStore): Progress {
  try {
    const saved = JSON.parse(store.getItem(STORAGE_KEY) ?? "null");
    if (!isCount(saved?.normal) || !isCount(saved?.hard)) return NEW_PROGRESS;
    return { normal: saved.normal, hard: saved.normal < LEVEL_COUNT ? 0 : saved.hard };
  } catch {
    return NEW_PROGRESS;
  }
}

export function saveProgress(store: ProgressStore, progress: Progress) {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Blocked storage only costs the player their saved progress, so the game carries on.
  }
}
