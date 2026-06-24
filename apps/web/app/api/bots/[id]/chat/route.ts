import { NextResponse } from "next/server";
import { getBot, listDocuments, createConversation, addMessage } from "@/lib/db-access";
import { buildSystemPrefix, callLlm, type ChatTurn } from "@voicebot/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const bot = await getBot(id);
  if (!bot) return NextResponse.json({ error: "bot not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message ?? "").trim();
  const history: ChatTurn[] = Array.isArray(body?.history) ? body.history : [];
  const conversationId =
    typeof body?.conversationId === "string" ? body.conversationId : undefined;
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  // Handbuch(er) komplett in den stabilen System-Prefix (kein RAG, siehe Spec §6).
  // buildSystemPrefix ist die gemeinsame Quelle der Wahrheit (Web-Chat + Voice-Agent).
  const docs = await listDocuments(id);
  const systemPrefix = buildSystemPrefix({
    systemPrompt: bot.systemPrompt,
    instructions: bot.instructions,
    documents: docs,
  });

  const llm = bot.pipeline.llm;
  const apiKey =
    llm.provider === "openrouter"
      ? process.env.OPENROUTER_API_KEY
      : (process.env.LLM_API_KEY ?? "lm-studio");

  let result;
  try {
    result = await callLlm({ config: llm, apiKey, systemPrefix, history, userMessage: message });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  // Erst nach erfolgreicher Antwort persistieren — keine Waisen-Gespräche bei LLM-Fehler.
  // Bei Persistenz-Fehlern trotzdem antworten (Chat soll nicht an der DB scheitern).
  let convId = conversationId;
  try {
    if (!convId) convId = await createConversation(id);
    await addMessage(convId, "user", message);
    await addMessage(convId, "assistant", result.text);
  } catch (e) {
    console.error("Persistenz des Chat-Turns fehlgeschlagen:", e);
    convId = conversationId; // unverändert zurückgeben, Antwort bleibt nutzbar
  }

  return NextResponse.json({ ...result, conversationId: convId });
}
