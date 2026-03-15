import type { Guess, MatchSummary, RoundState } from "./types";

export function formatCode(values: number[]): string {
  return values.join(" ");
}

export function describeGuess(guess: Guess): string {
  return `${guess.playerName}: ${formatCode(guess.values)} / ${guess.feedback.hits} Hit ${guess.feedback.blows} Blow`;
}

export function formatHistoryFeedback(hits: number, blows: number): string {
  return `${hits} Hit / ${blows} Blow`;
}

export function buildWinnerLabel(summary: MatchSummary): string {
  return summary.winnerLabel;
}

export function getPendingRoundResolutionMessage(
  state: Pick<RoundState, "guesses" | "roundNumber" | "status" | "finalRoundNumber"> | null
): string | null {
  if (!state || state.status !== "active" || state.finalRoundNumber !== state.roundNumber) {
    return null;
  }

  for (let index = state.guesses.length - 1; index >= 0; index -= 1) {
    const guess = state.guesses[index];

    if (guess.roundNumber === state.roundNumber && guess.feedback.isCorrect) {
      return `${guess.playerName} が正解しました。同じラウンドの最終手番まで続行します。`;
    }
  }

  return "正解が出ました。同じラウンドの最終手番まで続行します。";
}
