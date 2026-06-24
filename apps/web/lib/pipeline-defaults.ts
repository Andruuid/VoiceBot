import { pipelineConfigSchema, type PipelineConfig } from "@voicebot/core";

/**
 * Default-Pipeline für einen neuen Bot, vorbelegt aus den Umgebungsvariablen.
 * So bekommt ein neuer Bot direkt das lokal geladene LM-Studio-Modell als Default.
 */
export function defaultPipelineFromEnv(): PipelineConfig {
  return pipelineConfigSchema.parse({
    stt: {},
    llm: {
      provider: process.env.LLM_PROVIDER ?? "lmstudio",
      baseUrl: process.env.LLM_BASE_URL ?? "http://localhost:1234/v1",
      model: process.env.LLM_MODEL ?? "local-model",
    },
    tts: {},
  });
}
