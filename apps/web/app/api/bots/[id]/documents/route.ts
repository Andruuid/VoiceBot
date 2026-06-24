import { NextResponse } from "next/server";
import { listDocuments, addDocument } from "@/lib/db-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  return NextResponse.json(await listDocuments(id));
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const filename = String(body?.filename ?? "upload.txt");
  const rawText = String(body?.rawText ?? "");
  if (!rawText.trim()) return NextResponse.json({ error: "rawText required" }, { status: 400 });
  const doc = await addDocument(id, filename, rawText);
  return NextResponse.json(doc, { status: 201 });
}
