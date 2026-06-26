"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Bot, DocumentRow } from "@/lib/db-access";
import type { PipelineConfig } from "@voicebot/core";
import { PIPER_DE_VOICES } from "@/lib/piper-voices";

const field =
  "w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500";
const label = "block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1";

export function BotEditor({ bot, documents }: { bot: Bot; documents: DocumentRow[] }) {
  const router = useRouter();
  const [name, setName] = useState(bot.name);
  const [systemPrompt, setSystemPrompt] = useState(bot.systemPrompt);
  const [instructions, setInstructions] = useState(bot.instructions);
  const [stt, setStt] = useState<PipelineConfig["stt"]>(bot.pipeline.stt);
  const [llm, setLlm] = useState<PipelineConfig["llm"]>(bot.pipeline.llm);
  const [tts, setTts] = useState<PipelineConfig["tts"]>(bot.pipeline.tts);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/bots/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          systemPrompt,
          instructions,
          pipeline: { stt, llm, tts },
        }),
      });
      setStatus(res.ok ? "Gespeichert ✓" : "Fehler beim Speichern");
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(file: File) {
    const rawText = await file.text();
    const res = await fetch(`/api/bots/${bot.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, rawText }),
    });
    if (res.ok) router.refresh();
  }

  async function deleteDoc(docId: string) {
    const res = await fetch(`/api/bots/${bot.id}/documents/${docId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  async function deleteBot() {
    if (!confirm(`Bot „${bot.name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/bots/${bot.id}`, { method: "DELETE" });
    if (res.ok) router.push("/");
  }

  return (
    <div className="space-y-5">
      <div>
        <span className={label}>Name</span>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <span className={label}>System-Prompt</span>
        <textarea
          className={`${field} h-28 resize-y font-mono`}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
        />
      </div>

      <div>
        <span className={label}>Zusätzliche Anweisungen</span>
        <textarea
          className={`${field} h-20 resize-y`}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      <fieldset className="space-y-3 rounded-lg border border-neutral-800 p-3">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
          STT (Spracherkennung)
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={label}>Provider</span>
            <select
              className={field}
              value={stt.provider}
              onChange={(e) =>
                setStt({ ...stt, provider: e.target.value as PipelineConfig["stt"]["provider"] })
              }
            >
              <option value="local-whisper">faster-whisper (lokal)</option>
              <option value="deepgram">Deepgram (Cloud)</option>
            </select>
          </div>
          <div>
            <span className={label}>Sprache</span>
            <input
              className={field}
              value={stt.language}
              onChange={(e) => setStt({ ...stt, language: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={label}>Modell</span>
            <input
              className={field}
              value={stt.model}
              onChange={(e) => setStt({ ...stt, model: e.target.value })}
            />
          </div>
          <div>
            <span className={label}>Service-URL</span>
            <input
              className={field}
              placeholder="http://localhost:8001"
              value={stt.serviceUrl ?? ""}
              onChange={(e) => setStt({ ...stt, serviceUrl: e.target.value || undefined })}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-neutral-800 p-3">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
          LLM-Pipeline
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={label}>Provider</span>
            <select
              className={field}
              value={llm.provider}
              onChange={(e) =>
                setLlm({ ...llm, provider: e.target.value as PipelineConfig["llm"]["provider"] })
              }
            >
              <option value="lmstudio">LM Studio (lokal)</option>
              <option value="openrouter">OpenRouter (Cloud)</option>
            </select>
          </div>
          <div>
            <span className={label}>Temperatur</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              className={field}
              value={llm.temperature}
              onChange={(e) => setLlm({ ...llm, temperature: Number(e.target.value) })}
            />
          </div>
        </div>
        <div>
          <span className={label}>Base-URL</span>
          <input
            className={field}
            value={llm.baseUrl}
            onChange={(e) => setLlm({ ...llm, baseUrl: e.target.value })}
          />
        </div>
        <div>
          <span className={label}>Modell</span>
          <input
            className={field}
            value={llm.model}
            onChange={(e) => setLlm({ ...llm, model: e.target.value })}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-neutral-800 p-3">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
          TTS (Sprachausgabe)
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={label}>Provider</span>
            <select
              className={field}
              value={tts.provider}
              onChange={(e) =>
                setTts({ ...tts, provider: e.target.value as PipelineConfig["tts"]["provider"] })
              }
            >
              <option value="local-piper">Piper (lokal)</option>
              <option value="elevenlabs">ElevenLabs (Cloud)</option>
            </select>
          </div>
          <div>
            <span className={label}>Sprache</span>
            <input
              className={field}
              value={tts.language}
              onChange={(e) => setTts({ ...tts, language: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={label}>Stimme</span>
            <select
              className={field}
              value={tts.voice}
              onChange={(e) => setTts({ ...tts, voice: e.target.value })}
            >
              <optgroup label="Weiblich">
                {PIPER_DE_VOICES.filter((v) => v.gender === "weiblich").map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Männlich">
                {PIPER_DE_VOICES.filter((v) => v.gender === "männlich").map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </optgroup>
              {/* Eigene/ältere Stimme erhalten, falls nicht in der kuratierten Liste. */}
              {!PIPER_DE_VOICES.some((v) => v.id === tts.voice) && (
                <option value={tts.voice}>{tts.voice} (eigene)</option>
              )}
            </select>
          </div>
          <div>
            <span className={label}>Service-URL</span>
            <input
              className={field}
              placeholder="http://localhost:8002"
              value={tts.serviceUrl ?? ""}
              onChange={(e) => setTts({ ...tts, serviceUrl: e.target.value || undefined })}
            />
          </div>
        </div>
      </fieldset>

      <p className="text-xs text-neutral-600">
        Lokal ⇄ Cloud pro Komponente umschaltbar. LLM-Wechsel (LM Studio ⇄ OpenRouter) ist aktiv;
        Cloud-Adapter für STT/TTS (Deepgram/ElevenLabs) folgen — der Voice-Agent nutzt dafür bis dahin
        die lokalen Dienste.
      </p>

      <div>
        <span className={label}>Wissensdatenbank (Handbuch)</span>
        <ul className="mb-2 space-y-1">
          {documents.length === 0 && (
            <li className="text-sm text-neutral-600">Noch kein Dokument hochgeladen.</li>
          )}
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-md border border-neutral-800 px-3 py-2 text-sm"
            >
              <span>
                {d.filename}{" "}
                <span className="text-neutral-600">({(d.rawText.length / 1024).toFixed(1)} KB)</span>
              </span>
              <button
                onClick={() => deleteDoc(d.id)}
                className="text-xs text-red-400 hover:underline"
              >
                löschen
              </button>
            </li>
          ))}
        </ul>
        <input
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f);
            e.target.value = "";
          }}
          className="text-sm text-neutral-400 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800 file:px-3 file:py-2 file:text-sm file:text-neutral-200"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
        <button onClick={deleteBot} className="text-sm text-red-400 hover:underline">
          Bot löschen
        </button>
        {status && <span className="text-sm text-neutral-400">{status}</span>}
      </div>
    </div>
  );
}
