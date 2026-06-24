"""VoiceBot STT-Dienst (faster-whisper) — STUB (Phase 0).

Phase 2: faster-whisper-Modell laden (Schweizerdeutsch-Finetune möglich) und
echte Transkription implementieren. Läuft auf dem Host mit CUDA (RTX 5080),
nicht in Docker — siehe README.
"""

from fastapi import FastAPI

app = FastAPI(title="VoiceBot STT (faster-whisper)")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "stt-whisper", "implemented": False}


@app.post("/transcribe")
def transcribe() -> dict:
    # TODO Phase 2: Audio entgegennehmen -> Whisper -> Hochdeutsch-Text.
    return {"error": "not_implemented", "phase": 2}
