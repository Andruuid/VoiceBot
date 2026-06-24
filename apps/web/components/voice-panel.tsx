"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
  type Participant,
  type TranscriptionSegment,
} from "livekit-client";

type CallState = "idle" | "connecting" | "live" | "error";

interface TranscriptLine {
  id: string;
  role: "user" | "assistant";
  text: string;
  final: boolean;
}

/**
 * Voice-Gespräch im Browser: holt ein LiveKit-Token (mit botId in den Raum-Metadaten),
 * verbindet sich per WebRTC, schaltet das Mikrofon ein, spielt die Agent-Antwort ab und
 * zeigt das Live-Transkript (STT + LLM) aus den LiveKit-Transcription-Events.
 */
export function VoicePanel({ botId }: { botId: string }) {
  const [state, setState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const roomRef = useRef<Room | null>(null);
  const localIdentityRef = useRef<string>("");
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const upsertSegments = useCallback(
    (segments: TranscriptionSegment[], participant?: Participant) => {
      const role: "user" | "assistant" =
        participant && participant.identity === localIdentityRef.current ? "user" : "assistant";
      setLines((prev) => {
        const next = [...prev];
        for (const seg of segments) {
          const idx = next.findIndex((l) => l.id === seg.id);
          const line: TranscriptLine = {
            id: seg.id,
            role,
            text: seg.text,
            final: seg.final,
          };
          if (idx >= 0) next[idx] = line;
          else next.push(line);
        }
        return next;
      });
    },
    [],
  );

  const cleanup = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    if (audioContainerRef.current) audioContainerRef.current.innerHTML = "";
  }, []);

  useEffect(() => cleanup, [cleanup]);

  async function startCall() {
    setError(null);
    setLines([]);
    setState("connecting");
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Token-Anfrage fehlgeschlagen");

      localIdentityRef.current = data.identity;
      const room = new Room();
      roomRef.current = room;

      room
        .on(RoomEvent.TranscriptionReceived, (segments, participant) =>
          upsertSegments(segments, participant),
        )
        .on(
          RoomEvent.TrackSubscribed,
          (
            track: RemoteTrack,
            _pub: RemoteTrackPublication,
            _participant: RemoteParticipant,
          ) => {
            if (track.kind === Track.Kind.Audio) {
              const el = track.attach();
              el.autoplay = true;
              audioContainerRef.current?.appendChild(el);
            }
          },
        )
        .on(RoomEvent.Disconnected, () => setState("idle"));

      await room.connect(data.url, data.token);
      // Browser-Autoplay: nach der Nutzergeste (Klick) Audio freischalten.
      await room.startAudio().catch(() => {});
      await room.localParticipant.setMicrophoneEnabled(true);
      setState("live");
    } catch (e) {
      cleanup();
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  }

  function endCall() {
    cleanup();
    setState("idle");
  }

  const live = state === "live";

  return (
    <div className="flex h-[70vh] flex-col rounded-lg border border-neutral-800">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {lines.length === 0 && (
          <p className="text-sm text-neutral-600">
            {live
              ? "Sprich jetzt — stelle dem Bot eine Frage zum Handbuch."
              : "Starte ein Sprach­gespräch und rede mit dem Bot (Hochdeutsch)."}
          </p>
        )}
        {lines.map((l) => (
          <div key={l.id} className={l.role === "user" ? "text-right" : "text-left"}>
            <div
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                l.role === "user" ? "bg-emerald-500 text-black" : "bg-neutral-800 text-neutral-100"
              } ${l.final ? "" : "opacity-60"}`}
            >
              {l.text}
            </div>
          </div>
        ))}
      </div>

      <div ref={audioContainerRef} className="hidden" />

      <div className="flex items-center gap-3 border-t border-neutral-800 p-3">
        {!live ? (
          <button
            onClick={startCall}
            disabled={state === "connecting"}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            {state === "connecting" ? "Verbinde…" : "🎙 Gespräch starten"}
          </button>
        ) : (
          <button
            onClick={endCall}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"
          >
            ⏹ Beenden
          </button>
        )}
        {live && (
          <span className="flex items-center gap-2 text-sm text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> live
          </span>
        )}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}
