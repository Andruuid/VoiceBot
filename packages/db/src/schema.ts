import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import type { PipelineConfig } from "@voicebot/core";

// Entscheidung 2026-06-24: Kein RAG/Embedding. Das Handbuch (documents.rawText)
// wird komplett in den System-Prefix gelegt und per Prompt-Caching wiederverwendet
// (siehe Spezifikation §6). pgvector + chunks-Tabelle erst bei Bedarf nachrüsten.

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
