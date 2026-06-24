import { NextResponse } from "next/server";
import { getBot, updateBot, deleteBot, type BotPatch } from "@/lib/db-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const bot = await getBot(id);
  if (!bot) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(bot);
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as BotPatch;
  try {
    const bot = await updateBot(id, body);
    if (!bot) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(bot);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "invalid payload" },
      { status: 400 },
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  await deleteBot(id);
  return new NextResponse(null, { status: 204 });
}
