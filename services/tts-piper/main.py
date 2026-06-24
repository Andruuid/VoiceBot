"""VoiceBot TTS-Dienst (Piper).

Phase 2 (CPU-first): Piper läuft über onnxruntime — *kein* PyTorch/CUDA nötig.
Schweizerdeutsch-Pfad später via XTTS-v2 (Lizenz beachten, Spezifikation §9) als
zusätzlicher Provider; Schema/Schnittstelle bleiben gleich.

Schnittstelle:
  GET  /health
  POST /synthesize   Body = { "text": "...", "voice": "de_DE-thorsten-high" } → WAV-Bytes

Stimmen-Modell (einmaliger Download, siehe README.md):
  python -m piper.download_voices de_DE-thorsten-high --download-dir ./voices

Konfiguration über Umgebungsvariablen:
  PIPER_VOICE_DIR   (Default "./voices")
  PIPER_VOICE       (Default "de_DE-thorsten-high")
"""

from __future__ import annotations

import io
import os
import wave

from fastapi import FastAPI, Response
from pydantic import BaseModel

try:  # Importpfad variiert je nach piper-tts-Version
    from piper.voice import PiperVoice
except ImportError:  # pragma: no cover
    from piper import PiperVoice  # type: ignore

VOICE_DIR = os.getenv("PIPER_VOICE_DIR", "./voices")
DEFAULT_VOICE = os.getenv("PIPER_VOICE", "de_DE-thorsten-high")

app = FastAPI(title="VoiceBot TTS (Piper)")

# Geladene Stimmen cachen (Modell-Laden ist teuer).
_voices: dict[str, PiperVoice] = {}


def get_voice(name: str) -> PiperVoice:
    if name not in _voices:
        model_path = os.path.join(VOICE_DIR, f"{name}.onnx")
        config_path = f"{model_path}.json"
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Stimmen-Modell nicht gefunden: {model_path}. "
                f"Download: python -m piper.download_voices {name} --download-dir {VOICE_DIR}"
            )
        _voices[name] = PiperVoice.load(model_path, config_path=config_path)
    return _voices[name]


@app.on_event("startup")
def _warmup() -> None:
    # Default-Stimme früh laden; fehlt das Modell, scheitert /synthesize später klar.
    try:
        get_voice(DEFAULT_VOICE)
    except FileNotFoundError as e:
        print(f"[tts-piper] WARN: {e}")


@app.get("/health")
def health() -> dict:
    loaded = DEFAULT_VOICE in _voices
    return {
        "status": "ok",
        "service": "tts-piper",
        "implemented": True,
        "default_voice": DEFAULT_VOICE,
        "default_voice_loaded": loaded,
    }


class SynthesizeRequest(BaseModel):
    text: str
    voice: str | None = None


@app.post("/synthesize")
def synthesize(req: SynthesizeRequest) -> Response:
    text = (req.text or "").strip()
    if not text:
        return Response(status_code=400, content="empty text")

    try:
        voice = get_voice(req.voice or DEFAULT_VOICE)
    except FileNotFoundError as e:
        return Response(status_code=503, content=str(e))

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        # Piper setzt Kanäle/Samplerate/Breite selbst und schreibt die Frames.
        voice.synthesize(text, wav_file)

    return Response(content=buffer.getvalue(), media_type="audio/wav")
