import type { LlmConfig } from "./pipeline";

/** Ein Gesprächs-Turn (ohne System-Prefix). */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface LlmUsage {
  promptTokens?: number;
  completionTokens?: number;
  /** Aus dem Prompt-Cache gelesene Tokens (Beleg dass Caching greift). */
  cachedTokens?: number;
}

export interface LlmResult {
  text: string;
  usage?: LlmUsage;
}

export interface LlmCallInput {
  config: LlmConfig;
  /** Vom Aufrufer aus der Umgebung aufgelöst (nie aus der DB). */
  apiKey?: string;
  /**
   * Stabiler System-Prefix: systemPrompt + instructions + GANZES Handbuch.
   * MUSS über die Turns hinweg byte-identisch bleiben, damit Prompt-Caching greift
   * (siehe Spezifikation §6).
   */
  systemPrefix: string;
  /** Bisheriger Gesprächsverlauf (volatil, nach dem Cache-Breakpoint). */
  history: ChatTurn[];
  /** Aktuelle Nutzerfrage. */
  userMessage: string;
}

/**
 * Ruft ein OpenAI-kompatibles Chat-Completions-Endpoint auf.
 * Deckt LM Studio (lokal) und OpenRouter (Cloud) über dieselbe Schnittstelle ab.
 *
 * Prompt-Caching:
 *  - OpenRouter → Claude: cache_control auf den System-Block (Präfix-Match).
 *  - LM Studio: kein cache_control; llama.cpp cacht den KV-Prefix automatisch.
 */
export async function callLlm(input: LlmCallInput): Promise<LlmResult> {
  const { config, apiKey, systemPrefix, history, userMessage } = input;
  const useCacheControl = config.provider === "openrouter";

  // System-Nachricht: bei OpenRouter als Content-Array mit cache_control,
  // bei LM Studio als einfacher String.
  const systemMessage = useCacheControl
    ? {
        role: "system",
        content: [
          {
            type: "text",
            text: systemPrefix,
            cache_control: { type: "ephemeral" },
          },
        ],
      }
    : { role: "system", content: systemPrefix };

  const messages = [
    systemMessage,
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: userMessage },
  ];

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: config.temperature,
    stream: false,
  };
  // OpenRouter liefert Cache-/Kosten-Details nur, wenn explizit angefordert.
  if (useCacheControl) body.usage = { include: true };

  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // Typischer Fall: Verbindung verweigert (LLM-Server nicht gestartet).
    const hint =
      config.provider === "lmstudio"
        ? " Läuft der LM-Studio Local Server? (LM Studio → Developer → Start Server)"
        : "";
    throw new Error(
      `Verbindung zu ${url} fehlgeschlagen.${hint} (${e instanceof Error ? e.message : String(e)})`,
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM-Anfrage fehlgeschlagen (${res.status}): ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
  };

  const text = data.choices?.[0]?.message?.content ?? "";
  const usage: LlmUsage | undefined = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        cachedTokens: data.usage.prompt_tokens_details?.cached_tokens,
      }
    : undefined;

  return { text, usage };
}
