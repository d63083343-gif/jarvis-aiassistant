import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { prompt } = (await request.json()) as { prompt?: string };
        if (!prompt || !prompt.trim()) {
          return new Response(JSON.stringify({ error: "Missing prompt" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            prompt: `A high quality, photorealistic image of ${prompt.trim()}.`,
          }),
        });

        if (!upstream.ok) {
          const text = await upstream.text();
          return new Response(JSON.stringify({ error: text }), {
            status: upstream.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        const data = (await upstream.json()) as {
          data?: Array<{ b64_json?: string }>;
        };
        const b64 = data.data?.[0]?.b64_json;
        if (!b64) {
          return new Response(JSON.stringify({ error: "No image returned" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ image: `data:image/png;base64,${b64}` }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});