import { describe, expect, it } from "vitest";
import {
  continueLevel,
  isCleared,
  loadProgress,
  NEW_PROGRESS,
  nextLevel,
  recordPass,
  saveProgress,
  unlockedLevels,
  type Progress,
} from "./progress";

const passLevels = (count: number): Progress =>
  Array.from({ length: count }).reduce<Progress>(
    (progress, _, level) => recordPass(progress, { difficulty: "normal", level }),
    NEW_PROGRESS,
  );

const ALL_NORMAL = passLevels(6);

describe("unlocks", () => {
  it("gives a new player level one only, with hard mode locked", () => {
    expect(unlockedLevels(NEW_PROGRESS, "normal")).toBe(1);
    expect(unlockedLevels(NEW_PROGRESS, "hard")).toBe(0);
  });

  it("unlocks the next level on a pass", () => {
    expect(unlockedLevels(passLevels(1), "normal")).toBe(2);
  });

  it("keeps progress when an earlier level is replayed", () => {
    const replayed = recordPass(passLevels(3), { difficulty: "normal", level: 0 });
    expect(unlockedLevels(replayed, "normal")).toBe(4);
  });

  it("never unlocks more than the six levels", () => {
    expect(unlockedLevels(ALL_NORMAL, "normal")).toBe(6);
  });

  it("keeps hard mode locked until level six is passed", () => {
    expect(unlockedLevels(passLevels(5), "hard")).toBe(0);
    expect(unlockedLevels(ALL_NORMAL, "hard")).toBe(1);
  });

  it("is cleared only when hard level six is passed", () => {
    const fiveHard = [0, 1, 2, 3, 4].reduce(
      (progress, level) => recordPass(progress, { difficulty: "hard", level }),
      ALL_NORMAL,
    );
    expect(isCleared(fiveHard)).toBe(false);
    expect(isCleared(recordPass(fiveHard, { difficulty: "hard", level: 5 }))).toBe(true);
  });
});

describe("continueLevel", () => {
  it("starts a new player on level one", () => {
    expect(continueLevel(NEW_PROGRESS)).toEqual({ difficulty: "normal", level: 0 });
  });

  it("resumes at the furthest unlocked level", () => {
    expect(continueLevel(passLevels(3))).toEqual({ difficulty: "normal", level: 3 });
  });

  it("moves on to hard mode after level six", () => {
    expect(continueLevel(ALL_NORMAL)).toEqual({ difficulty: "hard", level: 0 });
  });

  it("stays on hard level six once everything is cleared", () => {
    expect(continueLevel({ normal: 6, hard: 6 })).toEqual({ difficulty: "hard", level: 5 });
  });
});

describe("nextLevel", () => {
  it("offers the following level once it is unlocked", () => {
    expect(nextLevel(passLevels(1), { difficulty: "normal", level: 0 })).toEqual({ difficulty: "normal", level: 1 });
  });

  it("offers nothing while the following level is locked", () => {
    expect(nextLevel(NEW_PROGRESS, { difficulty: "normal", level: 0 })).toBeNull();
  });

  it("leads from level six into hard mode", () => {
    expect(nextLevel(ALL_NORMAL, { difficulty: "normal", level: 5 })).toEqual({ difficulty: "hard", level: 0 });
  });

  it("offers nothing after hard level six", () => {
    expect(nextLevel({ normal: 6, hard: 6 }, { difficulty: "hard", level: 5 })).toBeNull();
  });
});

describe("saved progress", () => {
  function fakeStorage(initial: string | null = null) {
    let saved = initial;
    return {
      getItem: () => saved,
      setItem: (_key: string, value: string) => {
        saved = value;
      },
    };
  }

  const throwing = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };

  it("comes back as it was saved", () => {
    const storage = fakeStorage();
    saveProgress(storage, { normal: 6, hard: 2 });
    expect(loadProgress(storage)).toEqual({ normal: 6, hard: 2 });
  });

  it("starts fresh when nothing is saved", () => {
    expect(loadProgress(fakeStorage())).toEqual(NEW_PROGRESS);
  });

  it.each(["not json", "null", "[]", '{"normal":99,"hard":0}', '{"normal":-1,"hard":0}', '{"normal":1.5,"hard":0}', '{"normal":"3"}'])(
    "starts fresh when the saved value is %s",
    (saved) => {
      expect(loadProgress(fakeStorage(saved))).toEqual(NEW_PROGRESS);
    },
  );

  it("ignores hard progress saved without level six passed", () => {
    expect(loadProgress(fakeStorage('{"normal":2,"hard":3}'))).toEqual({ normal: 2, hard: 0 });
  });

  it("starts fresh and keeps going when the browser blocks storage", () => {
    expect(loadProgress(throwing)).toEqual(NEW_PROGRESS);
    expect(() => saveProgress(throwing, { normal: 1, hard: 0 })).not.toThrow();
  });
});
