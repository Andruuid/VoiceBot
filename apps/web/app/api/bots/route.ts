import { NextResponse } from "next/server";
import { listBots, createBot } from "@/lib/db-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listBots());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const bot = await createBot(name);
  return NextResponse.json(bot, { status: 201 });
}
