/**
 * OmniRoute provider registry (adapted from OmniRoute's provider/routing layer).
 *
 * Every provider is exposed through an OpenAI-compatible /chat/completions
 * endpoint so the router can swap providers without changing request shape.
 * Configuration is env-driven: a provider is only part of the routing chain
 * when its API key is present. Gemini (via the existing Lovable AI Gateway
 * integration) is always the default primary provider.
 */

export type ProviderId =
  | "gemini"
  | "gemini-direct"
  | "openrouter"
  | "groq"
  | "openai"
  | "lovable-openai";

export type ProviderConfig = {
  id: ProviderId;
  label: string;
  baseUrl: string;
  apiKey: string;
  /** Model used for text-only requests. */
  textModel: string;
  /** Model used when the conversation contains images. */
  visionModel: string;
  /** Fast/cheap model for utility calls (titles, classification). */
  utilityModel: string;
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, unknown>;
};

const env = (name: string): string => process.env[name]?.trim() ?? "";

/** Default priority order; override with OMNIROUTE_PROVIDER_ORDER (csv). */
const DEFAULT_ORDER: ProviderId[] = [
  "gemini",
  "gemini-direct",
  "openrouter",
  "groq",
  "openai",
  "lovable-openai",
];

function buildProvider(id: ProviderId): ProviderConfig | null {
  const lovableKey = env("LOVABLE_API_KEY");

  switch (id) {
    case "gemini":
      if (!lovableKey) return null;
      return {
        id,
        label: "Gemini (Lovable AI Gateway)",
        baseUrl: "https://ai.gateway.lovable.dev/v1",
        apiKey: lovableKey,
        textModel: env("OMNIROUTE_GEMINI_MODEL") || "google/gemini-3-flash-preview",
        visionModel: env("OMNIROUTE_GEMINI_VISION_MODEL") || "google/gemini-2.5-flash",
        utilityModel: env("OMNIROUTE_GEMINI_MODEL") || "google/gemini-3-flash-preview",
      };
    case "gemini-direct": {
      const key = env("GEMINI_API_KEY");
      if (!key) return null;
      return {
        id,
        label: "Gemini (Google AI Studio)",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: key,
        textModel: env("OMNIROUTE_GEMINI_DIRECT_MODEL") || "gemini-2.5-flash",
        visionModel: env("OMNIROUTE_GEMINI_DIRECT_MODEL") || "gemini-2.5-flash",
        utilityModel: "gemini-2.5-flash-lite",
      };
    }
    case "openrouter": {
      const key = env("OPENROUTER_API_KEY");
      if (!key) return null;
      return {
        id,
        label: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: key,
        // Free-tier only: never bill OpenRouter credits.
        textModel: env("OMNIROUTE_OPENROUTER_MODEL") || "openrouter/free",
        visionModel:
          env("OMNIROUTE_OPENROUTER_VISION_MODEL") || "google/gemma-3-27b-it:free",
        utilityModel: env("OMNIROUTE_OPENROUTER_MODEL") || "openrouter/free",
      };
    }
    case "groq": {
      const key = env("GROQ_API_KEY");
      if (!key) return null;
      return {
        id,
        label: "Groq",
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: key,
        textModel: env("OMNIROUTE_GROQ_MODEL") || "llama-3.3-70b-versatile",
        visionModel: env("OMNIROUTE_GROQ_VISION_MODEL") || "meta-llama/llama-4-scout-17b-16e-instruct",
        utilityModel: env("OMNIROUTE_GROQ_MODEL") || "llama-3.3-70b-versatile",
      };
    }
    case "openai": {
      const key = env("OPENAI_API_KEY");
      if (!key) return null;
      return {
        id,
        label: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKey: key,
        textModel: env("OMNIROUTE_OPENAI_MODEL") || "gpt-4o-mini",
        visionModel: env("OMNIROUTE_OPENAI_MODEL") || "gpt-4o-mini",
        utilityModel: "gpt-4o-mini",
      };
    }
    case "lovable-openai":
      if (!lovableKey) return null;
      return {
        id,
        label: "OpenAI (Lovable AI Gateway)",
        baseUrl: "https://ai.gateway.lovable.dev/v1",
        apiKey: lovableKey,
        textModel: "openai/gpt-5.6-luna",
        visionModel: "openai/gpt-5.6-luna",
        utilityModel: "openai/gpt-5.6-luna",
        extraBody: { reasoning_effort: "none" },
      };
    default:
      return null;
  }
}

function configuredOrder(): ProviderId[] {
  const raw = env("OMNIROUTE_PROVIDER_ORDER");
  if (!raw) return DEFAULT_ORDER;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ProviderId => DEFAULT_ORDER.includes(s as ProviderId));
  // Gemini stays the default primary provider unless explicitly reordered.
  return ids.length > 0 ? ids : DEFAULT_ORDER;
}

/** All providers that currently have credentials, in priority order. */
export function availableProviders(): ProviderConfig[] {
  return configuredOrder()
    .map(buildProvider)
    .filter((p): p is ProviderConfig => p !== null);
}

export function getProvider(id: string): ProviderConfig | null {
  return availableProviders().find((p) => p.id === id) ?? null;
}
