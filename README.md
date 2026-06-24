# VoiceBot

Konfigurierbarer **Voice-Call-Agent** mit Wissensdatenbank. Man redet per Sprache
mit einem Bot, der Fragen zu einem Programm beantwortet — gestützt auf ein
hochgeladenes Handbuch und frei per System-Prompt konfigurierbar.

**Leitprinzipien:** komplett lokal lauffähig (keine Cloud-Pflicht), STT/LLM/TTS
je per Config austauschbar (lokal ⇄ Cloud), Hochdeutsch zuerst, Schweizerdeutsch
vorbereitet. Details: [Spezifikation.md](./Spezifikation.md).

> Status: **Phase 3 (Austauschbarkeit)** — Pipeline (STT/LLM/TTS) pro Bot im UI umschaltbar.
> LLM lokal⇄Cloud (LM Studio ⇄ OpenRouter) ist aktiv; Cloud-Adapter für STT/TTS folgen.
> Voice-Loop (Phase 2) läuft CPU-lokal (faster-whisper + Piper, kein CUDA nötig).

## Stack

| Schicht | Technologie |
|---|---|
| Frontend / API | Next.js 15 + React 19 + TypeScript (`apps/web`) |
| Voice-Orchestrierung | LiveKit Agents, **Python** (`apps/agent`) |
| Geteilte Logik | `packages/core` (Pipeline-Schema), `packages/db` (Drizzle + pgvector) |
| Modelldienste (GPU) | faster-whisper (`services/stt-whisper`), Piper (`services/tts-piper`) |
| Infra | Docker: LiveKit + Postgres/pgvector |
| LLM / Embeddings | LM Studio (lokal) oder OpenRouter (Cloud) |

## Voraussetzungen

Node ≥ 20, pnpm, Python ≥ 3.11, Docker (Desktop). Für den Chat zusätzlich
[LM Studio](https://lmstudio.ai): Modell laden **und** den lokalen Server starten
(Tab *Developer* → *Start Server*, Port 1234). Modell nur laden reicht nicht —
ohne gestarteten Server schlägt der Chat mit „Verbindung fehlgeschlagen" fehl.

> Läuft auf Port 3000 schon etwas anderes, starte das Frontend auf einem anderen
> Port: `PORT=3100 pnpm dev:web`.

## Setup

```bash
# 1. Env anlegen
cp .env.example .env

# 2. Infrastruktur starten (LiveKit + Postgres)
pnpm infra:up

# 3. Abhängigkeiten installieren
pnpm install

# 4. Datenbank-Schema anwenden
pnpm db:push

# 5. Frontend starten  ->  http://localhost:3000
pnpm dev:web
```

### Voice-Loop starten (Phase 2)

Alles **CPU-lokal** — kein PyTorch/CUDA nötig. Vier zusätzliche Prozesse neben `pnpm dev:web`
und der Docker-Infra. Details zu den Modelldiensten: [services/README.md](./services/README.md).

```bash
# 1) STT-Dienst (faster-whisper, CPU)
cd services/stt-whisper
python -m venv .venv && .venv\Scripts\Activate.ps1   # Windows PowerShell
pip install -r requirements.txt
uvicorn main:app --port 8001

# 2) TTS-Dienst (Piper, CPU) — zweites Terminal
cd services/tts-piper
python -m venv .venv && .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m piper.download_voices de_DE-thorsten-high --download-dir ./voices   # einmalig
uvicorn main:app --port 8002

# 3) Voice-Agent (LiveKit Agents, Python) — drittes Terminal
cd apps/agent
python -m venv .venv && .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python agent.py dev            # oder vom Repo-Root: pnpm dev:agent
```

Danach im Browser einen Bot öffnen → Reiter **🎙 Voice** → *Gespräch starten* → Mikrofon
erlauben → auf Hochdeutsch fragen. Der Agent holt den System-Prefix (System-Prompt + Handbuch)
vom Web-Backend; stelle daher `WEB_BASE_URL` in `.env` auf den Port deines Frontends (Default 3100).

> **GPU später:** Für die RTX 5080 (Blackwell, sm_120) und den Schweizerdeutsch-Finetune wird
> faster-whisper/Piper auf den GPU-Pfad (cu128) umgestellt — reiner Modell-/Geräte-Tausch,
> siehe Kommentare in den `requirements.txt` und Spezifikation §9.

## Nützliche Befehle

```bash
pnpm infra:up / infra:down / infra:logs   # Docker steuern
pnpm dev:web                              # Next.js Dev-Server
pnpm dev:agent                            # Voice-Agent (Python, via apps/agent/.venv)
pnpm db:push / db:generate / db:migrate   # Drizzle-Schema
```
