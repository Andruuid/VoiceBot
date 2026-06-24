import { NextResponse } from "next/server";
import { getBot, listDocuments } from "@/lib/db-access";
import { buildSystemPrefix } from "@voicebot/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Liefert dem Voice-Agent (Python) alles, was er pro Gespräch braucht:
 *  - systemPrefix: der stabile Prefix (systemPrompt + instructions + GANZES Handbuch),
 *    exakt so erzeugt wie im Text-Chat (gemeinsamer buildSystemPrefix → Prompt-Caching, Spec §6).
 *  - pipeline: die Provider-Konfiguration des Bots (STT/LLM/TTS).
 *
 * Der Agent kann @voicebot/core nicht importieren (Python), daher diese HTTP-Brücke.
 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const bot = await getBot(id);
  if (!bot) return NextResponse.json({ error: "bot not found" }, { status: 404 });

  const docs = await listDocuments(id);
  const systemPrefix = buildSystemPrefix({
    systemPrompt: bot.systemPrompt,
    instructions: bot.instructions,
    documents: docs,
  });

  return NextResponse.json({
    botId: bot.id,
    name: bot.name,
    systemPrefix,
    pipeline: bot.pipeline,
  });
}
