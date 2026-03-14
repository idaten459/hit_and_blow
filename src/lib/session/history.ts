"use client";

import type { MatchSummary } from "@/lib/game/types";

const HISTORY_KEY = "hit-and-blow:history";
const ONLINE_SESSION_KEY = "hit-and-blow:online-session";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function loadMatchHistory(): MatchSummary[] {
  if (!canUseStorage()) {
    return [];
  }

  const raw = window.sessionStorage.getItem(HISTORY_KEY);

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as MatchSummary[];
  } catch {
    return [];
  }
}

export function saveMatchHistory(history: MatchSummary[]): void {
  if (!canUseStorage()) {
    return;
  }

  window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}

export function appendMatchSummary(summary: MatchSummary): void {
  const history = loadMatchHistory();
  saveMatchHistory([summary, ...history]);
}

export interface StoredOnlineSession {
  roomCode: string;
  token: string;
}

export function loadOnlineSession(): StoredOnlineSession | null {
  if (!canUseStorage()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(ONLINE_SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredOnlineSession;
  } catch {
    return null;
  }
}

export function saveOnlineSession(session: StoredOnlineSession | null): void {
  if (!canUseStorage()) {
    return;
  }

  if (!session) {
    window.sessionStorage.removeItem(ONLINE_SESSION_KEY);
    return;
  }

  window.sessionStorage.setItem(ONLINE_SESSION_KEY, JSON.stringify(session));
}

