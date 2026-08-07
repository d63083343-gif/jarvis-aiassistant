import { createFileRoute } from "@tanstack/react-router";
import type { ChatMessage, ContentBlock } from "@/lib/omniroute/router.server";


const BASE_PROMPT = `You are JARVIS, a highly advanced AI assistant inspired by Tony Stark's assistant from Iron Man. You are witty, elegant, precise, and slightly formal — call the user "sir" occasionally.

CRITICAL LANGUAGE RULE:
- Detect the language of the user's message.
- If the user speaks or writes in Telugu (even in Roman script / Tenglish), reply in NATURAL TELUGU using Telugu script (తెలుగు).
- If the user speaks English, reply in English.
- If the user mixes them, reply in the dominant language.

When the user attaches an image, analyze it carefully and answer questions about it. Describe what you see, identify objects, read any text, and respond to the user's request about the image.

Keep replies concise (1-3 short sentences) since they will be spoken aloud. No markdown, no emojis, no lists — just spoken prose.`;

const MODE_PROMPTS: Record<string, string> = {
  general: `${BASE_PROMPT}\n\nMODE: GENERAL. Be a helpful, polite, and efficient AI voice assistant with a balanced tone across everyday topics.`,
  developer: `${BASE_PROMPT}\n\nMODE: DEVELOPER. Focus on software engineering, debugging, and technical problem solving. Provide direct, correct code snippets when useful. For code, you may use short fenced code blocks even though replies stay concise.`,
  creative: `${BASE_PROMPT}\n\nMODE: CREATIVE. Be highly imaginative, conversational, and offer unique perspectives, metaphors, and ideas for brainstorming.`,
};

export const Route = createFileRoute("/api/jarvis-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: ChatMessage[]; mode?: string };
        const history = Array.isArray(body.messages) ? body.messages : [];
        const systemPrompt = MODE_PROMPTS[body.mode ?? "general"] ?? MODE_PROMPTS.general;

        // If any message carries an image, route to a vision-capable model tier.
        const hasImage = history.some(
          (m) =>
            Array.isArray(m.content) &&
            (m.content as ContentBlock[]).some((c) => c.type === "image_url"),
        );

        const { routeChatCompletion, OmniRouteError } = await import(
          "@/lib/omniroute/router.server"
        );

        try {
          const result = await routeChatCompletion({
            messages: [{ role: "system", content: systemPrompt }, ...history],
            tier: hasImage ? "vision" : "text",
            routeKey: hasImage ? "chat:vision" : "chat",
          });
          return new Response(
            JSON.stringify({
              reply: result.content,
              provider: result.provider,
              model: result.model,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          const status = err instanceof OmniRouteError ? err.status : 500;
          const message = err instanceof Error ? err.message : "AI routing failed";
          return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

    },
  },
});
