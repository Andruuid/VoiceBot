"""VoiceBot TTS-Dienst (XTTS-v2, GPU) — neurale Alternative zu Piper, mit Voice-Cloning.

Gleiche HTTP-Schnittstelle wie der Piper-Dienst, damit der Agent-Adapter (PiperTTS,
generischer HTTP-TTS-Client) unverändert wiederverwendbar ist:
  GET  /health
  GET  /speakers     → eingebaute Sprecher + geladene Referenzstimmen
  POST /synthesize   Body = { "text": "...", "voice": "<Sprecher ODER Referenzname>" } → WAV (24 kHz)

Stimmenwahl ("voice"):
  - Name einer **Referenz** (Datei refs/<name>.wav|mp3|flac) → Voice-Cloning in genau dieser
    Stimme MIT korrekter deutscher Aussprache. Das ist der Qualitätsweg für natürliches Deutsch.
  - Name eines **eingebauten** XTTS-Sprechers (englische Studio-Stimmen → in Deutsch akzentig).
  - Unbekannt → Fallback: erste Referenz, sonst Default-Sprecher.

XTTS-v2 läuft auf PyTorch (cu128 für RTX 5080 / Blackwell). Lizenz: Coqui Public Model
License (nicht-kommerziell); COQUI_TOS_AGREED=1 bestätigt die TOS für den Modell-Download.

Konfiguration (Umgebungsvariablen):
  XTTS_DEVICE     (Default "cuda" wenn verfügbar)
  XTTS_REFS_DIR   (Default "./refs") — hier Referenz-Audios ablegen (~6-20 s, sauber, eine Stimme)
  XTTS_SPEAKER    (Default "Ana Florence") — Fallback-Sprecher, wenn keine Referenz vorhanden
  XTTS_LANGUAGE   (Default "de")
"""

from __future__ import annotations

import glob
import io
import logging
import os
import time
import wave
from pathlib import Path

# TOS vor dem TTS-Import bestätigen (sonst hängt der Download-Prompt).
os.environ.setdefault("COQUI_TOS_AGREED", "1")

import numpy as np
import torch
from dotenv import load_dotenv
from fastapi import FastAPI, Response
from pydantic import BaseModel

load_dotenv(Path(__file__).resolve().parents[2] / ".env")
load_dotenv()

from TTS.api import TTS  # noqa: E402  (nach COQUI_TOS_AGREED importieren)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tts-xtts")

MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"
DEVICE = os.getenv("XTTS_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
REFS_DIR = os.getenv("XTTS_REFS_DIR", str(Path(__file__).parent / "refs"))
DEFAULT_SPEAKER = os.getenv("XTTS_SPEAKER", "Ana Florence")
LANGUAGE = os.getenv("XTTS_LANGUAGE", "de")

app = FastAPI(title="VoiceBot TTS (XTTS-v2)")

_model: TTS | None = None
# Vorberechnete Cloning-Latents je Referenzname: name -> (gpt_cond_latent, speaker_embedding)
_refs: dict[str, tuple] = {}


def get_model() -> TTS:
    global _model
    if _model is None:
        logger.info("Lade XTTS-v2 auf %s …", DEVICE)
        _model = TTS(MODEL_NAME).to(DEVICE)
    return _model


def _xtts():
    return get_model().synthesizer.tts_model


def _builtin_speakers() -> list[str]:
    try:
        return list(_xtts().speaker_manager.name_to_id.keys())
    except Exception:
        return []


def _load_refs() -> None:
    """Referenz-Audios aus REFS_DIR laden und ihre Conditioning-Latents vorberechnen
    (einmalig, damit /synthesize schnell bleibt)."""
    _refs.clear()
    patterns = ("*.wav", "*.mp3", "*.flac", "*.m4a", "*.ogg")
    files = [f for p in patterns for f in glob.glob(os.path.join(REFS_DIR, p))]
    for f in sorted(files):
        name = Path(f).stem
        try:
            gpt_cond_latent, speaker_embedding = _xtts().get_conditioning_latents(audio_path=[f])
            _refs[name] = (gpt_cond_latent, speaker_embedding)
            logger.info("Referenzstimme geladen: %s", name)
        except Exception as e:
            logger.warning("Referenz '%s' fehlgeschlagen: %s", name, e)


@app.on_event("startup")
def _warmup() -> None:
    started = time.perf_counter()
    get_model()
    Path(REFS_DIR).mkdir(parents=True, exist_ok=True)
    _load_refs()
    # Warmup-Synthese (lädt Kernels/Caches vor); Referenz bevorzugt, sonst Default-Sprecher.
    try:
        _synth("Hallo.", next(iter(_refs)) if _refs else DEFAULT_SPEAKER)
    except Exception as e:
        logger.warning("Warmup-Synthese fehlgeschlagen: %s", e)
    logger.info(
        "XTTS bereit in %.1fs (device=%s, %d Referenz(en), %d eingebaute Sprecher)",
        time.perf_counter() - started, DEVICE, len(_refs), len(_builtin_speakers()),
    )


def _to_wav_bytes(wav, sample_rate: int) -> bytes:
    if isinstance(wav, torch.Tensor):
        wav = wav.detach().cpu().numpy()
    arr = np.clip(np.asarray(wav, dtype=np.float32).reshape(-1), -1.0, 1.0)
    pcm16 = (arr * 32767.0).astype("<i2")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm16.tobytes())
    return buffer.getvalue()


def _synth(text: str, voice: str) -> bytes:
    model = get_model()
    sr = model.synthesizer.output_sample_rate  # XTTS: 24000

    if voice in _refs:
        # Voice-Cloning über vorberechnete Latents (schnell + natürliches Deutsch).
        gpt_cond_latent, speaker_embedding = _refs[voice]
        out = _xtts().inference(text, LANGUAGE, gpt_cond_latent, speaker_embedding)
        return _to_wav_bytes(out["wav"], sr)

    if voice in _builtin_speakers():
        wav = model.tts(text=text, speaker=voice, language=LANGUAGE)
        return _to_wav_bytes(wav, sr)

    # Fallback: erste Referenz, sonst Default-Sprecher.
    if _refs:
        return _synth(text, next(iter(_refs)))
    wav = model.tts(text=text, speaker=DEFAULT_SPEAKER, language=LANGUAGE)
    return _to_wav_bytes(wav, sr)


@app.get("/health")
def health() -> dict:
    loaded = _model is not None
    return {
        "status": "ok",
        "service": "tts-xtts",
        "implemented": True,
        "device": DEVICE,
        "model_loaded": loaded,
        "refs": sorted(_refs.keys()),
        "num_builtin_speakers": len(_builtin_speakers()) if loaded else None,
    }


@app.get("/speakers")
def speakers() -> dict:
    return {"refs": sorted(_refs.keys()), "builtin": sorted(_builtin_speakers())}


class SynthesizeRequest(BaseModel):
    text: str
    voice: str | None = None


@app.post("/synthesize")
def synthesize(req: SynthesizeRequest) -> Response:
    text = (req.text or "").strip()
    if not text:
        return Response(status_code=400, content="empty text")
    wav_bytes = _synth(text, req.voice or "")
    return Response(content=wav_bytes, media_type="audio/wav")
