import { describe, expect, it } from "vitest";
import type { Round, Side } from "./levels";
import { answerRound, currentRound, hasPassed, isFinished, missedNotes, score, startRun } from "./run";

const rounds = (degrees: number[], side: Side = "above"): Round[] => degrees.map((degree) => ({ degree, side }));

function play(degrees: number[], answers: number[]) {
  return answers.reduce(answerRound, startRun(rounds(degrees)));
}

const TEN = [1, 5, 1, 5, 1, 5, 1, 5, 1, 5];

describe("a run through a level", () => {
  it("starts on the first round with nothing scored", () => {
    const run = startRun(rounds([5, 1]));
    expect(currentRound(run)).toEqual({ degree: 5, side: "above" });
    expect(score(run)).toBe(0);
    expect(isFinished(run)).toBe(false);
  });

  it("scores a right answer and moves to the next round", () => {
    const run = play([5, 1], [5]);
    expect(score(run)).toBe(1);
    expect(currentRound(run)).toEqual({ degree: 1, side: "above" });
  });

  it("gives no score for a wrong answer but still moves on", () => {
    const run = play([5, 1], [3]);
    expect(score(run)).toBe(0);
    expect(currentRound(run)).toEqual({ degree: 1, side: "above" });
  });

  it("marks by scale degree, whichever side of the tonic the note was on", () => {
    expect(score(answerRound(startRun(rounds([5], "below")), 5))).toBe(1);
  });

  it("always plays every round, even once the pass mark is out of reach", () => {
    const run = play(TEN, [3, 3, 3]);
    expect(isFinished(run)).toBe(false);
  });

  it("finishes after the last round and ignores further answers", () => {
    const run = play([5, 1], [5, 1]);
    expect(isFinished(run)).toBe(true);
    expect(score(answerRound(run, 1))).toBe(2);
  });

  it("passes with nine out of ten", () => {
    expect(hasPassed(play(TEN, [1, 5, 1, 5, 1, 5, 1, 5, 1, 1]))).toBe(true);
  });

  it("fails with eight out of ten", () => {
    expect(hasPassed(play(TEN, [1, 5, 1, 5, 1, 5, 1, 5, 5, 1]))).toBe(false);
  });

  it("lists the missed notes in order, with how often each was missed", () => {
    const run = play([5, 3, 5, 1], [1, 4, 3, 1]);
    expect(missedNotes(run)).toEqual([
      { degree: 3, count: 1 },
      { degree: 5, count: 2 },
    ]);
  });
});
