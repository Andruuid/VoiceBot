/**
 * Kuratierte Auswahl deutscher Piper-Stimmen für das TTS-Dropdown.
 *
 * Die Werte (`id`) sind die offiziellen Piper-Stimmnamen. Der TTS-Dienst lädt eine
 * ausgewählte Stimme beim ersten Gebrauch automatisch herunter (siehe
 * services/tts-piper/main.py) — hier stehen nur Anzeigename + Geschlecht für die UI.
 *
 * Hinweis Qualität: Nur `de_DE-thorsten-*` gibt es in hoher/mittlerer Qualität.
 * Die weiblichen Stimmen liegen nur in „low/x_low" vor und klingen entsprechend
 * etwas synthetischer — für natürlichere Frauenstimmen später Cloud-TTS (ElevenLabs).
 */
export interface PiperVoiceOption {
  id: string;
  label: string;
  gender: "weiblich" | "männlich";
}

export const PIPER_DE_VOICES: PiperVoiceOption[] = [
  { id: "de_DE-thorsten-high", label: "Thorsten — hohe Qualität", gender: "männlich" },
  { id: "de_DE-thorsten-medium", label: "Thorsten — mittel", gender: "männlich" },
  { id: "de_DE-karlsson-low", label: "Karlsson", gender: "männlich" },
  { id: "de_DE-pavoque-low", label: "Pavoque", gender: "männlich" },
  { id: "de_DE-eva_k-x_low", label: "Eva", gender: "weiblich" },
  { id: "de_DE-kerstin-low", label: "Kerstin", gender: "weiblich" },
  { id: "de_DE-ramona-low", label: "Ramona", gender: "weiblich" },
];
