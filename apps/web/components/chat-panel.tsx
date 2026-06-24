"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatTurn, LlmUsage } from "@voicebot/core";

interface UiMessage extends ChatTurn {
  usage?: LlmUsage;
  error?: boolean;
}

export function ChatPanel({ botId }: { botId: string }) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const history: ChatTurn[] = messages
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch(`/api/bots/${botId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.text, usage: data.usage },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error ?? "Fehler", error: true },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: String(err), error: true },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-lg border border-neutral-800">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-600">
            Stelle dem Bot eine Frage zum Handbuch (Text-Chat — Voice folgt in Phase 2).
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-emerald-500 text-black"
                  : m.error
                    ? "border border-red-800 bg-red-950/40 text-red-300"
                    : "bg-neutral-800 text-neutral-100"
              }`}
            >
              {m.content}
            </div>
            {m.usage && (
              <div className="mt-1 text-[11px] text-neutral-600">
                prompt {m.usage.promptTokens ?? "?"} · completion {m.usage.completionTokens ?? "?"}
                {m.usage.cachedTokens != null && ` · cache-read ${m.usage.cachedTokens}`}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="text-sm text-neutral-500">… denkt nach</div>}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-neutral-800 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nachricht…"
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
        >
          Senden
        </button>
      </form>
    </div>
  );
}
