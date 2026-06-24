"""VoiceBot TTS-Dienst (Piper) — STUB (Phase 0).

Phase 2: Piper-Stimme laden und echte Synthese implementieren.
Schweizerdeutsch-Pfad später via XTTS-v2 (Lizenz beachten, siehe Spezifikation §9).
"""

from fastapi import FastAPI

app = FastAPI(title="VoiceBot TTS (Piper)")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "tts-piper", "implemented": False}


@app.post("/synthesize")
def synthesize() -> dict:
    # TODO Phase 2: Text entgegennehmen -> Piper -> Audio (PCM/WAV).
    return {"error": "not_implemented", "phase": 2}
