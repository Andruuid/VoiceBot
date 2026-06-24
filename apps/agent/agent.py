"""VoiceBot Voice-Agent (LiveKit Agents, Python).

Pro Gespräch: liest die botId aus den Raum-Metadaten, holt den stabilen System-Prefix
(systemPrompt + instructions + GANZES Handbuch) + die Pipeline-Config vom Web-Backend
und fährt die STT→LLM→TTS-Schleife mit VAD/Turn-Taking von LiveKit.

Start (LM Studio bzw. OpenRouter laufend, STT :8001 + TTS :8002 laufend):
    apps/agent/.venv/Scripts/python agent.py dev
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import openai, silero

from piper_tts import PiperTTS
from whisper_stt import WhisperSTT

# Root-.env laden (zwei Ebenen über apps/agent), zusätzlich lokale .env falls vorhanden.
_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_ROOT_ENV)
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voicebot.agent")

WEB_BASE_URL = os.getenv("WEB_BASE_URL", "http://localhost:3100").rstrip("/")
STT_SERVICE_URL = os.getenv("STT_SERVICE_URL", "http://localhost:8001")
TTS_SERVICE_URL = os.getenv("TTS_SERVICE_URL", "http://localhost:8002")


def _bot_id_from_room(room: rtc.Room) -> str | None:
    """botId aus Raum-Metadaten lesen; Fallback: aus dem Raumnamen 'voice-{botId}-{suffix}'."""
    if room.metadata:
        try:
            bid = json.loads(room.metadata).get("botId")
            if bid:
                return bid
        except json.JSONDecodeError:
            pass
    name = room.name or ""
    if name.startswith("voice-"):
        return name[len("voice-") :].rsplit("-", 1)[0] or None
    return None


async def _fetch_voice_context(bot_id: str) -> dict:
    url = f"{WEB_BASE_URL}/api/bots/{bot_id}/voice-context"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


def _build_llm(llm_cfg: dict) -> openai.LLM:
    """OpenAI-kompatibles LLM-Plugin für LM Studio ODER OpenRouter (API-Key aus der Umgebung)."""
    provider = llm_cfg.get("provider", "lmstudio")
    if provider == "openrouter":
        api_key = os.getenv("OPENROUTER_API_KEY", "")
    else:
        api_key = os.getenv("LLM_API_KEY", "lm-studio")
    return openai.LLM(
        model=llm_cfg.get("model", "local-model"),
        base_url=llm_cfg.get("baseUrl", "http://localhost:1234/v1"),
        api_key=api_key,
        temperature=llm_cfg.get("temperature", 0.4),
    )


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    bot_id = _bot_id_from_room(ctx.room)
    if not bot_id:
        logger.error("Keine botId in Raum-Metadaten/Name gefunden — breche ab.")
        return

    logger.info("Voice-Session für Bot %s (Raum %s)", bot_id, ctx.room.name)
    context = await _fetch_voice_context(bot_id)
    system_prefix = context["systemPrefix"]
    pipeline = context["pipeline"]

    stt_cfg = pipeline.get("stt", {})
    tts_cfg = pipeline.get("tts", {})

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=WhisperSTT(base_url=STT_SERVICE_URL, language=stt_cfg.get("language", "de")),
        llm=_build_llm(pipeline.get("llm", {})),
        tts=PiperTTS(base_url=TTS_SERVICE_URL, voice=tts_cfg.get("voice", "de_DE-thorsten-high")),
    )

    await session.start(agent=Agent(instructions=system_prefix), room=ctx.room)
    await session.say("Hallo! Ich beantworte Fragen zum Handbuch. Was möchten Sie wissen?")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
