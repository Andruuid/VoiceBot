# VoiceBot

Konfigurierbarer **Voice-Call-Agent** mit Wissensdatenbank. Man redet per Sprache
mit einem Bot, der Fragen zu einem Programm beantwortet — gestützt auf ein
hochgeladenes Handbuch und frei per System-Prompt konfigurierbar.

**Leitprinzipien:** komplett lokal lauffähig (keine Cloud-Pflicht), STT/LLM/TTS
je per Config austauschbar (lokal ⇄ Cloud), Hochdeutsch zuerst, Schweizerdeutsch
vorbereitet. Details: [Spezifikation.md](./Spezifikation.md).

> Status: **Phase 0 (Setup)** — Gerüst steht, Voice-Loop folgt in Phase 2.

## Stack

| Schicht | Technologie |
|---|---|
| Frontend / API | Next.js 15 + React 19 + TypeScript (`apps/web`) |
| Voice-Orchestrierung | LiveKit Agents, TS (`apps/agent`) |
| Geteilte Logik | `packages/core` (Pipeline-Schema), `packages/db` (Drizzle + pgvector) |
| Modelldienste (GPU) | faster-whisper (`services/stt-whisper`), Piper (`services/tts-piper`) |
| Infra | Docker: LiveKit + Postgres/pgvector |
| LLM / Embeddings | LM Studio (lokal) oder OpenRouter (Cloud) |

## Voraussetzungen

Node ≥ 20, pnpm, Python ≥ 3.11, Docker (Desktop). Für Voice zusätzlich
[LM Studio](https://lmstudio.ai) mit geladenem Chat- **und** Embedding-Modell
(Server auf Port 1234).

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

### Modelldienste (laufen auf dem Host wegen GPU/CUDA, nicht in Docker)

```bash
# STT
cd services/stt-whisper
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
uvicorn main:app --port 8001

# TTS (zweites Terminal)
cd services/tts-piper
python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --port 8002
```

> In Phase 0 sind STT/TTS Stubs (`/health` antwortet, Transkription/Synthese
> kommen in Phase 2). GPU/CUDA-Setup für die RTX 5080 (cu128-Build) wird dann
> ergänzt — siehe Kommentare in den `requirements.txt`.

## Nützliche Befehle

```bash
pnpm infra:up / infra:down / infra:logs   # Docker steuern
pnpm dev:web                              # Next.js Dev-Server
pnpm dev:agent                            # LiveKit-Agent (Phase-0-Stub)
pnpm db:push / db:generate / db:migrate   # Drizzle-Schema
```
