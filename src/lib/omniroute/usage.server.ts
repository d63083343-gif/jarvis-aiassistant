/**
 * Token-usage extraction + per-provider analytics.
 *
 * `extractUsage` is a port of OmniRoute's open-sse/handlers/usageExtractor.ts
 * (OpenAI, Claude, Gemini usage shapes). The analytics store is the edge-safe
 * equivalent of OmniRoute's call-log aggregation: real, measured data only —
 * tokens the provider itself reported, and latencies this process observed.
 * No pricing is invented; cost is only reported when a provider returns it.
 */

export type Usage = {
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens?: number;
  reasoning_tokens?: number;
  cost_usd?: number;
};

export function extractUsage(format: string, responseBody: unknown): Usage | null {
  if (!responseBody || typeof responseBody !== "object") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = responseBody as Record<string, any>;
  const usage = body.usage ?? body.usageMetadata ?? body.response?.usage;
  if (!usage || typeof usage !== "object") return null;

  // OpenAI chat-completions shape
  if (usage.prompt_tokens !== undefined || usage.completion_tokens !== undefined) {
    const out: Usage = {
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
    };
    const cached =
      usage.prompt_tokens_details?.cached_tokens ??
      usage.prompt_cache_hit_tokens ??
      usage.cached_tokens;
    if (typeof cached === "number") out.cached_tokens = cached;
    const reasoning =
      usage.completion_tokens_details?.reasoning_tokens ?? usage.reasoning_tokens;
    if (typeof reasoning === "number") out.reasoning_tokens = reasoning;
    if (typeof usage.cost_in_usd_ticks === "number" && usage.cost_in_usd_ticks >= 0) {
      out.cost_usd = usage.cost_in_usd_ticks / 1_000_000;
    }
    return out;
  }

  // Anthropic messages shape
  if (usage.input_tokens !== undefined || usage.output_tokens !== undefined) {
    const cacheRead = usage.cache_read_input_tokens || 0;
    const cacheCreation = usage.cache_creation_input_tokens || 0;
    return {
      prompt_tokens: (usage.input_tokens || 0) + cacheRead + cacheCreation,
      completion_tokens: usage.output_tokens || 0,
      ...(cacheRead ? { cached_tokens: cacheRead } : {}),
    };
  }

  // Gemini generateContent shape
  if (usage.promptTokenCount !== undefined || usage.candidatesTokenCount !== undefined) {
    const out: Usage = {
      prompt_tokens: usage.promptTokenCount || 0,
      completion_tokens: usage.candidatesTokenCount || 0,
    };
    if (typeof usage.cachedContentTokenCount === "number") {
      out.cached_tokens = usage.cachedContentTokenCount;
    }
    if (typeof usage.thoughtsTokenCount === "number") {
      out.reasoning_tokens = usage.thoughtsTokenCount;
    }
    return out;
  }

  void format;
  return null;
}

export type ProviderUsageStats = {
  provider: string;
  model?: string;
  requests: number;
  failures: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  costUsd?: number;
  avgLatencyMs: number;
  lastLatencyMs?: number;
  contextOptimizedRequests: number;
  strippedParams: string[];
};

const stats = new Map<string, ProviderUsageStats>();

function bucket(provider: string): ProviderUsageStats {
  let s = stats.get(provider);
  if (!s) {
    s = {
      provider,
      requests: 0,
      failures: 0,
      promptTokens: 0,
      completionTokens: 0,
      cachedTokens: 0,
      reasoningTokens: 0,
      avgLatencyMs: 0,
      contextOptimizedRequests: 0,
      strippedParams: [],
    };
    stats.set(provider, s);
  }
  return s;
}

export function recordUsage(input: {
  provider: string;
  model: string;
  latencyMs: number;
  usage?: Usage | null;
  contextOptimized?: boolean;
  strippedParams?: string[];
}): void {
  const s = bucket(input.provider);
  s.model = input.model;
  s.requests += 1;
  s.avgLatencyMs = Math.round(
    (s.avgLatencyMs * (s.requests - 1) + input.latencyMs) / s.requests,
  );
  s.lastLatencyMs = Math.round(input.latencyMs);
  if (input.contextOptimized) s.contextOptimizedRequests += 1;
  for (const p of input.strippedParams ?? []) {
    if (!s.strippedParams.includes(p)) s.strippedParams.push(p);
  }
  const u = input.usage;
  if (u) {
    s.promptTokens += u.prompt_tokens || 0;
    s.completionTokens += u.completion_tokens || 0;
    s.cachedTokens += u.cached_tokens || 0;
    s.reasoningTokens += u.reasoning_tokens || 0;
    if (typeof u.cost_usd === "number") s.costUsd = (s.costUsd ?? 0) + u.cost_usd;
  }
}

export function recordUsageFailure(provider: string): void {
  bucket(provider).failures += 1;
}

export function usageSnapshot(): ProviderUsageStats[] {
  return [...stats.values()];
}

export function resetUsage(): void {
  stats.clear();
}
