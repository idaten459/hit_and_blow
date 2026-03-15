import { describe, expect, it } from "vitest";
import {
  EXACT_ASSIST_LIMIT,
  advanceRound,
  buildAssistInfo,
  createInitialRoundState,
  generateSecret,
  scoreGuess,
  validateGuessValues,
  validateSettings
} from "@/lib/game/engine";
import type { GameSettings, Guess, SessionPlayer } from "@/lib/game/types";

function makeSettings(overrides: Partial<GameSettings> = {}): GameSettings {
  return {
    mode: "solo",
    codeLength: 4,
    colorCount: 6,
    allowDuplicates: false,
    turnLimit: 10,
    assistEnabled: true,
    ...overrides
  };
}

function makePlayers(count: number): SessionPlayer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    name: `Player ${index + 1}`,
    token: `token-${index + 1}`,
    connected: true
  }));
}

function makeGuess(values: number[], hits: number, blows: number): Guess {
  return {
    values,
    feedback: {
      hits,
      blows,
      isCorrect: hits === values.length
    },
    roundNumber: 1,
    turnNumber: 1,
    createdAt: new Date().toISOString(),
    playerId: "player-1",
    playerName: "Player 1"
  };
}

describe("scoreGuess", () => {
  it("scores hits and blows without duplicates", () => {
    expect(scoreGuess([1, 2, 3, 4], [1, 4, 2, 5])).toEqual({
      hits: 1,
      blows: 2,
      isCorrect: false
    });
  });

  it("scores hits and blows with duplicates", () => {
    expect(scoreGuess([1, 1, 2, 2], [1, 2, 1, 2])).toEqual({
      hits: 2,
      blows: 2,
      isCorrect: false
    });
  });
});

describe("settings and guesses", () => {
  it("rejects invalid settings", () => {
    const result = validateSettings(
      makeSettings({
        codeLength: 5,
        colorCount: 4,
        allowDuplicates: false
      })
    );

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain("同色なし");
  });

  it("allows duplicate guesses even when the secret rule disables duplicates", () => {
    const result = validateGuessValues(makeSettings({ allowDuplicates: false }), [1, 1, 2, 3]);

    expect(result.isValid).toBe(true);
  });

  it("generates secrets without duplicates when disabled", () => {
    const secret = generateSecret(
      makeSettings({
        codeLength: 5,
        colorCount: 8,
        allowDuplicates: false
      })
    );

    expect(secret).toHaveLength(5);
    expect(new Set(secret).size).toBe(5);
  });
});

describe("advanceRound", () => {
  it("finishes a two-player match immediately when the first player solves it", () => {
    const settings = makeSettings({
      mode: "local",
      codeLength: 2,
      colorCount: 3,
      turnLimit: 5
    });
    const players = makePlayers(2);
    const initialState = createInitialRoundState(settings, players, [1, 2], 0);

    const firstGuess = advanceRound(initialState, "player-1", [1, 2]);
    expect(firstGuess.nextState.status).toBe("finished");
    expect(firstGuess.nextState.finalRoundNumber).toBe(1);
    expect(firstGuess.nextState.winnerIds).toEqual(["player-1"]);
    expect(firstGuess.roundResolved).toBe(true);

    expect(() => advanceRound(firstGuess.nextState, "player-2", [1, 2])).toThrow(
      "対局はすでに終了しています。"
    );
  });

  it("finishes a solo match at the turn limit when unsolved", () => {
    const settings = makeSettings({
      turnLimit: 1
    });
    const state = createInitialRoundState(settings, makePlayers(1), [1, 2, 3, 4], 0);

    const result = advanceRound(state, "player-1", [4, 3, 2, 1]);
    expect(result.nextState.status).toBe("finished");
    expect(result.nextState.winnerIds).toHaveLength(0);
  });

  it("finishes an online match immediately after a perfect hit", () => {
    const settings = makeSettings({
      mode: "online",
      codeLength: 6,
      colorCount: 8,
      allowDuplicates: true,
      turnLimit: 20
    });
    const players = makePlayers(2);
    const state = createInitialRoundState(settings, players, [1, 1, 2, 2, 3, 3], 0);

    const firstGuess = advanceRound(state, "player-1", [1, 1, 2, 2, 3, 3]);
    expect(firstGuess.feedback.isCorrect).toBe(true);
    expect(firstGuess.nextState.status).toBe("finished");
    expect(firstGuess.nextState.finalRoundNumber).toBe(1);
    expect(firstGuess.nextState.winnerIds).toEqual(["player-1"]);
  });
});

describe("buildAssistInfo", () => {
  it("returns an exact remaining count when candidate space is small", () => {
    const settings = makeSettings({
      codeLength: 2,
      colorCount: 3,
      allowDuplicates: false
    });
    const players = makePlayers(1);
    const state = createInitialRoundState(settings, players, [1, 2], 0);
    const first = advanceRound(state, "player-1", [1, 3]);
    const second = advanceRound(first.nextState, "player-1", [2, 3]);

    const assist = buildAssistInfo(settings, [first.guess, second.guess]);
    expect(assist.mode).toBe("exact");
    expect(assist.remainingCandidates).toBe(1);
    expect(assist.contradiction).toBe(false);
  });

  it("calculates an exact count for a narrowed game even when the initial candidate space exceeds the threshold", () => {
    const settings = makeSettings({
      codeLength: 6,
      colorCount: 8,
      allowDuplicates: true
    });
    const players = makePlayers(1);
    const state = createInitialRoundState(settings, players, [1, 1, 1, 1, 2, 2], 0);
    const turn = advanceRound(state, "player-1", [1, 1, 1, 1, 1, 1]);

    const assist = buildAssistInfo(settings, [turn.guess]);
    expect(assist.mode).toBe("exact");
    expect(assist.remainingCandidates).toBe(735);
    expect(assist.displayCount).toBe("735");
  });

  it("shows the threshold label and exact detail when the exact count exceeds it", () => {
    const settings = makeSettings({
      codeLength: 6,
      colorCount: 8,
      allowDuplicates: true
    });

    const assist = buildAssistInfo(settings, []);
    expect(assist.mode).toBe("exact");
    expect(assist.remainingCandidates).toBe(262_144);
    expect(assist.displayCount).toBe(`${EXACT_ASSIST_LIMIT.toLocaleString()}以上`);
    expect(assist.detail).toContain("262,144");
  });

  it("uses an estimate when the candidate space is too large to enumerate exactly", () => {
    const settings = makeSettings({
      codeLength: 7,
      colorCount: 10,
      allowDuplicates: true
    });

    const estimatedAssist = buildAssistInfo(settings, [makeGuess([1, 1, 1, 1, 1, 1, 1], 0, 0)]);
    expect(estimatedAssist.mode).toBe("estimate");
    expect(estimatedAssist.isAccurate).toBe(false);
  });
});
