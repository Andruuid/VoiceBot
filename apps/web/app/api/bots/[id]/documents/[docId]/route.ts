import { NextResponse } from "next/server";
import { deleteDocument } from "@/lib/db-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; docId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { docId } = await params;
  await deleteDocument(docId);
  return new NextResponse(null, { status: 204 });
}
