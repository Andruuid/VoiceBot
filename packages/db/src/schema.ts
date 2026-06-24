import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  vector,
  index,
} from "drizzle-orm/pg-core";
import type { PipelineConfig } from "@voicebot/core";

/**
 * Dimension der Embedding-Vektoren. MUSS zum gewählten Embedding-Modell passen.
 * Default 768 (z.B. nomic-embed-text via LM Studio). Bei Modellwechsel anpassen
 * und Migration neu generieren.
 */
export const EMBEDDING_DIM = 768;

/** Ein Bot = eine Instanz mit eigenem Prompt, eigener Pipeline und eigenen Daten. */
export const bots = pgTable("bots", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull().default(""),
  instructions: text("instructions").notNull().default(""),
  pipeline: jsonb("pipeline").$type<PipelineConfig>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Hochgeladene Wissensquelle (z.B. ein Programm-Handbuch). */
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  botId: uuid("bot_id")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  rawText: text("raw_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** In Stücke zerlegtes Dokument samt Embedding für die RAG-Suche. */
export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
    ord: integer("ord").notNull(),
  },
  (table) => [
    index("chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

/** Gesprächsverlauf (optional, für Transkripte). */
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  botId: uuid("bot_id")
    .notNull()
    .references(() => bots.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
