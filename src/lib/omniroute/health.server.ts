/**
 * Provider health tracking — circuit breaker + cooldown, adapted from
 * OmniRoute's domain state / cooldown handling (SQLite-free, edge-safe).
 *
 * Purpose: stop wasting request latency on providers that are known-bad.
 * A provider that fails repeatedly is put in cooldown ("open" circuit) and is
 * skipped until the cooldown expires, at which point one probe request is
 * allowed through ("half-open"). Success closes the circuit and clears state.
 */

export type ProviderHealth = {
  provider: string;
  state: "closed" | "open" | "half-open";
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  lastError?: string;
  lastStatus?: number;
  cooldownUntil?: number;
  lastLatencyMs?: number;
};

type Entry = ProviderHealth & { probing: boolean };

const registry = new Map<string, Entry>();

/** Failures on the same provider before the circuit opens. */
const FAILURE_THRESHOLD = 2;
/** Base cooldown; doubles per extra failure up to the max. */
const BASE_COOLDOWN_MS = 15_000;
const MAX_COOLDOWN_MS = 5 * 60_000;

function entry(provider: string): Entry {
  let e = registry.get(provider);
  if (!e) {
    e = {
      provider,
      state: "closed",
      consecutiveFailures: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      probing: false,
    };
    registry.set(provider, e);
  }
  return e;
}

function cooldownFor(failures: number): number {
  const ms = BASE_COOLDOWN_MS * 2 ** Math.max(0, failures - FAILURE_THRESHOLD);
  return Math.min(ms, MAX_COOLDOWN_MS);
}

/**
 * Whether a request may be sent to this provider right now.
 * Returns true for closed circuits and for a single half-open probe.
 */
export function canUseProvider(provider: string, now = Date.now()): boolean {
  const e = registry.get(provider);
  if (!e) return true;
  if (e.state === "closed") return true;
  if (e.cooldownUntil && now < e.cooldownUntil) return false;
  // Cooldown elapsed → allow exactly one probe through.
  e.state = "half-open";
  e.probing = true;
  return true;
}

/** Explicit cooldown from a provider's Retry-After (e.g. long rate limits). */
export function markCooldown(provider: string, ms: number, now = Date.now()): void {
  if (!Number.isFinite(ms) || ms <= 0) return;
  const e = entry(provider);
  e.state = "open";
  e.cooldownUntil = Math.max(e.cooldownUntil ?? 0, now + Math.min(ms, MAX_COOLDOWN_MS));
}

export function recordSuccess(provider: string, latencyMs?: number): void {
  const e = entry(provider);
  e.state = "closed";
  e.consecutiveFailures = 0;
  e.totalSuccesses += 1;
  e.probing = false;
  e.cooldownUntil = undefined;
  e.lastError = undefined;
  e.lastStatus = undefined;
  if (typeof latencyMs === "number") e.lastLatencyMs = Math.round(latencyMs);
}

export function recordFailure(
  provider: string,
  info: { status?: number; error?: string; retryAfterMs?: number } = {},
  now = Date.now(),
): void {
  const e = entry(provider);
  e.consecutiveFailures += 1;
  e.totalFailures += 1;
  e.lastError = info.error;
  e.lastStatus = info.status;

  // A failed probe re-opens immediately.
  const shouldOpen = e.probing || e.consecutiveFailures >= FAILURE_THRESHOLD;
  e.probing = false;
  if (shouldOpen) {
    e.state = "open";
    const backoff = Math.max(cooldownFor(e.consecutiveFailures), info.retryAfterMs ?? 0);
    e.cooldownUntil = now + Math.min(backoff, MAX_COOLDOWN_MS);
  }
}

/** Health snapshot for diagnostics / health-check endpoints. */
export function healthSnapshot(now = Date.now()): ProviderHealth[] {
  return [...registry.values()].map(({ probing: _probing, ...h }) => ({
    ...h,
    state:
      h.state !== "closed" && h.cooldownUntil && now >= h.cooldownUntil ? "half-open" : h.state,
  }));
}

export function resetHealth(): void {
  registry.clear();
}
