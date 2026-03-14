import type { Guess, MatchSummary } from "./types";

export function formatCode(values: number[]): string {
  return values.join(" ");
}

export function describeGuess(guess: Guess): string {
  return `${guess.playerName}: ${formatCode(guess.values)} / ${guess.feedback.hits} Hit ${guess.feedback.blows} Blow`;
}

export function buildWinnerLabel(summary: MatchSummary): string {
  return summary.winnerLabel;
}
