import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { getBot } from "@/lib/db-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Erzeugt ein LiveKit-Zugangstoken für ein Voice-Gespräch.
 *
 * Ablauf: Browser fragt mit { botId } an → wir legen einen eindeutigen Raum an und
 * hängen die botId als Raum-Metadaten an. Der Python-Agent liest beim Beitritt
 * room.metadata, holt damit den passenden System-Prefix + die Pipeline-Config
 * (siehe /api/bots/[id]/voice-context).
 */
export async function POST(req: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json(
      { error: "LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET nicht gesetzt" },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const botId = String(body?.botId ?? "").trim();
  if (!botId) return NextResponse.json({ error: "botId required" }, { status: 400 });

  const bot = await getBot(botId);
  if (!bot) return NextResponse.json({ error: "bot not found" }, { status: 404 });

  const roomName = `voice-${botId}-${randomUUID().slice(0, 8)}`;
  const identity = `user-${randomUUID().slice(0, 8)}`;

  // Raum mit Metadaten anlegen (HTTP-API von LiveKit, ws→http ableiten).
  const httpUrl = wsUrl.replace(/^ws/, "http");
  try {
    const svc = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    await svc.createRoom({
      name: roomName,
      metadata: JSON.stringify({ botId }),
      emptyTimeout: 5 * 60, // Raum nach 5 Min Leerlauf aufräumen
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Raum anlegen fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  const at = new AccessToken(apiKey, apiSecret, { identity, ttl: "1h" });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  const token = await at.toJwt();

  return NextResponse.json({ url: wsUrl, token, room: roomName, identity });
}
