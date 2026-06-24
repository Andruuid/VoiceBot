"""Custom TTS-Adapter: schickt Text an den Piper-FastAPI-Dienst und gibt das WAV in die Pipeline.

Nicht-streamend (streaming=False). Der AudioEmitter bekommt die ganze WAV mit mime_type
"audio/wav"; LiveKit liest den WAV-Header, resampled auf self.sample_rate und schiebt die
Frames in den Ausgabe-Track. Dadurch ist die Stimmen-Samplerate egal.
"""

from __future__ import annotations

import os

import httpx
from livekit.agents import tts
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS, APIConnectOptions
from livekit.agents.utils import shortuuid

# Ausgabe-Samplerate der Pipeline; Piper-WAV wird darauf resampled.
SAMPLE_RATE = int(os.getenv("TTS_SAMPLE_RATE", "24000"))


class PiperTTS(tts.TTS):
    def __init__(self, *, base_url: str, voice: str = "de_DE-thorsten-high") -> None:
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False, aligned_transcript=False),
            sample_rate=SAMPLE_RATE,
            num_channels=1,
        )
        self._base_url = base_url.rstrip("/")
        self._voice = voice

    def synthesize(
        self,
        text: str,
        *,
        conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
    ) -> "PiperChunkedStream":
        return PiperChunkedStream(tts=self, input_text=text, conn_options=conn_options)


class PiperChunkedStream(tts.ChunkedStream):
    def __init__(self, *, tts: PiperTTS, input_text: str, conn_options: APIConnectOptions) -> None:
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._piper = tts

    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self._piper._base_url}/synthesize",
                json={"text": self._input_text, "voice": self._piper._voice},
            )
            resp.raise_for_status()
            wav_bytes = resp.content

        output_emitter.initialize(
            request_id=shortuuid(),
            sample_rate=self._piper.sample_rate,
            num_channels=self._piper.num_channels,
            mime_type="audio/wav",
        )
        output_emitter.push(wav_bytes)
        output_emitter.flush()
