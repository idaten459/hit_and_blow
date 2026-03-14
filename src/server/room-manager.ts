import type { Server, Socket } from "socket.io";
import { advanceRound, createInitialRoundState, generateSecret, validateSettings } from "../lib/game/engine";
import { createEmptyDraft } from "../lib/game/draft";
import { createMatchSummary } from "../lib/game/summary";
import type { GameSettings, PlayerDraft, RoomStatePayload, RoundState, SessionPlayer } from "../lib/game/types";

interface Room {
  code: string;
  phase: "lobby" | "active" | "finished";
  settings: GameSettings;
  players: SessionPlayer[];
  roundState: RoundState | null;
  reconnectDeadline: string | null;
  reconnectExpiresAt: number | null;
  lastTouchedAt: number;
  drafts: PlayerDraft[];
}

interface JoinPayload {
  roomCode: string;
  token: string;
}

interface CreatePayload {
  settings: GameSettings;
  token: string;
}

interface GuessPayload {
  values: number[];
}

interface DraftPayload {
  values: Array<number | null>;
}

type RoomAck = (response: { ok: boolean; error?: string; roomCode?: string; playerId?: string }) => void;

type GuessAck = (response: { ok: boolean; error?: string }) => void;

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_RECONNECT_WINDOW_MS = 5 * 60 * 1000;
const ROOM_IDLE_TTL_MS = 15 * 60 * 1000;
const rooms = new Map<string, Room>();

function randomIndex(max: number): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % max;
  }

  return Math.floor(Math.random() * max);
}

function createRoomCode(): string {
  let code = "";

  for (let index = 0; index < 6; index += 1) {
    code += ROOM_CODE_ALPHABET[randomIndex(ROOM_CODE_ALPHABET.length)];
  }

  return code;
}

function makeUniqueRoomCode(): string {
  let code = createRoomCode();

  while (rooms.has(code)) {
    code = createRoomCode();
  }

  return code;
}

function buildPublicState(room: Room): RoomStatePayload {
  return {
    roomCode: room.code,
    phase: room.phase,
    settings: room.settings,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      connected: player.connected
    })),
    roundState: room.roundState
      ? {
          settings: room.roundState.settings,
          guesses: room.roundState.guesses,
          roundNumber: room.roundState.roundNumber,
          currentPlayerIndex: room.roundState.currentPlayerIndex,
          status: room.roundState.status,
          finalRoundNumber: room.roundState.finalRoundNumber,
          winnerIds: room.roundState.winnerIds,
          startedAt: room.roundState.startedAt,
          endedAt: room.roundState.endedAt
        }
      : null,
    reconnectDeadline: room.reconnectDeadline,
    drafts: room.drafts
  };
}

function touchRoom(room: Room): void {
  room.lastTouchedAt = Date.now();
}

function createPlayer(token: string, index: number): SessionPlayer {
  return {
    id: `player-${index + 1}`,
    name: `プレイヤー${index + 1}`,
    token,
    connected: true
  };
}

function ensureDraft(room: Room, playerId: string): void {
  if (room.drafts.some((entry) => entry.playerId === playerId)) {
    return;
  }

  room.drafts.push({
    playerId,
    values: createEmptyDraft(room.settings.codeLength)
  });
}

function resetDraft(room: Room, playerId: string): void {
  room.drafts = room.drafts.map((entry) =>
    entry.playerId === playerId
      ? {
          ...entry,
          values: createEmptyDraft(room.settings.codeLength)
        }
      : entry
  );
}

function broadcastRoom(io: Server, room: Room): void {
  io.to(room.code).emit("room:state", buildPublicState(room));
}

function startGame(io: Server, room: Room): void {
  room.phase = "active";
  room.reconnectDeadline = null;
  room.reconnectExpiresAt = null;
  room.drafts = room.players.map((player) => ({
    playerId: player.id,
    values: createEmptyDraft(room.settings.codeLength)
  }));
  room.roundState = createInitialRoundState(
    room.settings,
    room.players,
    generateSecret(room.settings),
    randomIndex(room.players.length)
  );
  touchRoom(room);
  broadcastRoom(io, room);
  io.to(room.code).emit("game:start", buildPublicState(room));
}

function findRoomBySocket(socket: Socket): Room | null {
  const roomCode = socket.data.roomCode as string | undefined;
  return roomCode ? rooms.get(roomCode) ?? null : null;
}

function cleanupRooms(): void {
  const now = Date.now();

  rooms.forEach((room, roomCode) => {
    if (room.reconnectExpiresAt !== null && room.reconnectExpiresAt <= now) {
      rooms.delete(roomCode);
      return;
    }

    if (room.lastTouchedAt + ROOM_IDLE_TTL_MS <= now) {
      rooms.delete(roomCode);
    }
  });
}

