import { describe, expect, it } from "vitest";
import { degreeMidi, midiHz, randomTonic } from "./notes";

const C3 = 48;

describe("degreeMidi", () => {
  it.each([
    [2, "above", 50],
    [3, "above", 52],
    [4, "above", 53],
    [5, "above", 55],
    [6, "above", 57],
    [7, "above", 59],
    [2, "below", 38],
    [3, "below", 40],
    [4, "below", 41],
    [5, "below", 43],
    [6, "below", 45],
    [7, "below", 47],
  ] as const)("places degree %i %s a C3 tonic in the major scale", (degree, side, midi) => {
    expect(degreeMidi(C3, degree, side)).toBe(midi);
  });

  it("plays degree 1 an octave away, because a unison would vanish into the drone", () => {
    expect(degreeMidi(C3, 1, "above")).toBe(60);
    expect(degreeMidi(C3, 1, "below")).toBe(36);
  });
});

describe("midiHz", () => {
  it("tunes to equal temperament from A440", () => {
    expect(midiHz(69)).toBeCloseTo(440, 6);
    expect(midiHz(57)).toBeCloseTo(220, 6);
    expect(midiHz(48)).toBeCloseTo(130.813, 2);
  });
});

describe("randomTonic", () => {
  it("stays between C3 and B3", () => {
    expect(randomTonic(() => 0)).toBe(48);
    expect(randomTonic(() => 0.999)).toBe(59);
  });
});
