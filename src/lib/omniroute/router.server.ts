/**
 * OmniRoute router — provider routing, automatic fallback, and recovery.
 *
 * Adapted from OmniRoute's routing pipeline: the fallback chain comes from
 * fallbackPolicy, retry/cooldown handling is a trimmed port of
 * src/sse/services/cooldownAwareRetry.ts (Retry-After aware, budget capped),
 * and provider health/circuit-breaking lives in health.server.
 *
 * Behaviour: try the healthiest primary provider (Gemini by default). On quota
 * (402/429), unavailability (5xx), timeout, or a network error, move to the next
 * configured provider so the conversation continues without interruption.
 * Providers that keep failing are put in cooldown and skipped until they
 * recover via a single half-open probe.
 */

import {
  canUseProvider,
  markCooldown,
  recordFailure,
  recordSuccess,
} from "./health.server";
import { registerFallback, resolveFallbackChain } from "./fallbackPolicy";
import {
  availableProviders,
  markKeyFailure,
  markKeySuccess,
  nextApiKey,
  type ProviderConfig,
} from "./providers.server";
import { buildRequest, extractContent } from "./formats.server";
import { candidateModels, type ModelCandidate } from "./capabilities.server";
import { classifyFailure, isEmptyContentResponse } from "./errorSignals.server";
import { lockModel } from "./modelLockout.server";
import { fitToContextWindow } from "./context.server";
import { extractUsage, recordUsage, recordUsageFailure, type Usage } from "./usage.server";
import type { ChatMessage, ContentBlock } from "./formats.server";

export type { ChatMessage, ContentBlock };


export type RouteOptions = {
  messages: ChatMessage[];
  /** Which model slot to use on each provider. */
  tier?: "text" | "vision" | "utility";
  /** Routing key for the fallback chain (defaults to "chat"). */
  routeKey?: string;
  signal?: AbortSignal | null;
  /** Per-request timeout per provider attempt. */
  timeoutMs?: number;
};

export type RouteResult = {
  content: string;
  provider: string;
  model: string;
  latencyMs: number;
  /** Provider-reported token usage, when the upstream returns it. */
  usage?: Usage | null;
  /** True when the context had to be trimmed to fit the model window. */
  contextOptimized?: boolean;
  /** Params removed because the model declares them unsupported. */
  strippedParams?: string[];
  /** Providers that failed before this one succeeded. */
  attempts: Array<{ provider: string; status?: number; error: string }>;
};

export class OmniRouteError extends Error {
  status: number;
  attempts: RouteResult["attempts"];
  constructor(message: string, status: number, attempts: RouteResult["attempts"]) {
    super(message);
    this.status = status;
    this.attempts = attempts;
  }
}

const MAX_RETRY_WAIT_MS = 2000;
const RETRY_BUDGET_MS = 4000;
const DEFAULT_TIMEOUT_MS = 45_000;
const UTILITY_TIMEOUT_MS = 12_000;

function parseRetryAfterMs(res: Response): number {
  const header = res.headers.get("retry-after");
  if (!header) return 0;
  const seconds = Number(header);
  const waitMs = Number.isFinite(seconds)
    ? seconds * 1000
    : Math.max(0, new Date(header).getTime() - Date.now());
  return Number.isFinite(waitMs) && waitMs > 0 ? waitMs : 0;
}

