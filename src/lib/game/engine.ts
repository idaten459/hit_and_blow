import type {
  AssistInfo,
  GameSettings,
  Guess,
  GuessFeedback,
  RoundState,
  SessionPlayer,
  ValidationResult
} from "./types";

export const EXACT_ASSIST_LIMIT = 100_000;
const EXACT_ASSIST_SPACE_LIMIT = 300_000;
const ASSIST_SAMPLE_SIZE = 12_000;

function randomInt(max: number): number {
  if (max <= 0) {
    return 0;
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % max;
  }

  return Math.floor(Math.random() * max);
}

export function getDefaultSettings(mode: GameSettings["mode"] = "solo"): GameSettings {
  return {
    mode,
    codeLength: 4,
    colorCount: 6,
    allowDuplicates: false,
    turnLimit: 10,
    assistEnabled: true
  };
}

export function validateSettings(settings: GameSettings): ValidationResult {
  const errors: string[] = [];

  if (settings.codeLength < 1 || settings.codeLength > 10) {
    errors.push("コード長は 1 から 10 の範囲で設定してください。");
  }

  if (settings.colorCount < 1 || settings.colorCount > 10) {
    errors.push("色数は 1 から 10 の範囲で設定してください。");
  }

  if (!settings.allowDuplicates && settings.colorCount < settings.codeLength) {
    errors.push("同色なしの場合は、色数をコード長以上にしてください。");
  }

  if (settings.turnLimit !== null && (settings.turnLimit < 1 || settings.turnLimit > 50)) {
    errors.push("ターン制限は 1 から 50、または無制限にしてください。");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function getCandidateSpaceSize(settings: GameSettings): number {
  if (settings.allowDuplicates) {
    return settings.colorCount ** settings.codeLength;
  }

  let total = 1;

  for (let index = 0; index < settings.codeLength; index += 1) {
    total *= settings.colorCount - index;
  }

  return total;
}

export function generateSecret(settings: GameSettings): number[] {
  const validation = validateSettings(settings);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(" "));
  }

  const symbols = Array.from({ length: settings.colorCount }, (_, index) => index + 1);
  const secret: number[] = [];

  while (secret.length < settings.codeLength) {
    const nextSymbol = symbols[randomInt(symbols.length)];
    secret.push(nextSymbol);

    if (!settings.allowDuplicates) {
      symbols.splice(symbols.indexOf(nextSymbol), 1);
    }
  }

  return secret;
}

export function scoreGuess(secret: number[], guess: number[]): GuessFeedback {
  if (secret.length !== guess.length) {
    throw new Error("秘密コードと入力コードの長さが一致していません。");
  }

  let hits = 0;
  const secretRemainder = new Map<number, number>();
  const guessRemainder = new Map<number, number>();

  secret.forEach((value, index) => {
    const guessValue = guess[index];

    if (value === guessValue) {
      hits += 1;
      return;
    }

    secretRemainder.set(value, (secretRemainder.get(value) ?? 0) + 1);
    guessRemainder.set(guessValue, (guessRemainder.get(guessValue) ?? 0) + 1);
  });

  let blows = 0;
  guessRemainder.forEach((count, value) => {
    blows += Math.min(count, secretRemainder.get(value) ?? 0);
  });

  return {
    hits,
    blows,
    isCorrect: hits === secret.length
  };
}

export function createInitialRoundState(
  settings: GameSettings,
  players: SessionPlayer[],
  secret: number[],
  startingPlayerIndex = 0
): RoundState {
  return {
    settings,
    players,
    guesses: [],
    roundNumber: 1,
    currentPlayerIndex: startingPlayerIndex,
    status: "active",
    finalRoundNumber: null,
    winnerIds: [],
    startedAt: new Date().toISOString(),
    endedAt: null,
    secret
  };
}

