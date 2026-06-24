"""Custom STT-Adapter: schickt eine fertige Äußerung an den faster-whisper-FastAPI-Dienst.

Nicht-streamend (streaming=False) — der AgentSession-VAD segmentiert die Äußerung und ruft
dann _recognize_impl mit dem gepufferten Audio auf. Das passt zum CPU-first-Dienst, der eine
ganze WAV entgegennimmt.
"""

from __future__ import annotations

import httpx
from livekit import rtc
from livekit.agents import stt
from livekit.agents.utils import AudioBuffer


class WhisperSTT(stt.STT):
    def __init__(self, *, base_url: str, language: str = "de") -> None:
        super().__init__(capabilities=stt.STTCapabilities(streaming=False, interim_results=False))
        self._base_url = base_url.rstrip("/")
        self._language = language

    async def _recognize_impl(
        self,
        buffer: AudioBuffer,
        *,
        language=None,  # NotGivenOr[str]
        conn_options=None,
    ) -> stt.SpeechEvent:
        lang = language if isinstance(language, str) and language else self._language

        # Gepufferte Frames zu einer einzelnen WAV (mit Header) zusammenfassen.
        wav_bytes = rtc.combine_audio_frames(buffer).to_wav_bytes()

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self._base_url}/transcribe",
                params={"language": lang},
                content=wav_bytes,
                headers={"Content-Type": "audio/wav"},
            )
            resp.raise_for_status()
            text = (resp.json().get("text") or "").strip()

        return stt.SpeechEvent(
            type=stt.SpeechEventType.FINAL_TRANSCRIPT,
            alternatives=[stt.SpeechData(language=lang, text=text)],
        )