/** Retryable-on-same-provider only when the cooldown is short (OmniRoute policy). */
function retryWaitMs(retryAfterMs: number, budgetLeftMs: number): number {
  if (retryAfterMs <= 0) return 0;
  if (retryAfterMs > MAX_RETRY_WAIT_MS || retryAfterMs > budgetLeftMs) return 0;
  // Small jitter avoids synchronised retry storms across concurrent requests.
  return retryAfterMs + Math.floor(Math.random() * 150);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function shouldFallback(status: number): boolean {
  // Quota exhausted, rate limited, auth/config problems, or provider outage.
  return (
    status === 402 ||
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    status >= 500
  );
}

function pickModel(provider: ProviderConfig, tier: RouteOptions["tier"]): string {
  if (tier === "vision") return provider.visionModel;
  if (tier === "utility") return provider.utilityModel;
  return provider.textModel;
}

/**
 * Rebuild the chain from the current env-configured providers, then reorder so
 * healthy providers are tried first. Cooling-down providers are kept at the end
 * as a last resort instead of being dropped entirely, so a fully degraded chain
 * still attempts to answer.
 */
function ensureChain(routeKey: string): { primary: ProviderConfig[]; deferred: ProviderConfig[] } {
  const providers = availableProviders();
  registerFallback(
    routeKey,
    providers.map((p, i) => ({ provider: p.id, priority: i })),
  );
  const ordered = resolveFallbackChain(routeKey)
    .map((e) => providers.find((p) => p.id === e.provider))
    .filter((p): p is ProviderConfig => !!p);

  const primary: ProviderConfig[] = [];
  const deferred: ProviderConfig[] = [];
  for (const p of ordered) (canUseProvider(p.id) ? primary : deferred).push(p);
  return { primary, deferred };
}

function combineSignals(
  external: AbortSignal | null | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  external?.addEventListener("abort", onAbort);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", onAbort);
    },
    timedOut: () => timedOut,
  };
}

