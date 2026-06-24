import Link from "next/link";
import { notFound } from "next/navigation";
import { getBot, listDocuments } from "@/lib/db-access";
import { BotEditor } from "@/components/bot-editor";
import { ConversationTabs } from "@/components/conversation-tabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bot = await getBot(id);
  if (!bot) notFound();
  const documents = await listDocuments(id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
        ← Alle Bots
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{bot.name}</h1>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Konfiguration
          </h2>
          <BotEditor bot={bot} documents={documents} />
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Gespräch
          </h2>
          <ConversationTabs botId={bot.id} />
        </section>
      </div>
    </main>
  );
}
