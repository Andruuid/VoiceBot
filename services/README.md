# VoiceBot — lokale Modell-Dienste (STT + TTS)

Zwei kleine FastAPI-Dienste, die der Voice-Agent über HTTP aufruft. **CPU-first**: weder
PyTorch noch CUDA nötig (faster-whisper → CTranslate2, Piper → onnxruntime). Der GPU-/cu128-Pfad
(RTX 5080, Blackwell) und der Schweizerdeutsch-Finetune kommen später als reiner Modelltausch
(siehe Spezifikation §9).

Ports (vgl. `.env`): STT = `8001`, TTS = `8002`.

---

## STT — `stt-whisper` (faster-whisper)

```bash
cd services/stt-whisper
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --port 8001
```

- Modell wählbar per Env: `WHISPER_MODEL` (Default `base`; z.B. `small`, `large-v3-turbo`).
- Test:
  ```bash
  curl http://localhost:8001/health
  curl --data-binary @probe.wav -H "Content-Type: audio/wav" \
       "http://localhost:8001/transcribe?language=de"
  ```

## TTS — `tts-piper` (Piper)

```bash
cd services/tts-piper
python -m venv .venv && . .venv/Scripts/activate
pip install -r requirements.txt

# Einmaliger Stimmen-Download (Hochdeutsch, männlich):
python -m piper.download_voices de_DE-thorsten-high --download-dir ./voices

uvicorn main:app --port 8002
```

- Stimme wählbar per Env: `PIPER_VOICE` (Default `de_DE-thorsten-high`), `PIPER_VOICE_DIR` (Default `./voices`).
- Liegt das Modell nicht in `voices/`, meldet `/health` `default_voice_loaded: false` und
  `/synthesize` antwortet mit `503` samt Download-Hinweis.
- Test:
  ```bash
  curl http://localhost:8002/health
  curl -X POST http://localhost:8002/synthesize \
       -H "Content-Type: application/json" \
       -d '{"text":"Hallo, ich bin dein Assistent."}' --output probe.wav
  ```

> `voices/` (die heruntergeladenen Modelle) gehört nicht ins Git — per `.gitignore` ausgeschlossen.
