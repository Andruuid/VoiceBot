# VoiceBot — Spezifikation

> Startdokument für das Projekt. Lebendiges Dokument: bei Architektur-Entscheidungen hier aktualisieren.
> Stand: 2026-06-24

---

## 1. Vision

Ein **Voice-Call-Agent**, mit dem man **per Sprache redet** und der **Fragen zu einem bestimmten Programm/Produkt beantwortet**. Der Bot stützt sich dabei auf ein hochgeladenes **Handbuch (Wissensdatenbank)** und ist über **System-Prompt + Anweisungen** frei konfigurierbar.

Über eine **moderne Next.js/React-Oberfläche** kann man **mehrere Bots** anlegen. Jeder Bot ist eine **Instanz mit eigenen Daten** (eigene Wissensdatenbank, eigener Prompt, eigene Pipeline-Konfiguration).

**Leitprinzipien:**
1. **Provider-agnostisch & austauschbar** — STT, LLM und TTS sind über eine Konfiguration ersetzbar. Lokal (eigene GPU) **oder** Cloud, per Schalter.
2. **Lokal lauffähig** — die gesamte Pipeline muss auf der Entwickler-Maschine (RTX 5080, 16 GB) laufen, ohne Cloud-Zwang.
3. **Hochdeutsch zuerst, Schweizerdeutsch vorbereitet** — die Architektur wird so gebaut, dass ein späterer Wechsel auf Schweizerdeutsch-Modelle (STT-Finetune + Dialekt-TTS) nur ein Provider-/Modell-Tausch ist, kein Umbau.

---

## 2. Scope

### MVP (Phase 1)
- Sprache: **Hochdeutsch**.
- Kanal: **nur Browser** (Mikrofon im Web-UI, WebRTC via LiveKit).
- Bot-Management-UI: Bots erstellen / bearbeiten / löschen.
- Pro Bot: Name, System-Prompt, freie Anweisungen, Pipeline-Konfiguration.
- Wissensdatenbank: **Textdatei-Upload** pro Bot → RAG-Abruf zur Laufzeit.
- LLM: **OpenRouter** (Cloud) **oder LM Studio** (lokal), per Config umschaltbar.
- STT/TTS: **lokal (faster-whisper + Piper) oder Cloud (Deepgram + ElevenLabs)**, per Config umschaltbar.
- Live-Voice-Gespräch im Browser mit Turn-Taking & Barge-in (von LiveKit gelöst).
- Transkript-Anzeige des Gesprächs.

### Nicht im MVP (bewusst später)
- Echte **Telefonie** (SIP/Twilio) — Architektur hält die Tür offen (LiveKit kann SIP), aber nicht implementiert.
- **Schweizerdeutsch**-Modelle (eigener STT-Finetune, Dialekt-TTS) — siehe §9.
- Multi-User / Mandanten / Auth / Billing — zunächst Single-User lokal.
- Mobile-App.

---

## 3. Architektur-Überblick

Vier klar getrennte Schichten. Frontend/API/Backend sind TypeScript; der **Voice-Agent ist Python**
(LiveKit Agents SDK) ebenso wie die Modell-Dienste (siehe Entscheidung in §11).

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Frontend (Next.js / React / TS)                            │
│    Bot-Verwaltung · KB-Upload · Pipeline-Config · Live-Talk   │
└───────────────┬───────────────────────────┬──────────────────┘
                │ REST/tRPC (CRUD)           │ WebRTC (Audio)
┌───────────────▼──────────────┐  ┌──────────▼──────────────────┐
│ 2. Backend-API (Node/TS)     │  │ 3. Voice-Agent (LiveKit, Py) │
│    Bots, KB, Config, RAG-    │  │    VAD · Turn-Taking · STT→  │
│    Indexierung, Auth(später) │  │    LLM→TTS-Loop pro Session  │
└───────────────┬──────────────┘  └──────────┬──────────────────┘
                │                             │ ruft via Adapter
        ┌───────▼────────┐         ┌──────────▼───────────────────┐
        │ Postgres +     │         │ 4. Modell-Provider             │
        │ pgvector (RAG) │         │  LLM:  OpenRouter | LM Studio  │
        └────────────────┘         │  STT:  Deepgram   | faster-whisper (Py) │
                                   │  TTS:  ElevenLabs | Piper (Py) │
                                   └────────────────────────────────┘
