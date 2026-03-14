import type { MatchSummary, RoundState } from "./types";

function getWinnerLabel(state: RoundState): string {
  if (state.winnerIds.length === 0) {
    return state.players.length === 1 ? "未達成" : "ターン制限に到達";
  }

  if (state.winnerIds.length > 1) {
    return "引き分け";
  }

  const winner = state.players.find((player) => player.id === state.winnerIds[0]);
  return winner ? `${winner.name} の勝ち` : "勝者確定";
}

export function createMatchSummary(state: RoundState): MatchSummary {
  if (!state.secret || state.status !== "finished") {
    throw new Error("Finished round state with a secret is required.");
  }

  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    mode: state.settings.mode,
    settings: state.settings,
    players: state.players.map((player) => player.name),
    winnerLabel: getWinnerLabel(state),
    secret: state.secret,
    guesses: state.guesses,
    roundsPlayed: Math.max(...state.guesses.map((guess) => guess.roundNumber), 0),
    finishedAt: state.endedAt ?? new Date().toISOString()
  };
}
