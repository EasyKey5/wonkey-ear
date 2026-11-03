import { PASS_MARK, type Round } from "./levels";

export interface Run {
  rounds: Round[];
  answers: number[];
}

export interface MissedNote {
  degree: number;
  count: number;
}

export const startRun = (rounds: Round[]): Run => ({ rounds, answers: [] });
export const isFinished = (run: Run) => run.answers.length >= run.rounds.length;
export const currentRound = (run: Run): Round | undefined => run.rounds[run.answers.length];

export function answerRound(run: Run, degree: number): Run {
  return isFinished(run) ? run : { ...run, answers: [...run.answers, degree] };
}

export const score = (run: Run) => run.answers.filter((answer, i) => answer === run.rounds[i].degree).length;
export const hasPassed = (run: Run) => score(run) >= PASS_MARK;

export function missedNotes(run: Run): MissedNote[] {
  const counts = new Map<number, number>();
  run.answers.forEach((answer, i) => {
    const { degree } = run.rounds[i];
    if (answer !== degree) counts.set(degree, (counts.get(degree) ?? 0) + 1);
  });
  return [...counts]
    .map(([degree, count]) => ({ degree, count }))
    .sort((a, b) => a.degree - b.degree);
}
