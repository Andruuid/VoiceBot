import { defaultPipeline } from "@voicebot/core";

const phases = [
  { n: 0, title: "Setup", desc: "Monorepo, Docker (LiveKit + Postgres), .env", done: true },
  { n: 1, title: "Text-Bot", desc: "Bot-CRUD, KB-Upload, RAG, Text-Chat", done: false },
  { n: 2, title: "Voice-Loop", desc: "LiveKit-Agent, STT/TTS, Browser-Mic", done: false },
  { n: 3, title: "Austauschbarkeit", desc: "Pipeline-Config-UI, lokal ⇄ Cloud", done: false },
  { n: 4, title: "Politur", desc: "Latenz, Barge-in, Persistenz", done: false },
  { n: 5, title: "Schweizerdeutsch", desc: "STT-Finetune + Dialekt-TTS", done: false },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">VoiceBot</h1>
      <p className="mt-3 text-neutral-400">
        Konfigurierbarer Voice-Call-Agent mit Wissensdatenbank — lokal lauffähig,
        Provider austauschbar.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Roadmap
        </h2>
        <ul className="mt-4 space-y-2">
          {phases.map((p) => (
            <li
              key={p.n}
              className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3"
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  p.done ? "bg-emerald-500 text-black" : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {p.done ? "✓" : p.n}
              </span>
              <div>
                <div className="font-medium">Phase {p.n}: {p.title}</div>
                <div className="text-sm text-neutral-500">{p.desc}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Default-Pipeline (komplett lokal)
        </h2>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-xs text-neutral-300">
          {JSON.stringify(defaultPipeline, null, 2)}
        </pre>
      </section>
    </main>
  );
}
