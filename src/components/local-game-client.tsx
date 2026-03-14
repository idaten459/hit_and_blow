"use client";

import { useDeferredValue, useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { MatchConsole } from "@/components/match-console";
import { createEmptyDraft, findNextSlotIndex, toGuessValues } from "@/lib/game/draft";
import { advanceRound, buildAssistInfo, createInitialRoundState, generateSecret } from "@/lib/game/engine";
import { createMatchSummary } from "@/lib/game/summary";
import type { GameMode, GameSettings, RoundState, SessionPlayer } from "@/lib/game/types";
import { appendMatchSummary } from "@/lib/session/history";
import { parseSettingsFromSearchParams } from "@/lib/settings";

function buildPlayers(mode: GameMode): SessionPlayer[] {
  if (mode === "solo") {
    return [
      {
        id: "solo-player",
        name: "あなた",
        token: "local-solo",
        connected: true
      }
    ];
  }

  return [
    {
      id: "player-1",
      name: "プレイヤー1",
      token: "local-1",
      connected: true
    },
    {
      id: "player-2",
      name: "プレイヤー2",
      token: "local-2",
      connected: true
    }
  ];
}

function createMatch(settings: GameSettings, players: SessionPlayer[]): RoundState {
  const startingPlayerIndex = players.length === 1 ? 0 : Math.floor(Math.random() * players.length);
  return createInitialRoundState(settings, players, generateSecret(settings), startingPlayerIndex);
}

function getStatus(state: RoundState): { tone: "neutral" | "success" | "warning"; text: string } {
  if (state.status === "finished") {
    if (state.winnerIds.length === 0) {
      return {
        tone: "warning",
        text: "ターン制限に達したため終了しました。"
      };
    }

    if (state.winnerIds.length > 1) {
      return {
        tone: "success",
        text: "同じラウンドで両者が正解したため引き分けです。"
      };
    }

    const winner = state.players.find((player) => player.id === state.winnerIds[0]);
    return {
      tone: "success",
      text: `${winner?.name ?? "プレイヤー"} が正解しました。`
    };
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  return {
    tone: "neutral",
    text: `${currentPlayer?.name ?? "プレイヤー"} の入力中です。`
  };
}

export function LocalGameClient({ mode }: Readonly<{ mode: "solo" | "local" }>) {
  const searchParams = useSearchParams();
  const settings = parseSettingsFromSearchParams(Object.fromEntries(searchParams.entries()), mode);
  const settingsKey = searchParams.toString();
  const [isPending, startTransition] = useTransition();
  const [roundState, setRoundState] = useState<RoundState>(() => createMatch(settings, buildPlayers(mode)));
  const [currentGuess, setCurrentGuess] = useState<Array<number | null>>(() =>
    createEmptyDraft(settings.codeLength)
  );
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const savedSummaryRef = useRef(false);
  const deferredGuesses = useDeferredValue(roundState.guesses);

  useEffect(() => {
    const players = buildPlayers(mode);
    setRoundState(createMatch(settings, players));
    setCurrentGuess(createEmptyDraft(settings.codeLength));
    setActiveSlotIndex(0);
    savedSummaryRef.current = false;
  }, [mode, settingsKey]);

  useEffect(() => {
    if (roundState.status !== "finished" || savedSummaryRef.current === true) {
      return;
    }

    appendMatchSummary(createMatchSummary(roundState));
    savedSummaryRef.current = true;
  }, [roundState]);

  const assistInfo =
    settings.assistEnabled === true ? buildAssistInfo(settings, deferredGuesses) : null;

  const currentPlayer = roundState.players[roundState.currentPlayerIndex] ?? null;
  const status = getStatus(roundState);

  function resetMatch() {
    const players = buildPlayers(mode);
    setRoundState(createMatch(settings, players));
    setCurrentGuess(createEmptyDraft(settings.codeLength));
    setActiveSlotIndex(0);
    savedSummaryRef.current = false;
  }

  function pushSymbol(symbol: number) {
    if (roundState.status === "finished") {
      return;
    }

    const nextGuess = [...currentGuess];
    nextGuess[activeSlotIndex] = symbol;
    setCurrentGuess(nextGuess);
    setActiveSlotIndex(findNextSlotIndex(nextGuess, activeSlotIndex));
  }

  function popSymbol() {
    const nextGuess = [...currentGuess];
    let targetIndex = activeSlotIndex;

    if (nextGuess[targetIndex] === null) {
      for (let index = activeSlotIndex - 1; index >= 0; index -= 1) {
        if (nextGuess[index] !== null) {
          targetIndex = index;
          break;
        }
      }
    }

    nextGuess[targetIndex] = null;
    setCurrentGuess(nextGuess);
    setActiveSlotIndex(targetIndex);
  }

  function clearGuess() {
    setCurrentGuess(createEmptyDraft(settings.codeLength));
    setActiveSlotIndex(0);
  }

  function submitGuess() {
    if (currentGuess.some((value) => value === null) || !currentPlayer) {
      return;
    }

    const next = advanceRound(roundState, currentPlayer.id, toGuessValues(currentGuess));

    startTransition(() => {
      setRoundState(next.nextState);
      setCurrentGuess(createEmptyDraft(settings.codeLength));
      setActiveSlotIndex(0);
    });
  }

  const roundLabel = mode === "solo" ? `ターン ${roundState.roundNumber}` : `ラウンド ${roundState.roundNumber}`;

  return (
    <MatchConsole
      title={mode === "solo" ? "1人プレイ" : "1端末で2人プレイ"}
      subtitle={
        mode === "solo"
          ? "完全ランダムな秘密列を、制限ターン内に解き切ります。"
          : "1台の端末を共有し、同じ秘密列を交互に推理します。"
      }
      settings={settings}
      players={roundState.players}
      currentPlayerName={currentPlayer?.name ?? null}
      roundLabel={roundLabel}
      statusTone={status.tone}
      statusText={status.text}
      currentGuess={currentGuess}
      activeSlotIndex={activeSlotIndex}
      onSelectSymbol={pushSymbol}
      onSelectSlot={setActiveSlotIndex}
      onBackspace={popSymbol}
      onClearGuess={clearGuess}
      onSubmitGuess={submitGuess}
      canSubmit={currentGuess.every((value) => value !== null) && !isPending && roundState.status !== "finished"}
      locked={roundState.status === "finished"}
      guesses={roundState.guesses}
      assistInfo={assistInfo}
      assistEnabled={settings.assistEnabled}
      secret={roundState.status === "finished" ? roundState.secret ?? null : null}
      submitLabel={mode === "solo" ? "推理を確定" : "この手を確定"}
      extraPanel={
        <article className="card">
          <h2 className="card-title">対局メモ</h2>
          <p className="card-copy" style={{ marginTop: "0.9rem" }}>
            {mode === "solo"
              ? "1 ターンにつき 1 回だけ推理します。"
              : "1 ラウンドで両者が 1 回ずつ推理し、同ラウンドでの正解は引き分けです。"}
          </p>
          <div className="inline-actions" style={{ marginTop: "1rem" }}>
            <button className="button" type="button" onClick={resetMatch}>
              新しいゲーム
            </button>
          </div>
        </article>
      }
    />
  );
}
