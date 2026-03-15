import { describe, expect, it } from "vitest";
import type { MatchSummary, RoomStatePayload, SessionPlayer } from "@/lib/game/types";
import {
  getViewerPlayerName,
  mapGuessesForViewer,
  mapRoomStateForViewer,
  mapSummaryForViewer
} from "@/lib/player-display";

const DEFAULT_NAME_1 = "\u30d7\u30ec\u30a4\u30e4\u30fc1";
const DEFAULT_NAME_2 = "\u30d7\u30ec\u30a4\u30e4\u30fc2";
const YOU_LABEL = "\u3042\u306a\u305f";

function makePlayers(): SessionPlayer[] {
  return [
    {
      id: "player-1",
      name: DEFAULT_NAME_1,
      token: "token-1",
      connected: true
    },
    {
      id: "player-2",
      name: DEFAULT_NAME_2,
      token: "token-2",
      connected: true
    }
  ];
}

function makeSummary(): MatchSummary {
  return {
    id: "summary-1",
    mode: "online",
    settings: {
      mode: "online",
      codeLength: 4,
      colorCount: 6,
      allowDuplicates: false,
      turnLimit: 10,
      assistEnabled: true
    },
    players: [DEFAULT_NAME_1, DEFAULT_NAME_2],
    winnerLabel: `${DEFAULT_NAME_1}\u306e\u52dd\u3061`,
    secret: [1, 2, 3, 4],
    guesses: [
      {
        values: [1, 2, 3, 4],
        feedback: {
          hits: 4,
          blows: 0,
          isCorrect: true
        },
        roundNumber: 1,
        turnNumber: 1,
        createdAt: "2026-03-15T12:00:00.000Z",
        playerId: "player-1",
        playerName: DEFAULT_NAME_1
      },
      {
        values: [4, 3, 2, 1],
        feedback: {
          hits: 0,
          blows: 4,
          isCorrect: false
        },
        roundNumber: 1,
        turnNumber: 2,
        createdAt: "2026-03-15T12:00:01.000Z",
        playerId: "player-2",
        playerName: DEFAULT_NAME_2
      }
    ],
    roundsPlayed: 1,
    finishedAt: "2026-03-15T12:15:00.000Z"
  };
}

describe("player display", () => {
  it("shows the viewer as あなた only when the default name is used", () => {
    expect(
      getViewerPlayerName(
        {
          id: "player-1",
          name: DEFAULT_NAME_1
        },
        "player-1"
      )
    ).toBe(YOU_LABEL);

    expect(
      getViewerPlayerName(
        {
          id: "player-1",
          name: "custom-name"
        },
        "player-1"
      )
    ).toBe("custom-name");
  });

  it("maps guesses and summaries for the viewer", () => {
    const summary = makeSummary();
    const players = makePlayers();

    expect(mapGuessesForViewer(summary.guesses, "player-1")[0]?.playerName).toBe(YOU_LABEL);

    expect(mapSummaryForViewer(summary, players, "player-1")).toMatchObject({
      players: [YOU_LABEL, DEFAULT_NAME_2],
      winnerLabel: `${YOU_LABEL}\u306e\u52dd\u3061`
    });
  });

  it("maps room state names for the viewer without changing the opponent", () => {
    const players = makePlayers();
    const roomState: RoomStatePayload = {
      roomCode: "ABC123",
      phase: "active",
      settings: {
        mode: "online",
        codeLength: 4,
        colorCount: 6,
        allowDuplicates: false,
        turnLimit: 10,
        assistEnabled: true
      },
      players: players.map(({ id, name, connected }) => ({
        id,
        name,
        connected
      })),
      roundState: {
        settings: {
          mode: "online",
          codeLength: 4,
          colorCount: 6,
          allowDuplicates: false,
          turnLimit: 10,
          assistEnabled: true
        },
        guesses: makeSummary().guesses,
        roundNumber: 1,
        currentPlayerIndex: 0,
        status: "active",
        finalRoundNumber: null,
        winnerIds: [],
        startedAt: "2026-03-15T12:00:00.000Z",
        endedAt: null
      },
      reconnectDeadline: null,
      drafts: []
    };

    expect(mapRoomStateForViewer(roomState, "player-1")).toMatchObject({
      players: [
        {
          id: "player-1",
          name: YOU_LABEL
        },
        {
          id: "player-2",
          name: DEFAULT_NAME_2
        }
      ],
      roundState: {
        guesses: [
          {
            playerName: YOU_LABEL
          },
          {
            playerName: DEFAULT_NAME_2
          }
        ]
      }
    });
  });
});
