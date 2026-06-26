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
  WHISPER_MODEL    (Default "small"; z.B. "base", "medium", "large-v3-turbo")
  WHISPER_DEVICE   (Default "cpu")
  WHISPER_COMPUTE  (Default "int8")
  WHISPER_BEAM     (Default "5"; 1 = greedy/schneller, 5 = genauer)
  WHISPER_PROMPT   (Default ""; biast Fachvokabular, z.B. "Bedarfsplaner, Standardbedarf")

Modellwahl (CPU, ~3 s Audio gemessen): base versteht Deutsch ungenau ("Bedarf"→
"Bettorf"); small trifft es zuverlässig bei ~1 s; medium ist gleich gut, aber ~3×
langsamer. Für die RTX 5080 später large-v3-turbo auf GPU (cu128, ~Echtzeit).
"""

from __future__ import annotations

import glob
import io
import logging
import os
import sysconfig
import time
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request


def _register_cuda_dll_dirs() -> None:
    """Windows + device=cuda: cuBLAS/cuDNN aus den NVIDIA-pip-Wheels für den DLL-Loader
    sichtbar machen (liegen in site-packages/nvidia/*/bin, nicht im PATH). Auf CPU-only-
    Setups ohne nvidia-Pakete ein No-op — die GPU-Wheels sind optional (siehe requirements)."""
    if os.name != "nt":
        return
    sp = sysconfig.get_paths()["purelib"]
    for binpath in glob.glob(os.path.join(sp, "nvidia", "*", "bin")):
        try:
            os.add_dll_directory(binpath)
        except OSError:
            pass


_register_cuda_dll_dirs()
from faster_whisper import WhisperModel  # noqa: E402  (nach DLL-Registrierung importieren)

# Root-.env laden (drei Ebenen über services/stt-whisper), dann lokale .env.
# Muss vor dem Lesen der WHISPER_*-Variablen passieren.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")
load_dotenv()

logger = logging.getLogger("stt-whisper")

MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE", "int8")
BEAM_SIZE = int(os.getenv("WHISPER_BEAM", "5"))
INITIAL_PROMPT = os.getenv("WHISPER_PROMPT", "") or None

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
    # Modell früh laden UND eine Dummy-Transkription fahren. Auf der GPU (Blackwell)
    # kompiliert CTranslate2 die Kernels beim ersten Aufruf per JIT (~15-20 s) — das
    # soll hier beim Start passieren, nicht bei der ersten echten Frage des Nutzers.
    logger.info("Warmup: lade %s (device=%s, compute=%s) …", MODEL_NAME, DEVICE, COMPUTE_TYPE)
    started = time.perf_counter()
    model = get_model()
    try:
        import numpy as np

        list(model.transcribe(np.zeros(16000, dtype="float32"), language="de", beam_size=1)[0])
    except Exception as e:  # Warmup ist best-effort; Dienst soll trotzdem starten
        logger.warning("Warmup-Transkription fehlgeschlagen: %s", e)
    logger.info("Warmup fertig in %.1fs", time.perf_counter() - started)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "stt-whisper",
        "implemented": True,
        "model": MODEL_NAME,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
        "beam_size": BEAM_SIZE,
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
        beam_size=BEAM_SIZE,
        initial_prompt=INITIAL_PROMPT,  # biast Fachvokabular (z.B. "Bedarfsplaner")
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
