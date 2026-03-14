import { describe, expect, it } from "vitest";
import { advanceRound, buildAssistInfo, createInitialRoundState, generateSecret, scoreGuess, validateGuessValues, validateSettings } from "@/lib/game/engine";
import type { GameSettings, SessionPlayer } from "@/lib/game/types";

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
  it("allows the second player to answer in the deciding round and resolves a draw", () => {
    const settings = makeSettings({
      mode: "local",
      codeLength: 2,
      colorCount: 3,
      turnLimit: 5
    });
    const players = makePlayers(2);
    const initialState = createInitialRoundState(settings, players, [1, 2], 0);

    const firstGuess = advanceRound(initialState, "player-1", [1, 2]);
    expect(firstGuess.nextState.status).toBe("active");
    expect(firstGuess.nextState.currentPlayerIndex).toBe(1);

    const secondGuess = advanceRound(firstGuess.nextState, "player-2", [1, 2]);
    expect(secondGuess.nextState.status).toBe("finished");
    expect(secondGuess.nextState.winnerIds).toEqual(["player-1", "player-2"]);
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

  it("falls back to summary mode when candidate space is large", () => {
    const settings = makeSettings({
      codeLength: 10,
      colorCount: 10,
      allowDuplicates: true
    });

    const assist = buildAssistInfo(settings, []);
    expect(assist.mode).toBe("summary");
    expect(assist.remainingCandidates).toBeNull();
  });
});
