import { db, bots, documents } from "@voicebot/db";
import { eq, desc } from "drizzle-orm";
import { pipelineConfigSchema, type PipelineConfig } from "@voicebot/core";
import { defaultPipelineFromEnv } from "./pipeline-defaults";

export type Bot = typeof bots.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;

export async function listBots(): Promise<Bot[]> {
  return db.select().from(bots).orderBy(desc(bots.createdAt));
}

export async function getBot(id: string): Promise<Bot | undefined> {
  const rows = await db.select().from(bots).where(eq(bots.id, id)).limit(1);
  return rows[0];
}

export async function createBot(name: string): Promise<Bot> {
  const rows = await db
    .insert(bots)
    .values({
      name,
      systemPrompt:
        "Du bist ein hilfreicher Assistent, der Fragen zu einem Programm beantwortet. " +
        "Antworte auf Deutsch, kurz und präzise, und stütze dich auf das bereitgestellte Handbuch. " +
        "Wenn die Antwort nicht im Handbuch steht, sage das ehrlich.",
      instructions: "",
      pipeline: defaultPipelineFromEnv(),
    })
    .returning();
  return rows[0]!;
}

export interface BotPatch {
  name?: string;
  systemPrompt?: string;
  instructions?: string;
  pipeline?: PipelineConfig;
}

export async function updateBot(id: string, patch: BotPatch): Promise<Bot | undefined> {
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.systemPrompt !== undefined) set.systemPrompt = patch.systemPrompt;
  if (patch.instructions !== undefined) set.instructions = patch.instructions;
  if (patch.pipeline !== undefined) set.pipeline = pipelineConfigSchema.parse(patch.pipeline);
  if (Object.keys(set).length === 0) return getBot(id);
  const rows = await db.update(bots).set(set).where(eq(bots.id, id)).returning();
  return rows[0];
}

export async function deleteBot(id: string): Promise<void> {
  await db.delete(bots).where(eq(bots.id, id));
}

export async function listDocuments(botId: string): Promise<DocumentRow[]> {
  return db
    .select()
    .from(documents)
    .where(eq(documents.botId, botId))
    .orderBy(desc(documents.createdAt));
}

export async function addDocument(
  botId: string,
  filename: string,
  rawText: string,
): Promise<DocumentRow> {
  const rows = await db.insert(documents).values({ botId, filename, rawText }).returning();
  return rows[0]!;
}

export async function deleteDocument(id: string): Promise<void> {
  await db.delete(documents).where(eq(documents.id, id));
}
