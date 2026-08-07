/**
 * Voice personas — shared between the client (settings UI, browser fallback
 * voice) and the server (hosted TTS + chat system prompt).
 */

export type PersonaId = "jarvis" | "friday" | "veronica" | "edith";

export type Persona = {
  id: PersonaId;
  label: string;
  tagline: string;
  /** Hosted TTS voice id. */
  voice: string;
  /** Delivery instructions for the hosted TTS model. */
  ttsInstructions: string;
  /** Personality overlay appended to the chat system prompt. */
  personality: string;
  /** Preferred browser SpeechSynthesis language + gender hint (fallback voice). */
  fallback: { lang: string; match: RegExp };
};

export const PERSONAS: Record<PersonaId, Persona> = {
  jarvis: {
    id: "jarvis",
    label: "JARVIS",
    tagline: "Refined British butler",
    voice: "ash",
    ttsInstructions:
      "Speak with a refined, upper-class British (Received Pronunciation) accent — a polished English gentleman. Calm, composed, dignified, quietly confident with subtle dry wit. Measured pace, crisp articulation, understated authority.",
    personality:
      "You are JARVIS: formal, precise, dryly witty, unfailingly polite. Address the user as \"sir\" occasionally.",
    fallback: { lang: "en-GB", match: /daniel|arthur|george|male/i },
  },
  friday: {
    id: "friday",
    label: "FRIDAY",
    tagline: "Warm Irish-accented ally",
    voice: "coral",
    ttsInstructions:
      "Speak with a light Irish lilt — warm, bright, friendly and quick. Casual confidence, upbeat energy, a touch playful, but always efficient.",
    personality:
      "You are FRIDAY: warm, upbeat, casual and quick-witted. Address the user as \"boss\" occasionally.",
    fallback: { lang: "en-IE", match: /moira|siobhan|female/i },
  },
  veronica: {
    id: "veronica",
    label: "VERONICA",
    tagline: "Calm, sophisticated analyst",
    voice: "shimmer",
    ttsInstructions:
      "Speak with a smooth, sophisticated, softly-spoken tone. Elegant, unhurried, reassuring, with gentle warmth and immaculate diction.",
    personality:
      "You are VERONICA: calm, elegant, analytical and reassuring. Never rushed, always thoughtful.",
    fallback: { lang: "en-GB", match: /serena|kate|female/i },
  },
  edith: {
    id: "edith",
    label: "E.D.I.T.H.",
    tagline: "Crisp tactical operator",
    voice: "sage",
    ttsInstructions:
      "Speak with a crisp, clean, neutral accent — clipped, alert, tactical and efficient. Minimal ornament, high clarity, mission-briefing energy.",
    personality:
      "You are E.D.I.T.H.: crisp, tactical and efficient. Answer like a mission briefing — direct, no filler.",
    fallback: { lang: "en-US", match: /samantha|zira|female/i },
  },
};

export const PERSONA_LIST: Persona[] = [
  PERSONAS.jarvis,
  PERSONAS.friday,
  PERSONAS.veronica,
  PERSONAS.edith,
];

export const DEFAULT_PERSONA: PersonaId = "jarvis";

export function resolvePersona(id?: string | null): Persona {
  return PERSONAS[(id ?? "") as PersonaId] ?? PERSONAS[DEFAULT_PERSONA];
}
