export type GameMode = "solo" | "local" | "online";

export interface GameSettings {
  mode: GameMode;
  codeLength: number;
  colorCount: number;
  allowDuplicates: boolean;
  turnLimit: number | null;
  assistEnabled: boolean;
}

export interface GuessFeedback {
  hits: number;
  blows: number;
  isCorrect: boolean;
}

export interface Guess {
  values: number[];
  feedback: GuessFeedback;
  roundNumber: number;
  turnNumber: number;
  createdAt: string;
  playerId: string;
  playerName: string;
}

export interface SessionPlayer {
  id: string;
  name: string;
  token: string;
  connected: boolean;
}

export interface PlayerDraft {
  playerId: string;
  values: Array<number | null>;
}

export interface AssistInfo {
  mode: "exact" | "summary";
  candidateSpace: number;
  isAccurate: boolean;
  remainingCandidates: number | null;
  contradiction: boolean;
  usedSymbols: number[];
  unusedSymbols: number[];
  note?: string;
}

export interface RoundState {
  settings: GameSettings;
  players: SessionPlayer[];
  guesses: Guess[];
  roundNumber: number;
  currentPlayerIndex: number;
  status: "active" | "finished";
  finalRoundNumber: number | null;
  winnerIds: string[];
  startedAt: string;
  endedAt: string | null;
  secret?: number[];
}

export interface MatchSummary {
  id: string;
  mode: GameMode;
  settings: GameSettings;
  players: string[];
  winnerLabel: string;
  secret: number[];
  guesses: Guess[];
  roundsPlayed: number;
  finishedAt: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface RoomStatePayload {
  roomCode: string;
  phase: "lobby" | "active" | "finished";
  settings: GameSettings | null;
  players: Array<Pick<SessionPlayer, "id" | "name" | "connected">>;
  roundState: Omit<RoundState, "players" | "secret"> | null;
  reconnectDeadline: string | null;
  drafts: PlayerDraft[];
}
