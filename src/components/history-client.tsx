"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CodeSequence } from "@/components/code-sequence";
import { formatHistoryFeedback } from "@/lib/game/format";
import type { MatchSummary } from "@/lib/game/types";
import { loadMatchHistory, saveMatchHistory } from "@/lib/session/history";

export function HistoryClient() {
  const [history, setHistory] = useState<MatchSummary[]>([]);

  useEffect(() => {
    setHistory(loadMatchHistory());
  }, []);

  function clearHistory() {
    saveMatchHistory([]);
    setHistory([]);
  }

  return (
    <main className="page-shell fade-up">
      <section className="hero">
        <div className="hero-row">
          <span className="pill">セッション履歴</span>
        </div>
        <div>
          <h1 className="hero-title">履歴</h1>
          <p className="hero-copy">
            このタブのセッション中に終了した対局だけを表示します。ブラウザを閉じると履歴は消えます。
          </p>
        </div>
        <div className="inline-actions">
          <Link className="button secondary" href="/">
            設定に戻る
          </Link>
          <button className="button ghost" type="button" onClick={clearHistory}>
            履歴を消す
          </button>
        </div>
      </section>

      <section className="section-grid">
        {history.length > 0 ? (
          <div className="history-grid">
            {history.map((summary) => (
              <article key={summary.id} className="card">
                <div className="history-summary">
                  <span className="pill">
                    {summary.mode === "solo" ? "1人プレイ" : summary.mode === "local" ? "1端末で2人プレイ" : "2端末オンライン"}
                  </span>
                  <span className="pill">{summary.winnerLabel}</span>
                </div>
                <h2 className="card-title" style={{ marginTop: "1rem" }}>
                  {summary.players.join(" 対 ")}
                </h2>
                <div className="card-copy history-secret">
                  正解: <CodeSequence values={summary.secret} colorCount={summary.settings.colorCount} />
                </div>
                <div className="history-meta" style={{ marginTop: "1rem" }}>
                  <span className="meta-pill">ラウンド {summary.roundsPlayed}</span>
                  <span className="meta-pill">推理数 {summary.guesses.length}</span>
                  <span className="meta-pill">
                    {summary.settings.allowDuplicates ? "同色あり" : "同色なし"}
                  </span>
                </div>
                <div className="history-list">
                  {summary.guesses.slice(0, 6).map((guess) => (
                    <div key={`${summary.id}-${guess.turnNumber}`} className="history-entry">
                      <div className="history-line">
                        <span className="history-turn">{guess.turnNumber}</span>
                        <span className="history-player">{guess.playerName}</span>
                        <CodeSequence
                          compact
                          wrap
                          className="history-code"
                          values={guess.values}
                          colorCount={summary.settings.colorCount}
                        />
                        <span className="history-feedback">
                          {formatHistoryFeedback(guess.feedback.hits, guess.feedback.blows)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="history-empty">まだ終了した対局はありません。</div>
        )}
      </section>
    </main>
  );
}
