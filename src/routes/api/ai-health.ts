import { createFileRoute } from "@tanstack/react-router";

/**
 * OmniRoute diagnostics. GET returns the cached health snapshot (no provider
 * calls); GET ?probe=1 actively pings every configured provider.
 */
export const Route = createFileRoute("/api/ai-health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const probe = new URL(request.url).searchParams.get("probe") === "1";
        const [
          { healthSnapshot },
          { checkProviders },
          { availableProviders, catalogStats, keyRotationSnapshot },
          { usageSnapshot },
          { modelLockouts },
        ] = await Promise.all([
          import("@/lib/omniroute/health.server"),
          import("@/lib/omniroute/router.server"),
          import("@/lib/omniroute/providers.server"),
          import("@/lib/omniroute/usage.server"),
          import("@/lib/omniroute/modelLockout.server"),
        ]);

        const configured = availableProviders().map((p) => ({
          id: p.id,
          label: p.label,
          format: p.format,
          textModel: p.textModel,
          visionModel: p.visionModel,
          utilityModel: p.utilityModel,
          models: p.models.length,
        }));
        const probes = probe ? await checkProviders() : undefined;

        return new Response(
          JSON.stringify(
            {
              catalog: catalogStats(),
              configured,
              health: healthSnapshot(),
              modelLockouts: modelLockouts(),
              usage: usageSnapshot(),
              keys: keyRotationSnapshot(),
              probes,
            },
            null,
            2,
          ),
          { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );

      },
    },
  },
});