export async function routeChatCompletion(options: RouteOptions): Promise<RouteResult> {
  const routeKey = options.routeKey ?? "chat";
  const { primary, deferred } = ensureChain(routeKey);
  const chain = [...primary, ...deferred];
  const attempts: RouteResult["attempts"] = [];
  const tier = options.tier ?? "text";

  if (chain.length === 0) {
    throw new OmniRouteError("No AI provider configured", 500, attempts);
  }

  const timeoutMs =
    options.timeoutMs ?? (tier === "utility" ? UTILITY_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  let budgetLeftMs = RETRY_BUDGET_MS;

  for (const provider of chain) {
    // Capability-aware candidates: vision requests only reach vision models,
    // locked-out models are skipped, siblings act as in-provider fallbacks.
    const models: ModelCandidate[] = candidateModels(provider, tier);
    if (models.length === 0) {
      attempts.push({ provider: provider.id, error: `no ${tier}-capable model available` });
      continue;
    }

    for (const model of models) {
      // Context-window awareness: fit the conversation to this model's window.
      let fitted = fitToContextWindow(options.messages, model.contextLength);
      let nextProvider = false;

      for (let attempt = 0; attempt < 2 && !nextProvider; attempt++) {
        const startedAt = Date.now();
        const { signal, cleanup, timedOut } = combineSignals(options.signal, timeoutMs);
        const apiKey = nextApiKey(provider);
        const withKey: ProviderConfig = { ...provider, apiKey };
        try {
          const { url, init, strippedParams } = buildRequest(withKey, model.id, fitted.messages, {
            unsupportedParams: model.unsupportedParams,
          });
          const res = await fetch(url, { ...init, signal });

          if (res.ok) {
            const payload = await res.json();
            const content = extractContent(provider, payload);
            const latencyMs = Date.now() - startedAt;

            if (!content.trim() || isEmptyContentResponse(payload)) {
              recordFailure(provider.id, { status: 200, error: "empty completion" });
              recordUsageFailure(provider.id);
              attempts.push({ provider: provider.id, status: 200, error: "empty completion" });
              break; // try the next model on this provider
            }

            const usage = extractUsage(provider.format, payload);
            markKeySuccess(provider, apiKey);
            recordSuccess(provider.id, latencyMs);
            recordUsage({
              provider: provider.id,
              model: model.id,
              latencyMs,
              usage,
              contextOptimized: fitted.optimized,
              strippedParams,
            });
            return {
              content,
              provider: provider.id,
              model: model.id,
              latencyMs,
              usage,
              contextOptimized: fitted.optimized,
              strippedParams,
              attempts,
            };
          }

          const detail = (await res.text()).slice(0, 500);
          const retryAfterMs = parseRetryAfterMs(res);
          const verdict = classifyFailure(res.status, detail);

          // Short Retry-After → wait and retry the same model (OmniRoute policy).
          const wait = retryWaitMs(retryAfterMs, budgetLeftMs);
          if (wait > 0 && attempt === 0) {
            budgetLeftMs -= wait;
            await sleep(wait);
            continue;
          }

          // Context overflow → shrink harder and retry the same model once.
          if (verdict.kind === "context_overflow" && attempt === 0) {
            const tighter = Math.floor(((model.contextLength ?? 32_000) * 2) / 3);
            fitted = fitToContextWindow(fitted.messages, tighter);
            attempts.push({ provider: provider.id, status: res.status, error: detail });
            continue;
          }

          recordUsageFailure(provider.id);
          attempts.push({ provider: provider.id, status: res.status, error: detail });
          console.warn(
            `[omniroute] ${provider.id}/${model.id} failed (${res.status}, ${verdict.kind}); ${
              verdict.scope === "model" ? "trying next model" : "falling back"
            }. ${detail}`,
          );

          if (verdict.kind === "auth_error") markKeyFailure(provider, apiKey);

          if (verdict.scope === "model") {
            // Model-scoped: lock only this model, keep the provider healthy.
            lockModel(provider.id, model.id, verdict.kind, verdict.cooldownMs);
            break;
          }

          recordFailure(provider.id, { status: res.status, error: detail, retryAfterMs });
          if (verdict.cooldownMs > 0) markCooldown(provider.id, verdict.cooldownMs);
          else if (retryAfterMs > MAX_RETRY_WAIT_MS) markCooldown(provider.id, retryAfterMs);

          if (!verdict.fallback && !shouldFallback(res.status)) {
            throw new OmniRouteError(detail || res.statusText, res.status, attempts);
          }
          nextProvider = true;
        } catch (err) {
          if (err instanceof OmniRouteError) throw err;
          if (options.signal?.aborted) throw err;
          const message = timedOut()
            ? `timeout after ${timeoutMs}ms`
            : err instanceof Error
              ? err.message
              : String(err);
          recordFailure(provider.id, { error: message });
          recordUsageFailure(provider.id);
          attempts.push({ provider: provider.id, error: message });
          console.warn(`[omniroute] ${provider.id} unavailable; falling back. ${message}`);
          nextProvider = true;
        } finally {
          cleanup();
        }
      }

      if (nextProvider) break;
    }
  }

  throw new OmniRouteError(
    "All AI providers are unavailable",
    attempts.at(-1)?.status ?? 503,
    attempts,
  );
}

/**
 * Lightweight health check: one tiny utility-tier completion per configured
 * provider, run in parallel. Used by the /api/ai-health diagnostics route.
 */
export async function checkProviders(timeoutMs = 8000) {
  const providers = availableProviders();
  return Promise.all(
    providers.map(async (provider) => {
      const startedAt = Date.now();
      const { signal, cleanup, timedOut } = combineSignals(null, timeoutMs);
      try {
        const { url, init } = buildRequest(provider, provider.utilityModel, [
          { role: "user", content: "ping" },
        ]);
        const res = await fetch(url, { ...init, signal });

        const latencyMs = Date.now() - startedAt;
        if (res.ok) {
          recordSuccess(provider.id, latencyMs);
          return { provider: provider.id, label: provider.label, ok: true, latencyMs };
        }
        const detail = (await res.text()).slice(0, 200);
        recordFailure(provider.id, { status: res.status, error: detail });
        return {
          provider: provider.id,
          label: provider.label,
          ok: false,
          status: res.status,
          error: detail,
          latencyMs,
        };
      } catch (err) {
        const error = timedOut()
          ? `timeout after ${timeoutMs}ms`
          : err instanceof Error
            ? err.message
            : String(err);
        recordFailure(provider.id, { error });
        return { provider: provider.id, label: provider.label, ok: false, error };
      } finally {
        cleanup();
      }
    }),
  );
}