export function validateGuessValues(settings: GameSettings, values: number[]): ValidationResult {
  const errors: string[] = [];

  if (values.length !== settings.codeLength) {
    errors.push("入力数がコード長と一致していません。");
  }

  values.forEach((value) => {
    if (value < 1 || value > settings.colorCount) {
      errors.push("入力に設定範囲外の記号が含まれています。");
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

function getRoundGuesses(guesses: Guess[], roundNumber: number): Guess[] {
  return guesses.filter((guess) => guess.roundNumber === roundNumber);
}

function resolveRoundWinners(state: RoundState): string[] {
  return getRoundGuesses(state.guesses, state.roundNumber)
    .filter((guess) => guess.feedback.isCorrect)
    .map((guess) => guess.playerId);
}

export function advanceRound(
  state: RoundState,
  playerId: string,
  values: number[]
): { nextState: RoundState; guess: Guess; feedback: GuessFeedback; roundResolved: boolean } {
  if (!state.secret) {
    throw new Error("対局の秘密コードが設定されていません。");
  }

  if (state.status === "finished") {
    throw new Error("対局はすでに終了しています。");
  }

  const guessValidation = validateGuessValues(state.settings, values);

  if (!guessValidation.isValid) {
    throw new Error(guessValidation.errors.join(" "));
  }

  const activePlayer = state.players[state.currentPlayerIndex];

  if (!activePlayer || activePlayer.id !== playerId) {
    throw new Error("現在はこのプレイヤーの手番ではありません。");
  }

  const feedback = scoreGuess(state.secret, values);
  const guess: Guess = {
    values,
    feedback,
    roundNumber: state.roundNumber,
    turnNumber: state.guesses.length + 1,
    createdAt: new Date().toISOString(),
    playerId: activePlayer.id,
    playerName: activePlayer.name
  };

  const nextState: RoundState = {
    ...state,
    guesses: [...state.guesses, guess]
  };

  if (feedback.isCorrect && nextState.finalRoundNumber === null) {
    nextState.finalRoundNumber = nextState.roundNumber;
  }

  const isRoundLastTurn = nextState.currentPlayerIndex === nextState.players.length - 1;
  let roundResolved = false;

  if (isRoundLastTurn) {
    roundResolved = true;

    if (nextState.finalRoundNumber === nextState.roundNumber) {
      nextState.winnerIds = resolveRoundWinners(nextState);
      nextState.status = "finished";
      nextState.endedAt = new Date().toISOString();
    } else if (
      nextState.settings.turnLimit !== null &&
      nextState.roundNumber >= nextState.settings.turnLimit
    ) {
      nextState.status = "finished";
      nextState.endedAt = new Date().toISOString();
    } else {
      nextState.roundNumber += 1;
      nextState.currentPlayerIndex = 0;
    }
  } else {
    nextState.currentPlayerIndex += 1;
  }

  return {
    nextState,
    guess,
    feedback,
    roundResolved
  };
}

function candidateMatchesGuesses(candidate: number[], guesses: Guess[]): boolean {
  return guesses.every((guess) => {
    const feedback = scoreGuess(candidate, guess.values);
    return feedback.hits === guess.feedback.hits && feedback.blows === guess.feedback.blows;
  });
}

function visitCandidates(
  settings: GameSettings,
  visitor: (candidate: number[]) => boolean
): boolean {
  const current: number[] = [];
  const usedSymbols = settings.allowDuplicates
    ? null
    : Array.from({ length: settings.colorCount + 1 }, () => false);

  function backtrack(): boolean {
    if (current.length === settings.codeLength) {
      return visitor(current);
    }

    for (let symbol = 1; symbol <= settings.colorCount; symbol += 1) {
      if (usedSymbols?.[symbol]) {
        continue;
      }

      current.push(symbol);

      if (usedSymbols) {
        usedSymbols[symbol] = true;
      }

      const shouldContinue = backtrack();

      if (usedSymbols) {
        usedSymbols[symbol] = false;
      }

      current.pop();

      if (!shouldContinue) {
        return false;
      }
    }

    return true;
  }

  return backtrack();
}

function countMatchingCandidates(settings: GameSettings, guesses: Guess[]): number {
  let count = 0;

  visitCandidates(settings, (candidate) => {
    if (candidateMatchesGuesses(candidate, guesses)) {
      count += 1;
    }

    return true;
  });

  return count;
}

function createRandomCandidate(settings: GameSettings): number[] {
  if (settings.allowDuplicates) {
    return Array.from({ length: settings.codeLength }, () => randomInt(settings.colorCount) + 1);
  }

  const symbols = Array.from({ length: settings.colorCount }, (_, index) => index + 1);
  const candidate: number[] = [];

  while (candidate.length < settings.codeLength) {
    const index = randomInt(symbols.length);
    candidate.push(symbols[index]);
    symbols.splice(index, 1);
  }

  return candidate;
}

function estimateMatchingCandidates(
  settings: GameSettings,
  guesses: Guess[],
  candidateSpace: number
): { estimate: number | null; upperBound: number | null } {
  let matches = 0;

  for (let index = 0; index < ASSIST_SAMPLE_SIZE; index += 1) {
    if (candidateMatchesGuesses(createRandomCandidate(settings), guesses)) {
      matches += 1;
    }
  }

  if (matches === 0) {
    return {
      estimate: null,
      upperBound: Math.ceil((candidateSpace * 3) / ASSIST_SAMPLE_SIZE)
    };
  }

  return {
    estimate: Math.max(1, Math.round((matches / ASSIST_SAMPLE_SIZE) * candidateSpace)),
    upperBound: null
  };
}

export function buildAssistInfo(settings: GameSettings, guesses: Guess[]): AssistInfo {
  const candidateSpace = getCandidateSpaceSize(settings);
  const usedSymbols = Array.from(new Set(guesses.flatMap((guess) => guess.values))).sort(
    (left, right) => left - right
  );
  const unusedSymbols = Array.from({ length: settings.colorCount }, (_, index) => index + 1).filter(
    (symbol) => !usedSymbols.includes(symbol)
  );

  if (guesses.length === 0) {
    return {
      mode: "exact",
      candidateSpace,
      isAccurate: true,
      remainingCandidates: candidateSpace,
      displayCount:
        candidateSpace > EXACT_ASSIST_LIMIT
          ? `${EXACT_ASSIST_LIMIT.toLocaleString()}以上`
          : candidateSpace.toLocaleString(),
      detail:
        candidateSpace > EXACT_ASSIST_LIMIT
          ? `実数 ${candidateSpace.toLocaleString()} 通り`
          : undefined,
      contradiction: false,
      usedSymbols,
      unusedSymbols,
      note:
        candidateSpace > EXACT_ASSIST_LIMIT
          ? "初期候補数は閾値を超えています。推理が進むと候補数が大きく下がる場合があります。"
          : "まだ履歴がないため、初期候補数をそのまま表示しています。"
    };
  }

  if (candidateSpace <= EXACT_ASSIST_SPACE_LIMIT) {
    const remainingCandidates = countMatchingCandidates(settings, guesses);

    return {
      mode: "exact",
      candidateSpace,
      isAccurate: true,
      remainingCandidates,
      displayCount:
        remainingCandidates > EXACT_ASSIST_LIMIT
          ? `${EXACT_ASSIST_LIMIT.toLocaleString()}以上`
          : remainingCandidates.toLocaleString(),
      detail:
        remainingCandidates > EXACT_ASSIST_LIMIT
          ? `実数 ${remainingCandidates.toLocaleString()} 通り`
          : undefined,
      contradiction: remainingCandidates === 0,
      usedSymbols,
      unusedSymbols,
      note:
        remainingCandidates === 0
          ? "履歴に一致する候補がありません。"
          : remainingCandidates > EXACT_ASSIST_LIMIT
            ? "残り候補数は閾値を超えています。実数は補足表示を確認してください。"
            : "公開済みの履歴から計算した正確な残り候補数です。"
    };
  }

  const estimate = estimateMatchingCandidates(settings, guesses, candidateSpace);

  return {
    mode: "estimate",
    candidateSpace,
    isAccurate: false,
    remainingCandidates: estimate.estimate,
    displayCount:
      estimate.estimate !== null
        ? estimate.estimate > EXACT_ASSIST_LIMIT
          ? `${EXACT_ASSIST_LIMIT.toLocaleString()}以上`
          : `約 ${estimate.estimate.toLocaleString()}`
        : `0〜${(estimate.upperBound ?? 0).toLocaleString()}`,
    detail:
      estimate.estimate !== null && estimate.estimate > EXACT_ASSIST_LIMIT
        ? `概算 約 ${estimate.estimate.toLocaleString()} 通り`
        : undefined,
    contradiction: false,
    usedSymbols,
    unusedSymbols,
    note:
      estimate.estimate !== null
        ? estimate.estimate > EXACT_ASSIST_LIMIT
          ? "候補空間が大きいため概算です。残り候補数は閾値以上と見込まれます。"
          : "候補空間が大きいため概算です。"
        : `候補空間が大きく、サンプル上では候補を確認できませんでした。残り候補数は最大でも ${(estimate.upperBound ?? 0).toLocaleString()} 通り程度と見込まれます。`
  };
}
