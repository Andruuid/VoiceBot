/**
 * Aufbau des stabilen System-Prefix (systemPrompt + instructions + GANZES Handbuch).
 *
 * Einzige Quelle der Wahrheit für den Prefix: sowohl der Text-Chat (Web-API) als auch
 * der Voice-Agent müssen exakt denselben String erzeugen, sonst bricht das Prompt-Caching
 * (Caching ist ein byte-genauer Präfix-Match, siehe Spezifikation §6).
 *
 * Bewusst minimale Eingabe-Form (kein Import von @voicebot/db), damit core abhängigkeitsfrei
 * bleibt — db importiert core, nicht umgekehrt.
 */

export interface SystemPrefixDocument {
  filename: string;
  rawText: string;
}

export interface SystemPrefixInput {
  systemPrompt: string;
  instructions: string;
  /** Alle Handbücher des Bots, komplett (kein RAG/Chunking). */
  documents: SystemPrefixDocument[];
}

/**
 * Setzt den stabilen System-Prefix zusammen. Reihenfolge ist strikt
 * (Cache-Breakpoint danach): systemPrompt → instructions → Handbuch-Block.
 */
export function buildSystemPrefix(input: SystemPrefixInput): string {
  const manual = input.documents
    .map((d) => `## ${d.filename}\n\n${d.rawText}`)
    .join("\n\n---\n\n");

  return [
    input.systemPrompt,
    input.instructions,
    manual ? `Wissensdatenbank (Handbuch):\n\n${manual}` : "",
  ]
    .filter((s) => s && s.trim())
    .join("\n\n");
}
