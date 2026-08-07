import { createFileRoute } from "@tanstack/react-router";
import { resolvePersona } from "@/lib/jarvisPersonas";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { text, voice, speed, pitch, persona } = (await request.json()) as {
          text?: string;
          voice?: string;
          speed?: number;
          pitch?: number;
          persona?: string;
        };
        if (!text || !text.trim()) {
          return new Response("Missing text", { status: 400 });
        }

        const p10 = resolvePersona(persona);
        const clampedSpeed = Math.min(1.3, Math.max(0.7, Number(speed) || 0.95));
        const p = Math.min(3, Math.max(-3, Math.round(Number(pitch) || 0)));
        const pitchInstruction =
          p <= -3 ? "Use a very deep, bassy chest-resonant pitch."
          : p === -2 ? "Use a noticeably deep, low pitch."
          : p === -1 ? "Use a slightly lower, warmer pitch."
          : p === 0 ? "Use your natural pitch."
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
            voice: voice ?? p10.voice,
            response_format: "mp3",
            instructions: `You are ${p10.label}, an advanced AI assistant. ${p10.ttsInstructions} ${pitchInstruction} When speaking Telugu, keep the same demeanor with clear natural pronunciation.`,
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
