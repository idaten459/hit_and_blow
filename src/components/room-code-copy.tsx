"use client";

import { useEffect, useState } from "react";

interface RoomCodeCopyProps {
  roomCode: string;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.focus();
    textarea.select();

    try {
      return typeof document.execCommand === "function" ? document.execCommand("copy") : false;
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  }
}

export function RoomCodeCopy({ roomCode }: RoomCodeCopyProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "done" | "error">("idle");

  useEffect(() => {
    if (copyStatus === "idle") {
      return;
    }

    const timerId = window.setTimeout(() => {
      setCopyStatus("idle");
    }, 1800);

    return () => window.clearTimeout(timerId);
  }, [copyStatus]);

  async function handleCopy() {
    const copied = await copyText(roomCode);
    setCopyStatus(copied ? "done" : "error");
  }

  return (
    <div className="room-code-actions">
      <span className="pill">部屋 {roomCode}</span>
      <button className="button secondary room-copy-button" type="button" onClick={handleCopy}>
        {copyStatus === "done" ? "コピー済み" : copyStatus === "error" ? "コピー失敗" : "コードをコピー"}
      </button>
    </div>
  );
}
