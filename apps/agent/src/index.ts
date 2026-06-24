import "dotenv/config";
import { defaultPipeline, type PipelineConfig } from "@voicebot/core";

/**
 * LiveKit-Voice-Agent — STUB (Phase 0).
 *
 * Hier wird in Phase 2 der eigentliche Voice-Loop implementiert:
 *   - Verbindung zum LiveKit-Server als Agent-Worker (@livekit/agents)
 *   - VAD / Turn-Detection
 *   - STT-Plugin  (local-whisper-Adapter | Deepgram)  -> Audio -> Text
 *   - RAG-Abruf aus der Wissensdatenbank des Bots
 *   - LLM-Plugin  (LM Studio | OpenRouter, OpenAI-kompatibel)
 *   - TTS-Plugin  (local-piper-Adapter | ElevenLabs)  -> Text -> Audio
 *
 * Welcher Provider je Stufe geladen wird, entscheidet die Bot-Pipeline-Config
 * (siehe @voicebot/core/pipeline). Dieser Stub gibt sie nur aus, um zu zeigen,
 * dass das geteilte Schema funktioniert.
 */

function describe(pipeline: PipelineConfig): void {
  console.log("VoiceBot Agent — Phase 0 Stub");
  console.log("LiveKit URL:", process.env.LIVEKIT_URL ?? "(nicht gesetzt)");
  console.log("Default-Pipeline:");
  console.log("  STT:", pipeline.stt.provider, `(${pipeline.stt.model})`);
  console.log("  LLM:", pipeline.llm.provider, `(${pipeline.llm.model})`);
  console.log("  TTS:", pipeline.tts.provider, `(${pipeline.tts.voice})`);
  console.log("\n→ Voice-Loop wird in Phase 2 implementiert.");
}

describe(defaultPipeline);
