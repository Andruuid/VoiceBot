"""VoiceBot STT-Dienst (faster-whisper).

Phase 2 (CPU-first): faster-whisper läuft über CTranslate2 — *kein* PyTorch/CUDA nötig.
Damit ist dieser Dienst auf jedem Rechner lauffähig; der GPU-/cu128-Pfad (RTX 5080,
Blackwell) und der Schweizerdeutsch-Finetune kommen später als reiner Modell-/Geräte-Tausch.

Schnittstelle:
  GET  /health
  POST /transcribe?language=de   Body = Audio-Bytes (WAV/PCM mit Header) → { "text": ... }

Beispiel:
  curl --data-binary @probe.wav -H "Content-Type: audio/wav" \
       "http://localhost:8001/transcribe?language=de"

Konfiguration über Umgebungsvariablen:
  WHISPER_MODEL    (Default "base"; z.B. "small", "medium", "large-v3-turbo")
  WHISPER_DEVICE   (Default "cpu")
  WHISPER_COMPUTE  (Default "int8")
"""

from __future__ import annotations

import io
import os
import time

from fastapi import FastAPI, Request
from faster_whisper import WhisperModel

MODEL_NAME = os.getenv("WHISPER_MODEL", "base")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE", "int8")

app = FastAPI(title="VoiceBot STT (faster-whisper)")

# Modell einmalig beim Start laden (teuer); danach pro Anfrage wiederverwenden.
_model: WhisperModel | None = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)
    return _model


@app.on_event("startup")
def _warmup() -> None:
    # Modell früh laden, damit die erste echte Anfrage nicht die Ladezeit trägt.
    get_model()


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "stt-whisper",
        "implemented": True,
        "model": MODEL_NAME,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
    }


@app.post("/transcribe")
async def transcribe(request: Request) -> dict:
    language = request.query_params.get("language") or "de"
    audio = await request.body()
    if not audio:
        return {"error": "empty_body", "hint": "Audio-Bytes (WAV) als Request-Body senden"}

    started = time.perf_counter()
    # faster-whisper dekodiert WAV/Container-Bytes selbst (via PyAV) und resampled auf 16 kHz.
    segments, info = get_model().transcribe(
        io.BytesIO(audio),
        language=language,
        beam_size=1,  # Latenz vor Genauigkeit für den ersten Slice
        vad_filter=False,  # VAD macht bereits der LiveKit-Agent
    )
    text = "".join(seg.text for seg in segments).strip()
    elapsed_ms = round((time.perf_counter() - started) * 1000)

    return {
        "text": text,
        "language": info.language,
        "duration": round(info.duration, 2),
        "elapsed_ms": elapsed_ms,
    }
