"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CodeSequence } from "@/components/code-sequence";
import type { DraftValue } from "@/lib/game/draft";
import { formatHistoryFeedback } from "@/lib/game/format";
import type { AssistInfo, GameSettings, Guess, SessionPlayer } from "@/lib/game/types";

interface MatchConsoleProps {
  title: string;
  subtitle: string;
  settings: GameSettings;
  roomCode?: string | null;
  players: Array<Pick<SessionPlayer, "id" | "name" | "connected">>;
  currentPlayerName: string | null;
  roundLabel: string;
  statusTone: "neutral" | "success" | "warning";
  statusText: string;
  currentGuess: DraftValue[];
  activeSlotIndex: number;
  onSelectSymbol: (symbol: number) => void;
  onSelectSlot: (index: number) => void;
  onBackspace: () => void;
  onClearGuess: () => void;
  onSubmitGuess: () => void;
  canSubmit: boolean;
  locked?: boolean;
  guesses: Guess[];
  assistInfo: AssistInfo | null;
  assistEnabled: boolean;
  secret?: number[] | null;
  submitLabel?: string;
  isSymbolDisabled?: (symbol: number) => boolean;
  extraPanel?: ReactNode;
  opponentDraft?: {
    playerName: string;
    values: DraftValue[];
  } | null;
}

function renderTokenLabel(symbol: number, colorCount: number) {
  if (colorCount <= 6) {
    return <span aria-hidden="true" className="token-chip" />;
  }

  return (
    <>
      <span className="token-symbol">{symbol}</span>
    </>
  );
}

function getStartingPlayerIndex(
  settings: GameSettings,
  players: Array<Pick<SessionPlayer, "id" | "name" | "connected">>,
  guesses: Guess[],
  currentPlayerName: string | null
) {
  if (settings.mode === "solo" || players.length <= 1) {
    return 0;
  }

  const startingPlayerName = guesses[0]?.playerName ?? currentPlayerName;
  const startingPlayerIndex = players.findIndex((player) => player.name === startingPlayerName);

  return startingPlayerIndex >= 0 ? startingPlayerIndex : 0;
}

function getTotalTurnSlots(
  settings: GameSettings,
  players: Array<Pick<SessionPlayer, "id" | "name" | "connected">>,
  guesses: Guess[],
  currentPlayerName: string | null
) {
  if (settings.turnLimit === null) {
    return null;
  }

  if (settings.mode === "solo") {
    return settings.turnLimit;
  }

  const startingPlayerIndex = getStartingPlayerIndex(settings, players, guesses, currentPlayerName);
  return settings.turnLimit * Math.max(players.length, 1) - startingPlayerIndex;
}