```

**Datenfluss eines Gesprächs:**
1. Browser öffnet WebRTC-Verbindung zum LiveKit-Server, sendet Mikrofon-Audio.
2. LiveKit-Agent (Worker) erkennt Sprechpausen (VAD/Turn-Detection).
3. **STT**-Adapter: Audio → Hochdeutsch-Text.
4. **RAG**: relevante Handbuch-Abschnitte zum Text abrufen.
5. **LLM**-Adapter: System-Prompt + Anweisungen + RAG-Kontext + Verlauf → Antworttext.
6. **TTS**-Adapter: Antworttext → Audio, zurück in den WebRTC-Stream.
7. Transkript wird ans Frontend gepusht und (optional) gespeichert.

---

## 4. Provider-Abstraktion (Kernstück)

Ziel: Modelle/Dienste **pro Bot per Config** wählbar, lokal ⇄ Cloud ohne Codeänderung.

LiveKit Agents bringt das Plugin-Konzept für STT/LLM/TTS bereits mit. Wir nutzen das und ergänzen **eigene Adapter** für die lokalen Dienste. Ein **Provider-Registry** instanziiert anhand der Bot-Config das passende Plugin.

### LLM
| Modus | Endpoint | Hinweis |
|---|---|---|
| **Cloud** | OpenRouter (`https://openrouter.ai/api/v1`) | OpenAI-kompatibel |
| **Lokal** | LM Studio (`http://localhost:1234/v1`) | OpenAI-kompatibel |

→ Beide über das **OpenAI-kompatible LLM-Plugin** mit unterschiedlicher `baseURL` + `apiKey` + `model`. Ein einziger Adapter deckt beide ab.

### STT
| Modus | Dienst | Implementierung |
|---|---|---|
| **Cloud** | Deepgram | LiveKit-Standard-Plugin |
| **Lokal** | faster-whisper | eigener Python-FastAPI-Dienst + Custom-Adapter (WebSocket/Streaming) |

### TTS
| Modus | Dienst | Implementierung |
|---|---|---|
| **Cloud** | ElevenLabs | LiveKit-Standard-Plugin |
| **Lokal** | Piper | eigener Python-FastAPI-Dienst + Custom-Adapter |

### Konfigurations-Schema (pro Bot)
```jsonc
{
  "pipeline": {
    "stt": {
      "provider": "local-whisper",        // "local-whisper" | "deepgram"
      "model": "large-v3-turbo",
      "language": "de"
    },
    "llm": {
      "provider": "openrouter",            // "openrouter" | "lmstudio"
      "baseUrl": "https://openrouter.ai/api/v1",
      "model": "anthropic/claude-...",     // bei lmstudio: lokaler Modellname
      "temperature": 0.4
    },
    "tts": {
      "provider": "local-piper",           // "local-piper" | "elevenlabs"
      "voice": "de_DE-thorsten-high",
      "language": "de"
    }
  }
}
```
> **Schweizerdeutsch-Pfad (später):** `stt.model` → eigener ZH-Whisper-Finetune; `tts.provider` → "local-xtts" mit Dialekt-Parameter. Schema bleibt identisch.

---

## 5. Datenmodell (Entwurf)

```
Bot
  id            uuid
  name          string
  systemPrompt  text
  instructions  text            // freie Zusatzanweisungen
  pipeline      jsonb           // Config aus §4
  createdAt     timestamp

Document                        // hochgeladene Wissensquelle (das Handbuch)
  id            uuid
  botId         uuid -> Bot
  filename      string
  rawText       text             // kommt komplett in den System-Kontext (kein Chunking)
  createdAt     timestamp

// HINWEIS: Kein Chunk/Embedding/pgvector mehr. Entscheidung 2026-06-24:
// Bei ~200KB-Handbüchern wird das gesamte Dokument in den System-Prefix gelegt
// und per Prompt-Caching wiederverwendet (siehe §6). RAG erst bei Bedarf (große/
// viele Dokumente) — dann Chunk+Embedding wieder einführen.

Conversation                    // optional, Verlauf/Transkripte
  id            uuid
  botId         uuid -> Bot
  startedAt     timestamp

Message
  id            uuid
  conversationId uuid -> Conversation
  role          enum(user|assistant|system)
  text          text
  createdAt     timestamp
```

---

## 6. Wissensdatenbank: Handbuch-im-Kontext + Prompt-Caching

**Entscheidung (2026-06-24):** Kein RAG. Bei einem einzelnen Handbuch (~200KB ≈ 50–65K Tokens) wird das **gesamte Dokument in den System-Prefix** gelegt und per **Prompt-Caching** über die Gesprächs-Turns wiederverwendet. RAG (Chunking/Embeddings/pgvector) ist erst nötig, wenn Dokumente zu groß fürs Kontextfenster werden oder es viele werden — dann nachrüsten.

