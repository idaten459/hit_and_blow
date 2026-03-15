import type { Guess, MatchSummary, RoomStatePayload, SessionPlayer } from "@/lib/game/types";

const YOU_LABEL = "\u3042\u306a\u305f";
const DEFAULT_PLAYER_NAME_PATTERN = /^\u30d7\u30ec\u30a4\u30e4\u30fc\d+$/;

function isDefaultPlayerName(name: string): boolean {
  return DEFAULT_PLAYER_NAME_PATTERN.test(name);
}

export function getViewerPlayerName(
  player: Pick<SessionPlayer, "id" | "name">,
  viewerPlayerId: string | null
): string {
  if (viewerPlayerId !== null && player.id === viewerPlayerId && isDefaultPlayerName(player.name)) {
    return YOU_LABEL;
  }

  return player.name;
}

export function mapPlayersForViewer<T extends Pick<SessionPlayer, "id" | "name">>(
  players: readonly T[],
  viewerPlayerId: string | null
): T[] {
  return players.map((player) => ({
    ...player,
    name: getViewerPlayerName(player, viewerPlayerId)
  }));
}

export function mapGuessesForViewer(
  guesses: readonly Guess[],
  viewerPlayerId: string | null
): Guess[] {
  return guesses.map((guess) =>
    viewerPlayerId !== null &&
    guess.playerId === viewerPlayerId &&
    isDefaultPlayerName(guess.playerName)
      ? {
          ...guess,
          playerName: YOU_LABEL
        }
      : guess
  );
}

export function mapRoomStateForViewer(
  roomState: RoomStatePayload,
  viewerPlayerId: string | null
): RoomStatePayload {
  const players = mapPlayersForViewer(roomState.players, viewerPlayerId);

  return {
    ...roomState,
    players,
    roundState: roomState.roundState
      ? {
          ...roomState.roundState,
          guesses: mapGuessesForViewer(roomState.roundState.guesses, viewerPlayerId)
        }
      : null
  };
}

export function mapSummaryForViewer(
  summary: MatchSummary,
  players: readonly Pick<SessionPlayer, "id" | "name">[],
  viewerPlayerId: string | null
): MatchSummary {
  const viewer = players.find((player) => player.id === viewerPlayerId);

  if (!viewer || !isDefaultPlayerName(viewer.name)) {
    return summary;
  }

  const viewerName = viewer.name;
  const replaceViewerName = (value: string) => value.split(viewerName).join(YOU_LABEL);

  return {
    ...summary,
    players: summary.players.map((playerName) => (playerName === viewerName ? YOU_LABEL : playerName)),
    winnerLabel: replaceViewerName(summary.winnerLabel),
    guesses: summary.guesses.map((guess) =>
      guess.playerId === viewerPlayerId && guess.playerName === viewerName
        ? {
            ...guess,
            playerName: YOU_LABEL
          }
        : guess
    )
  };
}
