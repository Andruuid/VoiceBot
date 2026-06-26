/**
 * Kuratierte Auswahl der eingebauten XTTS-v2-Sprecher fürs TTS-Dropdown (Provider local-xtts).
 *
 * XTTS-v2 bringt 58 Studio-Stimmen mit; `id` ist exakt der Sprechername, den der XTTS-Dienst
 * erwartet (services/tts-xtts). Anders als Piper sind das neurale Stimmen auf der GPU —
 * deutlich natürlicher, auch die weiblichen. Die Geschlechts-Zuordnung folgt der üblichen
 * XTTS-Doku; falls eine Stimme anders klingt als gelabelt, einfach hier anpassen.
 */
import type { PiperVoiceOption } from "./piper-voices";

export const XTTS_DE_VOICES: PiperVoiceOption[] = [
  { id: "Ana Florence", label: "Ana Florence", gender: "weiblich" },
  { id: "Claribel Dervla", label: "Claribel Dervla", gender: "weiblich" },
  { id: "Daisy Studious", label: "Daisy Studious", gender: "weiblich" },
  { id: "Sofia Hellen", label: "Sofia Hellen", gender: "weiblich" },
  { id: "Alison Dietlinde", label: "Alison Dietlinde", gender: "weiblich" },
  { id: "Tammie Ema", label: "Tammie Ema", gender: "weiblich" },
  { id: "Andrew Chipper", label: "Andrew Chipper", gender: "männlich" },
  { id: "Damien Black", label: "Damien Black", gender: "männlich" },
  { id: "Viktor Eka", label: "Viktor Eka", gender: "männlich" },
  { id: "Craig Gutsy", label: "Craig Gutsy", gender: "männlich" },
];
