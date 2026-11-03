import type { LevelId } from "../game/progress";

export const levelName = ({ difficulty, level }: LevelId) =>
  `${difficulty === "hard" ? "Hard level" : "Level"} ${level + 1}`;
