"use client";

import { useState } from "react";
import { ChatPanel } from "./chat-panel";
import { VoicePanel } from "./voice-panel";

/** Umschalter zwischen Sprach-Gespräch (Phase 2) und Text-Chat (Phase 1). */
export function ConversationTabs({ botId }: { botId: string }) {
  const [tab, setTab] = useState<"voice" | "text">("voice");

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      active ? "bg-emerald-500 text-black" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
    }`;

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button onClick={() => setTab("voice")} className={tabClass(tab === "voice")}>
          🎙 Voice
        </button>
        <button onClick={() => setTab("text")} className={tabClass(tab === "text")}>
          💬 Text
        </button>
      </div>
      {tab === "voice" ? <VoicePanel botId={botId} /> : <ChatPanel botId={botId} />}
    </div>
  );
}
