import { z } from "zod";

/**
 * Pipeline-Konfiguration pro Bot.
 *
 * Kernidee (siehe Spezifikation.md §4): STT / LLM / TTS sind je über einen
 * Provider austauschbar — lokal ODER Cloud — ohne Codeänderung. Diese Schemas
 * sind die einzige Quelle der Wahrheit für die Konfiguration und werden vom
 * Web-UI, der API und dem LiveKit-Agent geteilt.
 */

export const sttConfigSchema = z.object({
  provider: z.enum(["local-whisper", "deepgram"]).default("local-whisper"),
  model: z.string().default("large-v3-turbo"),
  language: z.string().default("de"),
  /** Nur für local-whisper: URL des FastAPI-Dienstes. */
  serviceUrl: z.string().url().optional(),
});

export const llmConfigSchema = z.object({
  provider: z.enum(["lmstudio", "openrouter"]).default("lmstudio"),
  baseUrl: z.string().url().default("http://localhost:1234/v1"),
  model: z.string().default("local-model"),
  temperature: z.number().min(0).max(2).default(0.4),
});

export const ttsConfigSchema = z.object({
  provider: z.enum(["local-piper", "elevenlabs"]).default("local-piper"),
  voice: z.string().default("de_DE-thorsten-high"),
  language: z.string().default("de"),
  /** Nur für local-piper: URL des FastAPI-Dienstes. */
  serviceUrl: z.string().url().optional(),
});

export const pipelineConfigSchema = z.object({
  stt: sttConfigSchema,
  llm: llmConfigSchema,
  tts: ttsConfigSchema,
});

export type SttConfig = z.infer<typeof sttConfigSchema>;
export type LlmConfig = z.infer<typeof llmConfigSchema>;
export type TtsConfig = z.infer<typeof ttsConfigSchema>;
export type PipelineConfig = z.infer<typeof pipelineConfigSchema>;

/** Sinnvolle, komplett lokale Default-Pipeline (LM Studio + Whisper + Piper). */
export const defaultPipeline: PipelineConfig = pipelineConfigSchema.parse({
  stt: {},
  llm: {},
  tts: {},
});