1. **Upload**: Textdatei (MVP: `.txt`/`.md`; später PDF) → `Document.rawText`.
2. **Prompt-Aufbau pro Bot** (strikte Reihenfolge — Caching ist ein Präfix-Match!):
   ```
   [ systemPrompt + instructions + GANZES Handbuch ]  ← stabil, Cache-Breakpoint hier
   [ Gesprächsverlauf + aktuelle STT-Frage ]          ← volatil, danach
   ```
3. **Kein Zeitstempel / keine Session-ID** in oder vor dem Handbuch-Block — sonst bricht der Cache.

**Caching pro Provider (im LLM-Adapter gekapselt):**
- **OpenRouter → Claude:** `cache_control: {type:"ephemeral"}` auf den Handbuch-Block. 5-Min-TTL (Write ~1,25×, Read ~0,1×) oder `ttl:"1h"` (Write 2×). Mindest-Cachegröße: Opus 4.8 = 4096, Sonnet/Fable = 2048 Tokens — das Handbuch liegt weit darüber.
- **LM Studio (lokal):** kein `cache_control`; llama.cpp cacht den KV-Prefix automatisch, solange der Prefix stabil bleibt. Adapter setzt nichts.

**Warum:** Für Voice ist die Latenz entscheidend — ohne Cache würden 50–65K Tokens bei *jedem* Turn neu verarbeitet (mehrere Sekunden Totzeit). Mit Cache: einmal schreiben, danach schnell/günstig lesen.

> Verifizieren: `usage.cache_read_input_tokens` muss > 0 sein. Bleibt es 0, sitzt ein „silent invalidator" im Prefix (dynamischer Inhalt vor dem Breakpoint).

---

## 7. Tech-Stack (konkret)

| Bereich | Wahl | Begründung |
|---|---|---|
| Frontend | **Next.js (App Router) + React + TypeScript** | Wohlfühl-Stack, schnelle UI |
| UI-Kit | **Tailwind + shadcn/ui** | modern, schnell |
| Backend-API | **Next.js Route Handlers** (MVP) → später eigener Node-Service | weniger Teile am Anfang |
| Typsicherheit Client↔Server | **tRPC** oder Zod-validierte Routes | Ende-zu-Ende-Typen |
| DB / ORM | **Postgres**, **Drizzle ORM** | relationale Daten (Bots/Docs/Verlauf); pgvector erst bei RAG |
| Realtime-Voice | **LiveKit Server + LiveKit Agents (Python-SDK)** | WebRTC, Turn-Taking, Telefonie-ready (reiferes SDK, siehe §11) |
| LLM | **OpenRouter** / **LM Studio** (OpenAI-kompatibel) | austauschbar per baseURL |
| STT lokal | **faster-whisper** (FastAPI-Dienst) | schnell, GPU, ZH-Finetune-fähig |
| STT cloud | **Deepgram** | Latenz/Qualität |
| TTS lokal | **Piper** (FastAPI-Dienst) | leichtgewichtig, GPU/CPU |
| TTS cloud | **ElevenLabs** | Qualität |
| Modell-Dienste | **Python 3.11 + FastAPI**, je als Docker-Container | einzige Python-Fläche |
| Dev-Orchestrierung | **Docker Compose** | LiveKit + Postgres + Py-Dienste lokal |
| Monorepo | **pnpm workspaces** | gemeinsame Typen |

---

## 8. Repo-Struktur (geplant)

```
voicebot/
├─ apps/
│  ├─ web/                 # Next.js: UI + API Route Handlers
│  └─ agent/               # LiveKit Agent (Python) — der Voice-Worker
├─ packages/
│  ├─ core/                # gemeinsame Typen, Pipeline-Schema, Provider-Registry, Adapter
│  └─ db/                  # Drizzle-Schema + Client
├─ services/
│  ├─ stt-whisper/         # Python FastAPI: faster-whisper
│  └─ tts-piper/           # Python FastAPI: Piper
├─ docker-compose.yml      # LiveKit-Server, Postgres+pgvector, Py-Dienste
├─ .env.example
└─ Spezifikation.md
```

---

## 9. Schweizerdeutsch-Pfad (späterer Ausbau)

Bewusst out-of-scope für den MVP, aber als Modell-Tausch eingeplant:
- **STT**: LoRA-Finetune von Whisper large-v3 auf den Korpora **STT4SG-350** / **SDS-200** (auf Zürich-Dialekt fokussiert). Ausgabe bleibt Hochdeutsch-Text → LLM unverändert.
- **TTS**: **XTTS-v2**-Finetune für Dialekt-Stimme (⚠️ Coqui-Lizenz = nicht-kommerziell, vor Produktivnutzung klären).
- Beides läuft auf der RTX 5080 (LoRA passt in 16 GB; Full-Finetune des 1.55B-Modells nicht).
- **Hardware-Hinweis**: RTX 5080 = Blackwell (sm_120) → PyTorch mit **CUDA 12.8+** (cu128-Build) zwingend.

