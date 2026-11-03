import { describe, expect, it } from "vitest";
import { buildRounds, tonicReturnsBefore, type Round } from "./levels";

function countByDegree(rounds: Round[]) {
  const counts: Record<number, number> = {};
  for (const { degree } of rounds) counts[degree] = (counts[degree] ?? 0) + 1;
  return counts;
}

describe("buildRounds", () => {
  it("gives level one five rounds each of notes 1 and 5", () => {
    expect(countByDegree(buildRounds(0))).toEqual({ 1: 5, 5: 5 });
  });

  it.each([
    [1, { 1: 3, 5: 3, 3: 4 }],
    [2, { 1: 2, 5: 2, 3: 2, 4: 4 }],
    [5, { 1: 1, 5: 1, 3: 1, 4: 1, 6: 1, 2: 1, 7: 4 }],
  ])("tests the newest note four times and shares the rest evenly at level index %i", (level, expected) => {
    expect(countByDegree(buildRounds(level))).toEqual(expected);
  });

  it.each([
    [3, 6, [1, 5, 3, 4]],
    [4, 2, [1, 5, 3, 4, 6]],
  ])("gives earlier notes one or two rounds when six rounds won't divide evenly, at level index %i", (level, newest, earlier) => {
    const counts = countByDegree(buildRounds(level));
    expect(counts[newest]).toBe(4);
    for (const degree of earlier) expect([1, 2]).toContain(counts[degree]);
    expect(buildRounds(level)).toHaveLength(10);
  });

  it("splits a note evenly above and below the tonic", () => {
    const fives = buildRounds(0).filter((round) => round.degree === 5);
    const above = fives.filter((round) => round.side === "above").length;
    expect([2, 3]).toContain(above);
  });

  it("uses both sides for a note that appears an even number of times", () => {
    const threes = buildRounds(1).filter((round) => round.degree === 3);
    expect(threes.filter((round) => round.side === "above")).toHaveLength(2);
    expect(threes.filter((round) => round.side === "below")).toHaveLength(2);
  });

  it("shuffles with the random source it is given", () => {
    const order = (random: () => number) =>
      buildRounds(0, random)
        .map((round) => round.degree)
        .join("");
    expect(order(() => 0)).not.toBe(order(() => 0.999));
  });
});

describe("tonicReturnsBefore", () => {
  it("brings the tonic back before every third round", () => {
    const rounds = Array.from({ length: 10 }, (_, i) => i).filter(tonicReturnsBefore);
    expect(rounds.map((i) => i + 1)).toEqual([3, 6, 9]);
  });
});
