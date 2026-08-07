import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { text, voice, speed, pitch } = (await request.json()) as {
          text?: string;
          voice?: string;
          speed?: number;
          pitch?: number;
        };
        if (!text || !text.trim()) {
          return new Response("Missing text", { status: 400 });
        }

        const clampedSpeed = Math.min(1.3, Math.max(0.7, Number(speed) || 0.95));
        const p = Math.min(3, Math.max(-3, Math.round(Number(pitch) || 0)));
        const pitchInstruction =
          p <= -3 ? "Use a very deep, bassy chest-resonant pitch."
          : p === -2 ? "Use a noticeably deep, low pitch."
          : p === -1 ? "Use a slightly lower, warmer pitch."
          : p === 0 ? "Use a natural baritone pitch."
          : p === 1 ? "Use a slightly brighter, higher pitch."
          : p === 2 ? "Use a noticeably higher, lighter pitch."
          : "Use a very high, bright pitch.";

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text,
            voice: voice ?? "ash",
            response_format: "mp3",
            instructions:
              `You are JARVIS, Tony Stark's AI butler. Speak with a refined, upper-class British (Received Pronunciation) accent — like a polished English gentleman. Tone: calm, composed, dignified, quietly confident with subtle dry wit. Delivery: measured pace, crisp articulation, gentle warmth, understated authority. Never rushed, never robotic. Precise consonants, elegant vowels. ${pitchInstruction} When speaking Telugu, keep the same composed, refined, gentlemanly demeanor with clear natural pronunciation.`,
            speed: clampedSpeed,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          return new Response(errText, { status: res.status });
        }

        return new Response(res.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});