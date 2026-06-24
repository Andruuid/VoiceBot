import { NextResponse } from "next/server";
import { getBot, listDocuments } from "@/lib/db-access";
import { callLlm, type ChatTurn } from "@voicebot/core";

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
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  // Handbuch(er) komplett in den stabilen System-Prefix (kein RAG, siehe Spec §6).
  const docs = await listDocuments(id);
  const manual = docs.map((d) => `## ${d.filename}\n\n${d.rawText}`).join("\n\n---\n\n");

  const systemPrefix = [
    bot.systemPrompt,
    bot.instructions,
    manual ? `Wissensdatenbank (Handbuch):\n\n${manual}` : "",
  ]
    .filter((s) => s && s.trim())
    .join("\n\n");

  const llm = bot.pipeline.llm;
  const apiKey =
    llm.provider === "openrouter"
      ? process.env.OPENROUTER_API_KEY
      : (process.env.LLM_API_KEY ?? "lm-studio");

  try {
    const result = await callLlm({ config: llm, apiKey, systemPrefix, history, userMessage: message });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
