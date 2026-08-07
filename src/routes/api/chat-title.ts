import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat-title")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { query?: string; reply?: string };
        const query = (body.query ?? "").slice(0, 1500);
        if (!query.trim()) {
          return new Response(JSON.stringify({ title: "New chat" }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const { routeChatCompletion } = await import("@/lib/omniroute/router.server");

        try {
          const result = await routeChatCompletion({
            tier: "utility",
            routeKey: "chat-title",
            messages: [
              {
                role: "system",
                content:
                  "You name chat conversations. Given the user's first message (and optionally the assistant reply), return ONLY a short descriptive title of 2 to 5 words. No quotes, no punctuation at the end, Title Case. Use the same language as the user's message.",
              },
              {
                role: "user",
                content: `User message: ${query}\n${body.reply ? `Assistant reply: ${String(body.reply).slice(0, 800)}` : ""}`,
              },
            ],
          });
          const raw = result.content.replace(/["“”'`]/g, "").trim();
          const title = raw.split("\n")[0].slice(0, 60) || query.slice(0, 40);
          return new Response(JSON.stringify({ title }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          return new Response(JSON.stringify({ title: query.slice(0, 40) }), {
            headers: { "Content-Type": "application/json" },
          });
        }
      },

    },
  },
});