export function registerRoomManager(io: Server): void {
  setInterval(cleanupRooms, 60_000).unref();

  io.on("connection", (socket) => {
    socket.on("room:create", (payload: CreatePayload, ack?: RoomAck) => {
      const validation = validateSettings(payload.settings);

      if (!validation.isValid) {
        ack?.({
          ok: false,
          error: validation.errors.join(" ")
        });
        return;
      }

      const roomCode = makeUniqueRoomCode();
      const player = createPlayer(payload.token, 0);
      const room: Room = {
        code: roomCode,
        phase: "lobby",
        settings: {
          ...payload.settings,
          mode: "online"
        },
        players: [player],
        roundState: null,
        reconnectDeadline: null,
        reconnectExpiresAt: null,
        lastTouchedAt: Date.now(),
        drafts: [
          {
            playerId: player.id,
            values: createEmptyDraft(payload.settings.codeLength)
          }
        ]
      };

      rooms.set(roomCode, room);
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.playerId = player.id;
      touchRoom(room);
      socket.emit("room:state", buildPublicState(room));
      ack?.({
        ok: true,
        roomCode,
        playerId: player.id
      });
    });

    socket.on("room:join", (payload: JoinPayload, ack?: RoomAck) => {
      const roomCode = payload.roomCode.trim().toUpperCase();
      const room = rooms.get(roomCode);

      if (!room) {
        ack?.({
          ok: false,
          error: "指定された部屋は見つかりません。"
        });
        return;
      }

      let player = room.players.find((entry) => entry.token === payload.token);

      if (!player) {
        if (room.players.length >= 2) {
          ack?.({
            ok: false,
            error: "この部屋は満員です。"
          });
          return;
        }

        player = createPlayer(payload.token, room.players.length);
        room.players.push(player);
        ensureDraft(room, player.id);
      }

      const wasDisconnected = player.connected === false;
      player.connected = true;
      room.reconnectDeadline = room.players.some((entry) => entry.connected === false)
        ? room.reconnectDeadline
        : null;
      room.reconnectExpiresAt = room.players.some((entry) => entry.connected === false)
        ? room.reconnectExpiresAt
        : null;

      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.playerId = player.id;
      touchRoom(room);
      broadcastRoom(io, room);

      if (wasDisconnected) {
        io.to(room.code).emit("player:reconnect", {
          playerId: player.id
        });
      }

      if (room.players.length === 2 && room.phase === "lobby") {
        startGame(io, room);
      }

      ack?.({
        ok: true,
        roomCode,
        playerId: player.id
      });
    });

    socket.on("draft:update", (payload: DraftPayload) => {
      const room = findRoomBySocket(socket);
      const playerId = socket.data.playerId as string | undefined;

      if (!room || !playerId) {
        return;
      }

      room.drafts = room.drafts.map((entry) =>
        entry.playerId === playerId
          ? {
              ...entry,
              values: payload.values.slice(0, room.settings.codeLength)
            }
          : entry
      );
      touchRoom(room);
      broadcastRoom(io, room);
    });

    socket.on("guess:submit", (payload: GuessPayload, ack?: GuessAck) => {
      const room = findRoomBySocket(socket);
      const playerId = socket.data.playerId as string | undefined;

      if (!room || !room.roundState || !playerId) {
        ack?.({
          ok: false,
          error: "対局状態が見つかりません。"
        });
        return;
      }

      const currentPlayer = room.players[room.roundState.currentPlayerIndex];

      if (!currentPlayer || currentPlayer.id !== playerId) {
        ack?.({
          ok: false,
          error: "現在はあなたの番ではありません。"
        });
        return;
      }

      try {
        const next = advanceRound(room.roundState, playerId, payload.values);
        room.roundState = next.nextState;
        room.phase = next.nextState.status === "finished" ? "finished" : "active";
        resetDraft(room, playerId);
        touchRoom(room);
        broadcastRoom(io, room);

        if (next.roundResolved) {
          io.to(room.code).emit("round:resolved", {
            roundNumber: next.guess.roundNumber
          });
        }

        if (room.phase === "finished" && room.roundState.status === "finished") {
          const summary = createMatchSummary(room.roundState);
          io.to(room.code).emit("game:end", summary);
        }

        ack?.({
          ok: true
        });
      } catch (error) {
        ack?.({
          ok: false,
          error: error instanceof Error ? error.message : "入力の処理に失敗しました。"
        });
      }
    });

    socket.on("disconnect", () => {
      const room = findRoomBySocket(socket);
      const playerId = socket.data.playerId as string | undefined;

      if (!room || !playerId) {
        return;
      }

      const player = room.players.find((entry) => entry.id === playerId);

      if (!player) {
        return;
      }

      player.connected = false;
      room.reconnectExpiresAt = Date.now() + ROOM_RECONNECT_WINDOW_MS;
      room.reconnectDeadline = new Date(room.reconnectExpiresAt).toISOString();
      touchRoom(room);
      broadcastRoom(io, room);
      io.to(room.code).emit("player:disconnect", {
        playerId,
        reconnectDeadline: room.reconnectDeadline
      });
    });
  });
}
