"use client";

const TOKEN_KEY = "hit-and-blow:player-token";

function makeToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreatePlayerToken(): string {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
    return makeToken();
  }

  const existing = window.sessionStorage.getItem(TOKEN_KEY);

  if (existing) {
    return existing;
  }

  const token = makeToken();
  window.sessionStorage.setItem(TOKEN_KEY, token);
  return token;
}