export function MatchConsole({
  title,
  subtitle,
  settings,
  roomCode,
  players,
  currentPlayerName,
  roundLabel,
  statusTone,
  statusText,
  currentGuess,
  activeSlotIndex,
  onSelectSymbol,
  onSelectSlot,
  onBackspace,
  onClearGuess,
  onSubmitGuess,
  canSubmit,
  locked = false,
  guesses,
  assistInfo,
  assistEnabled,
  secret,
  submitLabel = "送信",
  isSymbolDisabled,
  extraPanel,
  opponentDraft
}: MatchConsoleProps) {
  const [isAssistOpen, setIsAssistOpen] = useState(false);
  const shouldShowStatusText =
    statusText.trim().length > 0 && !(statusTone === "neutral" && currentPlayerName);
  const startingPlayerIndex = getStartingPlayerIndex(settings, players, guesses, currentPlayerName);
  const totalTurnSlots = getTotalTurnSlots(settings, players, guesses, currentPlayerName);
  const remainingTurnSlots =
    totalTurnSlots === null ? null : Math.max(totalTurnSlots - guesses.length, 0);
  const futureTurns =
    totalTurnSlots === null
      ? []
      : Array.from({ length: Math.max(totalTurnSlots - guesses.length, 0) }, (_, index) => {
          const turnNumber = guesses.length + index + 1;
          const roundSize = settings.mode === "solo" ? 1 : Math.max(players.length, 1);
          const playerIndex =
            settings.mode === "solo"
              ? 0
              : (startingPlayerIndex + turnNumber - 1) % Math.max(players.length, 1);

          return {
            turnNumber,
            roundNumber: settings.mode === "solo" ? turnNumber : Math.floor((startingPlayerIndex + turnNumber - 1) / roundSize) + 1,
            playerName: players[playerIndex]?.name ?? "予定"
          };
        });

  useEffect(() => {
    setIsAssistOpen(false);
  }, [roomCode, settings.mode, settings.codeLength, settings.colorCount, settings.turnLimit, settings.allowDuplicates]);

  useEffect(() => {
    if (!assistEnabled || guesses.length === 0) {
      setIsAssistOpen(false);
    }
  }, [assistEnabled, guesses.length]);

  return (
    <main className="page-shell play-shell">
      <section className="hero">
        <div className="hero-row">
          <span className="pill">{title}</span>
          <span className="pill">{roundLabel}</span>
          {roomCode ? <span className="pill">部屋 {roomCode}</span> : null}
        </div>
        <div>
          <h1 className="hero-title">{title}</h1>
          <p className="hero-copy">{subtitle}</p>
        </div>
        <div className="inline-actions">
          <Link className="button secondary" href="/">
            設定に戻る
          </Link>
          <Link className="button ghost" href="/history">
            履歴
          </Link>
        </div>
      </section>

      <section className="section-grid">
        <div className="panel-grid two-column">
          <article className="card board-grid history-stage">
            <div className={`status-banner ${statusTone}`}>
              <span className="status-label">{currentPlayerName ? `現在手番: ${currentPlayerName}` : "対局"}</span>
              {shouldShowStatusText ? <p className="status-text">{statusText}</p> : null}
            </div>

            <div className="meta-list">
              <span className="meta-pill">コード長 {settings.codeLength}</span>
              <span className="meta-pill">色数 {settings.colorCount}</span>
              <span className="meta-pill">{settings.allowDuplicates ? "同色あり" : "同色なし"}</span>
              <span className="meta-pill">
                ターン制限 {settings.turnLimit === null ? "無制限" : settings.turnLimit}
              </span>
            </div>

            {opponentDraft ? (
              <div className="draft-panel">
                <span className="status-label">{opponentDraft.playerName} の現在入力</span>
                <div className="guess-slots compact-slots">
                  {opponentDraft.values.map((value, index) => (
                    <div key={`opponent-slot-${index}`} className={`guess-slot ${value === null ? "empty" : ""}`}>
                      <CodeSequence compact values={[value]} colorCount={settings.colorCount} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {secret ? (
              <div className="status-banner success">
                <span className="status-label">正解</span>
                <div className="status-text">
                  <CodeSequence values={secret} colorCount={settings.colorCount} />
                </div>
              </div>
            ) : null}
            <div className="history-stage-body">
              <div className="history-stage-header">
                <h2 className="card-title">履歴</h2>
                <div className="history-stage-meta">
                  <span className="subtle-copy">新しい推理ほど下に追加されます。</span>
                  {remainingTurnSlots !== null ? (
                    <span className="meta-pill">
                      {secret ? "未使用" : "残り"} {remainingTurnSlots} 手
                    </span>
                  ) : null}
                </div>
              </div>
              {guesses.length > 0 || futureTurns.length > 0 ? (
                <div className="history-list history-stage-list">
                  {guesses.map((guess) => (
                    <div key={`${guess.turnNumber}-${guess.createdAt}`} className="history-entry">
                      <div className="history-line">
                        <span className="history-turn">{guess.turnNumber}</span>
                        <span className="history-player">{guess.playerName}</span>
                        <CodeSequence
                          compact
                          wrap
                          className="history-code"
                          values={guess.values}
                          colorCount={settings.colorCount}
                        />
                        <span className="history-feedback">
                          {formatHistoryFeedback(guess.feedback.hits, guess.feedback.blows)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {futureTurns.map((futureTurn) => (
                    <div key={`future-turn-${futureTurn.turnNumber}`} className="history-entry future">
                      <div className="history-line">
                        <span className="history-turn">{futureTurn.turnNumber}</span>
                        <span className="history-player future-label">{futureTurn.playerName}</span>
                        <CodeSequence
                          compact
                          wrap
                          className="history-code"
                          values={Array.from({ length: settings.codeLength }, () => null)}
                          colorCount={settings.colorCount}
                        />
                        <span className="history-feedback future-text" aria-hidden="true" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="history-empty">まだ履歴はありません。</div>
              )}
            </div>
          </article>

          <aside className="section-grid">
            <article className="card">
              <h2 className="card-title">プレイヤー</h2>
              <div className="players-list" style={{ marginTop: "1rem" }}>
                {players.map((player) => (
                  <div key={player.id} className="player-pill">
                    <strong>{player.name}</strong>
                    <span className={`presence ${player.connected ? "online" : ""}`}>
                      {player.connected ? "接続中" : "切断中"}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="card">
              <h2 className="card-title">アシスト</h2>
              {assistEnabled ? (
                <>
                  <div className="inline-actions" style={{ marginTop: "1rem" }}>
                    <button className="button secondary" type="button" onClick={() => setIsAssistOpen((current) => !current)}>
                      {isAssistOpen ? "アシストを閉じる" : "アシストを表示"}
                    </button>
                  </div>
                  {isAssistOpen && assistInfo ? (
                    <div className="assist-grid" style={{ marginTop: "1rem" }}>
                      <div>
                        <div className="assist-value">{assistInfo.displayCount}</div>
                        <p className="card-copy">
                          {assistInfo.mode === "exact" ? "残り候補数" : "残り候補数の概算"}
                        </p>
                        {assistInfo.detail ? <p className="subtle-copy">{assistInfo.detail}</p> : null}
                      </div>
                      <p className="subtle-copy">{assistInfo.note}</p>
                      <div>
                        <strong>使用済み記号</strong>
                        <ul className="list-inline" style={{ marginTop: "0.5rem" }}>
                          {assistInfo.usedSymbols.length > 0 ? (
                            assistInfo.usedSymbols.map((value) => <li key={`used-${value}`}>{value}</li>)
                          ) : (
                            <li>まだありません</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <strong>未使用記号</strong>
                        <ul className="list-inline" style={{ marginTop: "0.5rem" }}>
                          {assistInfo.unusedSymbols.length > 0 ? (
                            assistInfo.unusedSymbols.map((value) => <li key={`unused-${value}`}>{value}</li>)
                          ) : (
                            <li>ありません</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <p className="card-copy" style={{ marginTop: "1rem" }}>
                      ボタンを押すとアシスト情報を表示します。
                    </p>
                  )}
                </>
              ) : (
                <p className="card-copy" style={{ marginTop: "1rem" }}>
                  アシストは無効です。
                </p>
              )}
            </article>

            {extraPanel}
          </aside>
        </div>
      </section>

      <div className="composer-dock">
        <div className="composer-shell">
          <div className="composer-head">
            <div>
              <span className="status-label">{currentPlayerName ? `${currentPlayerName} の入力` : "入力欄"}</span>
              <p className="status-text">スロットをクリックして位置を選び、その位置に記号を入力します。</p>
            </div>
          </div>

          <div className="guess-slots composer-slots">
            {currentGuess.map((value, index) => (
              <button
                key={`slot-button-${index}`}
                className={`guess-slot slot-button ${value === null ? "empty" : ""} ${activeSlotIndex === index ? "active" : ""}`}
                type="button"
                aria-label={
                  settings.colorCount <= 6
                    ? `入力位置 ${index + 1} ${value === null ? "未入力" : `色 ${value}`}`
                    : `入力位置 ${index + 1} ${value ?? "未入力"}`
                }
                onClick={() => onSelectSlot(index)}
                disabled={locked}
              >
                <CodeSequence compact values={[value]} colorCount={settings.colorCount} className="slot-sequence" />
              </button>
            ))}
          </div>

          <div className="token-grid composer-token-grid">
            {Array.from({ length: settings.colorCount }, (_, index) => index + 1).map((symbol) => (
              <button
                key={symbol}
                className={`token ${settings.colorCount <= 6 ? `color-${symbol}` : ""}`}
                type="button"
                aria-label={settings.colorCount <= 6 ? `色 ${symbol}` : `記号 ${symbol}`}
                disabled={locked || isSymbolDisabled?.(symbol) === true}
                onClick={() => onSelectSymbol(symbol)}
              >
                {renderTokenLabel(symbol, settings.colorCount)}
              </button>
            ))}
          </div>

          <div className="board-actions composer-actions">
            <button className="button secondary" type="button" onClick={onBackspace} disabled={locked}>
              ひとつ消す
            </button>
            <button className="button secondary" type="button" onClick={onClearGuess} disabled={locked}>
              全消去
            </button>
            <button className="button" type="button" onClick={onSubmitGuess} disabled={!canSubmit || locked}>
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
