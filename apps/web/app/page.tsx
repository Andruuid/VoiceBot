import Link from "next/link";
import { listBots, type Bot } from "@/lib/db-access";
import { NewBotForm } from "@/components/new-bot-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Home() {
  let bots: Bot[] = [];
  let dbError: string | null = null;
  try {
    bots = await listBots();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">VoiceBot</h1>
      <p className="mt-2 text-neutral-400">
        Erstelle Bots, lade ein Handbuch hoch und stelle Fragen dazu.
      </p>

      {dbError ? (
        <div className="mt-8 rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
          <p className="font-medium">Keine Datenbankverbindung.</p>
          <p className="mt-1 text-amber-300/80">
            Starte die Infrastruktur und lege das Schema an:
          </p>
          <pre className="mt-2 rounded bg-black/40 p-2 text-xs">
            pnpm infra:up{"\n"}pnpm db:push
          </pre>
          <p className="mt-2 text-xs text-amber-300/60">{dbError}</p>
        </div>
      ) : (
        <>
          <div className="mt-8">
            <NewBotForm />
          </div>
          <ul className="mt-6 space-y-2">
            {bots.length === 0 && (
              <li className="text-sm text-neutral-600">Noch keine Bots — erstelle den ersten.</li>
            )}
            {bots.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/bots/${b.id}`}
                  className="block rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 hover:border-neutral-600"
                >
                  <span className="font-medium">{b.name}</span>
                  <span className="ml-2 text-xs text-neutral-600">
                    {b.pipeline.llm.provider} · {b.pipeline.llm.model}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
