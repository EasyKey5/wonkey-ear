import type { Side } from "./levels";

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const LOWEST_TONIC = 48; // C3
const TONIC_CHOICES = 12;

// Degree 1 always sits an octave from the tonic, because a unison vanishes into the drone.
export function degreeMidi(tonic: number, degree: number, side: Side): number {
  const semitones = MAJOR_SCALE[degree - 1];
  if (side === "below") return tonic + semitones - 12;
  return tonic + (degree === 1 ? 12 : semitones);
}

export const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export const randomTonic = (random: () => number = Math.random) =>
  LOWEST_TONIC + Math.floor(random() * TONIC_CHOICES);
