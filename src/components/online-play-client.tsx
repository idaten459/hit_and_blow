"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { MatchConsole } from "@/components/match-console";
import { RoomCodeCopy } from "@/components/room-code-copy";
import { createEmptyDraft, findNextSlotIndex, hasAnyDraftValue, toGuessValues } from "@/lib/game/draft";
import { buildAssistInfo } from "@/lib/game/engine";
import type { MatchSummary, RoomStatePayload, SessionPlayer } from "@/lib/game/types";
import { getViewerPlayerName, mapRoomStateForViewer, mapSummaryForViewer } from "@/lib/player-display";
import { appendMatchSummary, loadOnlineSession, saveOnlineSession } from "@/lib/session/history";
import { getOrCreatePlayerToken } from "@/lib/session/token";
import { parseSettingsFromSearchParams } from "@/lib/settings";

interface RoomMutationResponse {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerId?: string;
}

export function OnlinePlayClient() {
  const searchParams = useSearchParams();
  const draftSettings = parseSettingsFromSearchParams(
    Object.fromEntries(searchParams.entries()),
    "online"
  );
  const socketRef = useRef<Socket | null>(null);
  const tokenRef = useRef<string>("");
  const savedSummaryRef = useRef<string | null>(null);
  const roomStateRef = useRef<RoomStatePayload | null>(null);
  const myPlayerIdRef = useRef<string | null>(null);

  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [currentGuess, setCurrentGuess] = useState<Array<number | null>>(() =>
    createEmptyDraft(draftSettings.codeLength)
  );
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [notice, setNotice] = useState("部屋を作成するか、既存の部屋コードで参加してください。");
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const activeSettings = roomState?.settings ?? draftSettings;
  const displayRoomState = useMemo(
    () => (roomState ? mapRoomStateForViewer(roomState, myPlayerId) : null),
    [myPlayerId, roomState]
  );
  const deferredGuesses = useDeferredValue(displayRoomState?.roundState?.guesses ?? []);
  const assistInfo =
    activeSettings.assistEnabled && displayRoomState?.roundState
      ? buildAssistInfo(activeSettings, deferredGuesses)
      : null;

  const currentPlayer = useMemo(() => {
    if (!displayRoomState?.roundState) {
      return null;
    }

    return displayRoomState.players[displayRoomState.roundState.currentPlayerIndex] ?? null;
  }, [displayRoomState]);

  const everyoneConnected = displayRoomState?.players.every((player) => player.connected) ?? false;
  const isMyTurn =
    currentPlayer?.id === myPlayerId && displayRoomState?.phase === "active" && everyoneConnected;
  const opponentDraft = useMemo(() => {
    if (!displayRoomState || !myPlayerId) {
      return null;
    }

    const otherPlayer = displayRoomState.players.find((player) => player.id !== myPlayerId);
    const draft = displayRoomState.drafts.find((entry) => entry.playerId === otherPlayer?.id);

    if (!otherPlayer || !draft || !hasAnyDraftValue(draft.values)) {
      return null;
    }

    return {
      playerName: otherPlayer.name,
      values: draft.values
    };
  }, [displayRoomState, myPlayerId]);

  const statusTone = summary ? "success" : isMyTurn ? "neutral" : "warning";
  const statusText = summary
    ? summary.winnerLabel
    : !everyoneConnected
      ? notice
      : isMyTurn
        ? "あなたの番です。"
        : `${currentPlayer?.name ?? "相手"} の入力待ちです。`;

  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  useEffect(() => {
    myPlayerIdRef.current = myPlayerId;
  }, [myPlayerId]);

  useEffect(() => {
    tokenRef.current = getOrCreatePlayerToken();
    const socket = io({
      autoConnect: true,
      path: "/socket.io"
    });
    socketRef.current = socket;
    const reconnectSession = loadOnlineSession();

    function describePlayer(playerId: string): string {
      const player = roomStateRef.current?.players.find((entry) => entry.id === playerId);

      if (player) {
        return getViewerPlayerName(player, myPlayerIdRef.current);
      }

      return "\u30d7\u30ec\u30a4\u30e4\u30fc";
      return roomStateRef.current?.players.find((player) => player.id === playerId)?.name ?? "プレイヤー";
    }

    function getDraftLength(): number {
      return roomStateRef.current?.settings?.codeLength ?? draftSettings.codeLength;
    }

    socket.on("connect", () => {
      setNotice("サーバに接続しました。");

      if (reconnectSession) {
        socket.emit(
          "room:join",
          {
            roomCode: reconnectSession.roomCode,
            token: reconnectSession.token
          },
          (response: RoomMutationResponse) => {
            if (!response.ok) {
              saveOnlineSession(null);
              return;
            }

            setMyPlayerId(response.playerId ?? null);
            setRoomCodeInput(response.roomCode ?? reconnectSession.roomCode);
          }
        );
      }
    });

    socket.on("disconnect", () => {
      setNotice("接続が切れました。自動で再接続を試みています。");
    });

    socket.on("room:state", (payload: RoomStatePayload) => {
      roomStateRef.current = payload;
      setRoomState(payload);
      setRoomCodeInput(payload.roomCode);
      setIsBusy(false);

      if (payload.phase === "active") {
        setSummary(null);
        savedSummaryRef.current = null;
      }
    });

    socket.on("game:start", () => {
      setNotice("2 人そろったので対局を開始しました。");
    });

    socket.on("round:resolved", () => {
      setCurrentGuess(createEmptyDraft(getDraftLength()));
      setActiveSlotIndex(0);
    });

    socket.on("player:disconnect", (payload: { playerId: string; reconnectDeadline: string }) => {
      setNotice(
        `${describePlayer(payload.playerId)} が切断しました。${new Date(payload.reconnectDeadline).toLocaleTimeString("ja-JP")} まで再接続を待ちます。`
      );
    });

    socket.on("player:reconnect", (payload: { playerId: string }) => {
      setNotice(`${describePlayer(payload.playerId)} が再接続しました。`);
    });

    socket.on("room:error", (message: string) => {
      setNotice(message);
      setIsBusy(false);
    });

    socket.on("game:end", (nextSummary: MatchSummary) => {
      const viewerSummary = mapSummaryForViewer(
        nextSummary,
        roomStateRef.current?.players ?? [],
        myPlayerIdRef.current
      );

      setSummary(viewerSummary);
      setNotice(viewerSummary.winnerLabel);
      setCurrentGuess(createEmptyDraft(getDraftLength()));
      setActiveSlotIndex(0);
      saveOnlineSession(null);

      if (savedSummaryRef.current !== viewerSummary.id) {
        appendMatchSummary(viewerSummary);
        savedSummaryRef.current = viewerSummary.id;
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!roomState || !myPlayerId) {
      return;
    }

    const ownDraft = roomState.drafts.find((entry) => entry.playerId === myPlayerId);

    if (!ownDraft) {
      return;
    }

    setCurrentGuess(ownDraft.values);
    const nextEmptyIndex = ownDraft.values.findIndex((value) => value === null);
    setActiveSlotIndex(nextEmptyIndex === -1 ? ownDraft.values.length - 1 : nextEmptyIndex);
  }, [myPlayerId, roomState?.drafts]);

  useEffect(() => {
    setCurrentGuess(createEmptyDraft(activeSettings.codeLength));
    setActiveSlotIndex(0);
  }, [activeSettings.codeLength, roomState?.roomCode, roomState?.phase]);

  function publishDraft(nextDraft: Array<number | null>) {
    socketRef.current?.emit("draft:update", {
      values: nextDraft
    });
  }

  function createRoom() {
    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    setIsBusy(true);
    setNotice("部屋を作成しています...");

    socket.emit(
      "room:create",
      {
        settings: draftSettings,
        token: tokenRef.current
      },
      (response: RoomMutationResponse) => {
        setIsBusy(false);

        if (!response.ok || !response.roomCode) {
          setNotice(response.error ?? "部屋の作成に失敗しました。");
          return;
        }

        setMyPlayerId(response.playerId ?? null);
        setRoomCodeInput(response.roomCode);
        setSummary(null);
        saveOnlineSession({
          roomCode: response.roomCode,
          token: tokenRef.current
        });
        setNotice(`部屋 ${response.roomCode} を作成しました。相手の参加を待っています。`);
      }
    );
  }

  function joinRoom(roomCode: string) {
    const socket = socketRef.current;
    const normalized = roomCode.trim().toUpperCase();

    if (!socket || normalized.length !== 6) {
      setNotice("部屋コードは 6 文字で入力してください。");
      return;
    }

    setIsBusy(true);
    setNotice(`部屋 ${normalized} に参加しています...`);

    socket.emit(
      "room:join",
      {
        roomCode: normalized,
        token: tokenRef.current
      },
      (response: RoomMutationResponse) => {
        setIsBusy(false);

        if (!response.ok || !response.roomCode) {
          setNotice(response.error ?? "部屋への参加に失敗しました。");
          return;
        }

        setMyPlayerId(response.playerId ?? null);
        setRoomCodeInput(response.roomCode);
        setSummary(null);
        saveOnlineSession({
          roomCode: response.roomCode,
          token: tokenRef.current
        });
        setNotice(`部屋 ${response.roomCode} に参加しました。`);
      }
    );
  }

  function pushSymbol(symbol: number) {
    if (!isMyTurn) {
      return;
    }

    const nextDraft = [...currentGuess];
    nextDraft[activeSlotIndex] = symbol;
    setCurrentGuess(nextDraft);
    setActiveSlotIndex(findNextSlotIndex(nextDraft, activeSlotIndex));
    publishDraft(nextDraft);
  }

  function popSymbol() {
    const nextDraft = [...currentGuess];
    let targetIndex = activeSlotIndex;

    if (nextDraft[targetIndex] === null) {
      for (let index = activeSlotIndex - 1; index >= 0; index -= 1) {
        if (nextDraft[index] !== null) {
          targetIndex = index;
          break;
        }
      }
    }

    nextDraft[targetIndex] = null;
    setCurrentGuess(nextDraft);
    setActiveSlotIndex(targetIndex);
    publishDraft(nextDraft);
  }

  function clearGuess() {
    const emptyDraft = createEmptyDraft(activeSettings.codeLength);
    setCurrentGuess(emptyDraft);
    setActiveSlotIndex(0);
    publishDraft(emptyDraft);
  }

  function submitGuess() {
    if (!socketRef.current || !roomState || currentGuess.some((value) => value === null)) {
      return;
    }

    socketRef.current.emit(
      "guess:submit",
      {
        values: toGuessValues(currentGuess)
      },
      (response: { ok: boolean; error?: string }) => {
        if (!response.ok) {
          setNotice(response.error ?? "この入力は送信できませんでした。");
          return;
        }

        const emptyDraft = createEmptyDraft(activeSettings.codeLength);
        setCurrentGuess(emptyDraft);
        setActiveSlotIndex(0);
      }
    );
  }

  if (!roomState || roomState.phase === "lobby") {
    const lobbyPlayers: Array<Pick<SessionPlayer, "id" | "name" | "connected">> =
      displayRoomState?.players ?? [];

    return (
      <main className="page-shell fade-up">
        <section className="hero">
          <div className="hero-row">
            <span className="pill">オンライン対戦</span>
            {roomState?.roomCode ? <RoomCodeCopy roomCode={roomState.roomCode} /> : null}
          </div>
          <div>
            <h1 className="hero-title">オンラインロビー</h1>
            <p className="hero-copy">
              部屋コードだけで参加できます。アカウントは不要です。誰かが切断した場合は 5 分間だけ再接続を待ちます。
            </p>
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
          <div className="status-banner neutral">
            <span className="status-label">状態</span>
            <p className="status-text">{notice}</p>
          </div>

          <div className="lobby-grid">
            <article className="card">
              <h2 className="card-title">部屋を作成</h2>
              <p className="card-copy">現在の設定で部屋と共有の秘密列を作成します。</p>
              <div className="meta-list" style={{ marginTop: "1rem" }}>
                <span className="meta-pill">コード長 {draftSettings.codeLength}</span>
                <span className="meta-pill">色数 {draftSettings.colorCount}</span>
                <span className="meta-pill">
                  {draftSettings.allowDuplicates ? "同色あり" : "同色なし"}
                </span>
              </div>
              <div className="inline-actions" style={{ marginTop: "1rem" }}>
                <button className="button" type="button" onClick={createRoom} disabled={isBusy}>
                  部屋を作る
                </button>
              </div>
            </article>

            <article className="card">
              <h2 className="card-title">部屋コードで参加</h2>
              <p className="card-copy">ホストから共有された 6 文字コードを入力します。</p>
              <div className="field" style={{ marginTop: "1rem" }}>
                <label htmlFor="roomCode">部屋コード</label>
                <input
                  id="roomCode"
                  className="input"
                  maxLength={6}
                  value={roomCodeInput}
                  onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                />
              </div>
              <div className="inline-actions" style={{ marginTop: "1rem" }}>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => joinRoom(roomCodeInput)}
                  disabled={isBusy}
                >
                  参加する
                </button>
              </div>
            </article>
          </div>

          {roomState ? (
            <article className="card">
              <h2 className="card-title">待機中のプレイヤー</h2>
              <div className="players-list" style={{ marginTop: "1rem" }}>
                {lobbyPlayers.map((player) => (
                  <div key={player.id} className="player-pill">
                    <strong>{getViewerPlayerName(player, myPlayerId)}</strong>
                    <span className={`presence ${player.connected ? "online" : ""}`}>
                      {player.connected ? "接続中" : "切断中"}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <MatchConsole
      title="オンライン対戦"
      subtitle="同じ秘密列を交互に推理し、正解が出た時点で終了するリアルタイム対戦です。"
      settings={activeSettings}
      roomCode={roomState.roomCode}
      players={displayRoomState?.players ?? []}
      currentPlayerName={currentPlayer?.name ?? null}
      roundLabel={`ラウンド ${roomState.roundState?.roundNumber ?? 1}`}
      statusTone={statusTone}
      statusText={statusText}
      currentGuess={currentGuess}
      activeSlotIndex={activeSlotIndex}
      onSelectSymbol={pushSymbol}
      onSelectSlot={setActiveSlotIndex}
      onBackspace={popSymbol}
      onClearGuess={clearGuess}
      onSubmitGuess={submitGuess}
      canSubmit={isMyTurn && currentGuess.every((value) => value !== null)}
      locked={!isMyTurn || roomState.phase !== "active" || summary !== null}
      guesses={displayRoomState?.roundState?.guesses ?? []}
      assistInfo={assistInfo}
      assistEnabled={activeSettings.assistEnabled}
      secret={summary?.secret ?? null}
      submitLabel="送信"
      opponentDraft={opponentDraft}
      extraPanel={
        <article className="card">
          <h2 className="card-title">対戦状況</h2>
          <p className="card-copy" style={{ marginTop: "0.8rem" }}>
            {notice}
          </p>
          {roomState.reconnectDeadline ? (
            <div className="status-banner warning" style={{ marginTop: "1rem" }}>
              <span className="status-label">再接続待ち</span>
              <p className="status-text">
                {new Date(roomState.reconnectDeadline).toLocaleTimeString("ja-JP")} まで再接続を待ちます。
              </p>
            </div>
          ) : null}
        </article>
      }
    />
  );
}