Referenzen: STT4SG-350 (arXiv 2305.18855), SDS-200, Voice Adaptation for Swiss German (arXiv 2505.22054), swissnlp.org/datasets.

---

## 10. Roadmap / Phasen

| Phase | Inhalt | Ergebnis |
|---|---|---|
| **0 — Setup** | Monorepo, Docker Compose (LiveKit + Postgres), .env | „Hello World“-Stack läuft |
| **1 — Text-Bot** | Bot-CRUD-UI, KB-Upload, RAG, LLM-Adapter (OpenRouter/LM Studio), **Text-Chat** | Bot beantwortet Fragen per Text |
| **2 — Voice-Loop** | LiveKit-Agent (Python), STT/TTS-Adapter (CPU), Browser-Mic, Live-Gespräch + Transkript | Sprechen mit dem Bot (Hochdeutsch) |
| **3 — Austauschbarkeit** | Pipeline-Config-UI, lokal⇄Cloud-Schalter, lokale Py-Dienste fertig | Modelle per Klick wechselbar |
| **4 — Politur** | Latenz-Tuning, Barge-in, Fehlerfälle, Persistenz | vorzeigbarer MVP |
| **5 — Schweizerdeutsch** | STT-Finetune + Dialekt-TTS einhängen | ZH-Sprachbetrieb |
| **6 — Telefonie (opt.)** | LiveKit SIP / Twilio | echte Anrufe |

---

## 11. Entscheidungen & offene Punkte

**Festgelegt (2026-06-24):**
- ✅ **LiveKit selbst-gehostet in Docker** (`--dev`-Modus für lokale Entwicklung), keine Cloud-Pflicht.
- ✅ **Keine harten Abhängigkeiten von externen Diensten** — alles muss lokal laufen (LM Studio + faster-whisper + Piper + Docker). OpenRouter/Deepgram/ElevenLabs sind optionale Adapter.
- ✅ **Embeddings: Start mit LM Studio** (OpenAI-kompatibel), Provider bleibt abstrahiert, spätere Wahl offen.
- ✅ **Voice-Agent in Python statt TypeScript** (Entscheidung Phase 2): das reifere LiveKit-Agents-SDK
  ist Python und passt zu den STT/TTS-Diensten + dem Schweizerdeutsch-Finetuning (§9). Folge: Der Agent
  kann `@voicebot/core` nicht importieren — er holt den fertigen System-Prefix über HTTP
  (`GET /api/bots/[id]/voice-context`), damit der Prefix byte-identisch bleibt (Caching, §6).
- ✅ **Voice-MVP CPU-first**: faster-whisper (CTranslate2) + Piper (onnxruntime) laufen ohne PyTorch/CUDA.
  Der GPU-/cu128-Pfad (RTX 5080, Blackwell) ist ein späterer Modell-/Geräte-Tausch, kein Umbau.

**Noch offen:**
- [ ] Embedding-Dimension hängt vom gewählten LM-Studio-Modell ab (Default im DB-Schema: **768**, z.B. `nomic-embed-text`). Bei Modellwechsel `EMBEDDING_DIM` anpassen.
- [ ] Genaues lokales LLM-Modell für LM Studio (Größe vs. 16 GB VRAM — teilt sich GPU mit Whisper/Piper!).
  - Hinweis: Wenn STT+TTS+LLM **gleichzeitig lokal** laufen, wird VRAM knapp → ggf. LLM in Cloud (OpenRouter) und nur STT/TTS lokal.
- [ ] Auth/Mehrbenutzer ab welcher Phase?
- [ ] Default-Piper-Stimme (Hochdeutsch) festlegen.
- [ ] Cloud-STT/TTS-Adapter (Deepgram/ElevenLabs) im Python-Agent. Die Pipeline-Config-UI bietet die
  Wahl bereits (Phase 3); der Agent nutzt für STT/TTS bis dahin die lokalen Dienste (klarer Warn-Log).

---

## 12. VRAM-Realität (lokaler Vollbetrieb auf 16 GB)

Wichtig für „alles lokal“: STT, TTS und LLM teilen sich **eine** GPU.
- faster-whisper large-v3-turbo (int8): ~1–2 GB
- Piper TTS: ~Hunderte MB
- LLM: der Rest — d.h. realistisch ein **7B–14B-Modell in 4-bit** (~5–10 GB).

→ Für den lokalen Test gut machbar mit kleinem LLM. Für beste Antwortqualität im Alltag: **LLM via OpenRouter**, STT/TTS lokal. Genau dafür ist die Provider-Abstraktion da.
