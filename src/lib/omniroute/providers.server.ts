/**
 * OmniRoute provider resolution.
 *
 * Providers are no longer hand-written here: they come from the vendored
 * OmniRoute catalog (`registry.ts`, extracted from the fork's
 * open-sse/config/providers/registry). A provider joins the routing chain as
 * soon as its API key is present in the environment, using OmniRoute's own
 * base URL, auth header, request format and model list.
 *
 * Env key convention (OmniRoute style): <PROVIDER_ID>_API_KEY, e.g.
 * GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, DEEPINFRA_API_KEY, ...
 * Model overrides: OMNIROUTE_MODEL_<ID>, OMNIROUTE_VISION_MODEL_<ID>,
 * OMNIROUTE_UTILITY_MODEL_<ID>. Ordering: OMNIROUTE_PROVIDER_ORDER (csv).
 *
 * Gemini Direct (GEMINI_API_KEY) is the default primary provider; the Lovable
 * AI Gateway remains available as a built-in, always-configured fallback so
 * existing behaviour never regresses.
 */

import {
  OMNIROUTE_REGISTRY,
  registryEntry,
  type OmniRegistryEntry,
} from "./registry";

export type ProviderConfig = {
  id: string;
  label: string;
  format: OmniRegistryEntry["format"];
  baseUrl: string;
  apiKey: string;
  authHeader: string;
  authPrefix?: string;
  headers?: Record<string, string>;
  chatPath?: string;
  urlSuffix?: string;
  modelIdPrefix?: string;
  timeoutMs?: number;
  /** Model used for text-only requests. */
  textModel: string;
  /** Model used when the conversation contains images. */
  visionModel: string;
  /** Fast/cheap model for utility calls (titles, classification). */
  utilityModel: string;
  extraBody?: Record<string, unknown>;
};

const env = (name: string): string => process.env[name]?.trim() ?? "";

const envSuffix = (id: string) => id.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();

/** Lovable AI Gateway entries — OpenAI-compatible, keyed by LOVABLE_API_KEY. */
const LOVABLE_ENTRIES: OmniRegistryEntry[] = [
  {
    id: "lovable-gemini",
    format: "openai",
    baseUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
    authHeader: "bearer",
    models: [
      { id: "google/gemini-3-flash-preview", name: "Gemini 3 Flash (Lovable)", supportsVision: true },
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash (Lovable)", supportsVision: true },
    ],
  },
  {
    id: "lovable-openai",
    format: "openai",
    baseUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
    authHeader: "bearer",
    models: [{ id: "openai/gpt-5.6-luna", name: "GPT-5.6 Luna (Lovable)", supportsVision: true }],
  },
];

const ALL_ENTRIES: OmniRegistryEntry[] = [...OMNIROUTE_REGISTRY, ...LOVABLE_ENTRIES];

const LABELS: Record<string, string> = {
  gemini: "Gemini (Google AI Studio)",
  "lovable-gemini": "Gemini (Lovable AI Gateway)",
  "lovable-openai": "OpenAI (Lovable AI Gateway)",
};

function apiKeyFor(entry: OmniRegistryEntry): string {
  if (entry.id.startsWith("lovable-")) return env("LOVABLE_API_KEY");
  return (
    env(`${envSuffix(entry.id)}_API_KEY`) ||
    (entry.alias ? env(`${envSuffix(entry.alias)}_API_KEY`) : "")
  );
}

const UTILITY_HINT = /(lite|mini|flash|small|instant|8b|7b|nano|turbo|haiku)/i;

/**
 * Sensible defaults for the providers JARVIS leans on, so the chain doesn't
 * pick a heavy preview model just because it sits first in the catalog.
 * Everything stays overridable through OMNIROUTE_MODEL_* env vars.
 */
const PREFERRED_MODELS: Record<string, { text?: string; vision?: string; utility?: string }> = {
  gemini: {
    text: "gemini-2.5-flash",
    vision: "gemini-2.5-flash",
    utility: "gemini-2.5-flash-lite",
  },
};

function pickModels(entry: OmniRegistryEntry) {
  const suffix = envSuffix(entry.id);
  const models = entry.models;
  const has = (id?: string) => (id && models.some((m) => m.id === id) ? id : undefined);
  const preferred = PREFERRED_MODELS[entry.id] ?? {};
  const text =
    env(`OMNIROUTE_MODEL_${suffix}`) || has(preferred.text) || models[0]?.id || "";
  const vision =
    env(`OMNIROUTE_VISION_MODEL_${suffix}`) ||
    has(preferred.vision) ||
    models.find((m) => m.supportsVision)?.id ||
    text;
  const utility =
    env(`OMNIROUTE_UTILITY_MODEL_${suffix}`) ||
    has(preferred.utility) ||
    models.find((m) => UTILITY_HINT.test(m.id))?.id ||
    text;
  return { text, vision, utility };
}


function toConfig(entry: OmniRegistryEntry): ProviderConfig | null {
  const apiKey = apiKeyFor(entry);
  if (!apiKey) return null;
  const { text, vision, utility } = pickModels(entry);
  if (!text) return null;
  return {
    id: entry.id,
    label: LABELS[entry.id] ?? entry.id,
    format: entry.format,
    baseUrl: entry.baseUrl,
    apiKey,
    authHeader: entry.authHeader,
    authPrefix: entry.authPrefix,
    headers: entry.headers,
    chatPath: entry.chatPath,
    urlSuffix: entry.urlSuffix,
    modelIdPrefix: entry.modelIdPrefix,
    timeoutMs: entry.timeoutMs,
    textModel: text,
    visionModel: vision,
    utilityModel: utility,
    extraBody: entry.id === "lovable-openai" ? { reasoning_effort: "none" } : undefined,
  };
}

/** Gemini Direct stays primary; the Lovable gateway is the guaranteed fallback. */
const PREFERRED_HEAD = ["gemini", "lovable-gemini", "openrouter", "groq", "openai"];
const PREFERRED_TAIL = ["lovable-openai"];

function orderedEntries(): OmniRegistryEntry[] {
  const byId = new Map(ALL_ENTRIES.map((e) => [e.id, e]));
  const raw = env("OMNIROUTE_PROVIDER_ORDER");
  if (raw) {
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const explicit = ids.map((id) => byId.get(id)).filter((e): e is OmniRegistryEntry => !!e);
    if (explicit.length) {
      const seen = new Set(explicit.map((e) => e.id));
      return [...explicit, ...ALL_ENTRIES.filter((e) => !seen.has(e.id))];
    }
  }
  const head = PREFERRED_HEAD.map((id) => byId.get(id)).filter(
    (e): e is OmniRegistryEntry => !!e,
  );
  const pinned = new Set([...PREFERRED_HEAD, ...PREFERRED_TAIL]);
  const rest = ALL_ENTRIES.filter((e) => !pinned.has(e.id));
  const tail = PREFERRED_TAIL.map((id) => byId.get(id)).filter(
    (e): e is OmniRegistryEntry => !!e,
  );
  return [...head, ...rest, ...tail];
}

/** All providers that currently have credentials, in priority order. */
export function availableProviders(): ProviderConfig[] {
  return orderedEntries()
    .map(toConfig)
    .filter((p): p is ProviderConfig => p !== null);
}

export function getProvider(id: string): ProviderConfig | null {
  return availableProviders().find((p) => p.id === id) ?? null;
}

/** Catalog size, for diagnostics (/api/ai-health). */
export function catalogStats() {
  return {
    providers: ALL_ENTRIES.length,
    models: ALL_ENTRIES.reduce((n, e) => n + e.models.length, 0),
  };
}

export { registryEntry };
