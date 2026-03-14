"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { getCandidateSpaceSize, getDefaultSettings, validateSettings } from "@/lib/game/engine";
import type { GameMode, GameSettings } from "@/lib/game/types";
import { createSearchParams } from "@/lib/settings";

const turnLimitOptions = [null, ...Array.from({ length: 50 }, (_, index) => index + 1)];

const modeDescriptions: Record<GameMode, string> = {
  solo: "完全ランダムな秘密列をひとりで解く練習モードです。",
  local: "1 台の端末を共有し、同じ秘密列を交互に推理します。",
  online: "部屋コードで合流して、2 端末でリアルタイム対戦します。"
};

export function SettingsForm() {
  const router = useRouter();
  const [settings, setSettings] = useState<GameSettings>(getDefaultSettings("solo"));
  const [error, setError] = useState<string | null>(null);

  const validation = validateSettings(settings);
  const candidateSpace = getCandidateSpaceSize(settings);

  function updateSettings<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
    setError(null);
  }

  function launchMode(mode: GameMode) {
    const nextSettings = {
      ...settings,
      mode
    };
    const nextValidation = validateSettings(nextSettings);

    if (!nextValidation.isValid) {
      setError(nextValidation.errors.join(" "));
      return;
    }

    startTransition(() => {
      router.push(`/play/${mode}?${createSearchParams(nextSettings).toString()}`);
    });
  }

  return (
    <main className="page-shell fade-up">
      <section className="hero">
        <div className="hero-row">
          <span className="pill">ブラウザゲーム</span>
          <span className="pill">PC / スマホ対応</span>
          <span className="pill">アカウント不要</span>
        </div>
        <div>
          <h1 className="hero-title">Hit and Blow</h1>
          <p className="hero-copy">
            コード長、色数、同色あり / なし、ターン制限、アシストモードを最初に決めてから始めます。履歴はこのブラウザセッションだけに残り、ブラウザを閉じると消えます。
          </p>
        </div>
        <div className="inline-actions">
          <Link className="button secondary" href="/history">
            セッション履歴を見る
          </Link>
        </div>
      </section>

      <section className="section-grid">
        <article className="card">
          <h2 className="card-title">ゲーム設定</h2>
          <p className="card-copy">ここで設定した内容が各モードへ引き継がれます。</p>
          <div className="settings-grid" style={{ marginTop: "1rem" }}>
            <div className="field">
              <label htmlFor="codeLength">コード長</label>
              <select
                className="select"
                id="codeLength"
                value={settings.codeLength}
                onChange={(event) => updateSettings("codeLength", Number.parseInt(event.target.value, 10))}
              >
                {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="colorCount">色数 / 数字数</label>
              <select
                className="select"
                id="colorCount"
                value={settings.colorCount}
                onChange={(event) => updateSettings("colorCount", Number.parseInt(event.target.value, 10))}
              >
                {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="turnLimit">ターン制限</label>
              <select
                className="select"
                id="turnLimit"
                value={settings.turnLimit === null ? "null" : `${settings.turnLimit}`}
                onChange={(event) =>
                  updateSettings(
                    "turnLimit",
                    event.target.value === "null" ? null : Number.parseInt(event.target.value, 10)
                  )
                }
              >
                {turnLimitOptions.map((value) => (
                  <option key={value ?? "null"} value={value ?? "null"}>
                    {value === null ? "無制限" : value}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <span className="toggle-row">
                <span>
                  <strong>同色あり</strong>
                  <br />
                  <span className="subtle-copy">
                    秘密列で同じ記号を複数回使える設定です。推理では常に重複入力できます。
                  </span>
                </span>
                <input
                  aria-label="同色あり"
                  className="checkbox"
                  type="checkbox"
                  checked={settings.allowDuplicates}
                  onChange={(event) => updateSettings("allowDuplicates", event.target.checked)}
                />
              </span>
            </div>

            <div className="field">
              <span className="toggle-row">
                <span>
                  <strong>アシストモード</strong>
                  <br />
                  <span className="subtle-copy">残り候補数や使用済み記号を表示します。</span>
                </span>
                <input
                  aria-label="アシストモード"
                  className="checkbox"
                  type="checkbox"
                  checked={settings.assistEnabled}
                  onChange={(event) => updateSettings("assistEnabled", event.target.checked)}
                />
              </span>
            </div>
          </div>

          <div className="inline-actions" style={{ marginTop: "1rem" }}>
            <span className="meta-pill">候補空間: {candidateSpace.toLocaleString()}</span>
            <span className="meta-pill">
              アシスト: {candidateSpace <= 100_000 ? "残り候補数を厳密表示" : "簡易ヒントのみ"}
            </span>
          </div>

          {!validation.isValid || error ? (
            <div className="status-banner warning" style={{ marginTop: "1rem" }}>
              <span className="status-label">入力エラー</span>
              <p className="status-text">{error ?? validation.errors.join(" ")}</p>
            </div>
          ) : null}
        </article>

        <div className="mode-grid">
          {(["solo", "local", "online"] as GameMode[]).map((mode) => (
            <article key={mode} className="card mode-card">
              <div>
                <span className="pill">
                  {mode === "solo" ? "ソロ" : mode === "local" ? "ローカル" : "オンライン"}
                </span>
                <h2 className="mode-title" style={{ marginTop: "0.9rem" }}>
                  {mode === "solo" ? "1人プレイ" : mode === "local" ? "1端末で2人プレイ" : "2端末オンライン"}
                </h2>
                <p className="card-copy">{modeDescriptions[mode]}</p>
              </div>
              <button className="button" type="button" onClick={() => launchMode(mode)}>
                この設定で開始
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
