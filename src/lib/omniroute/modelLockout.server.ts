/**
 * Per-model lockout — adapted from OmniRoute's accountFallback model-lockout
 * store (open-sse/services/accountFallback.ts: lockModel /
 * recordModelLockoutFailure / clearModelLock / getAllModelLockouts).
 *
 * Provider-level circuit breaking lives in health.server; this is the finer
 * grain OmniRoute also uses: a single model on an otherwise healthy provider
 * (quota per model, model not enabled on the key) is locked out so routing
 * tries the next model on the SAME provider before abandoning the provider.
 * In-memory only — the upstream SQLite persistence has no edge equivalent.
 */

export type ModelLockout = {
  provider: string;
  model: string;
  reason: string;
  until: number;
  failureCount: number;
};

const lockouts = new Map<string, ModelLockout>();
const failures = new Map<string, number>();

const MAX_ENTRIES = 500;
const BASE_COOLDOWN_MS = 60_000;
const MAX_BACKOFF_LEVEL = 4;
const MAX_COOLDOWN_MS = 60 * 60_000;

const key = (provider: string, model: string) => `${provider}::${model}`;

function evictOverflow(): void {
  while (lockouts.size > MAX_ENTRIES) {
    const oldest = lockouts.keys().next().value;
    if (oldest === undefined) break;
    lockouts.delete(oldest);
  }
}

/** Upstream getScaledCooldown: base * 2^(failures-1), capped. */
function scaledCooldown(base: number, failureCount: number): number {
  const exponent = Math.min(Math.max(0, failureCount - 1), MAX_BACKOFF_LEVEL);
  return Math.min(base * 2 ** exponent, MAX_COOLDOWN_MS);
}

/** Upstream selectLockoutCooldownMs: an explicit Retry-After wins when longer. */
export function selectLockoutCooldownMs(parsedCooldownMs: number, baseCooldownMs: number): number {
  return parsedCooldownMs > baseCooldownMs ? parsedCooldownMs : 0;
}

export function lockModel(
  provider: string,
  model: string,
  reason: string,
  cooldownMs: number,
  now = Date.now(),
): void {
  const k = key(provider, model);
  const failureCount = (failures.get(k) ?? 0) + 1;
  failures.set(k, failureCount);
  const explicit = selectLockoutCooldownMs(cooldownMs, BASE_COOLDOWN_MS);
  const duration = explicit || scaledCooldown(BASE_COOLDOWN_MS, failureCount);
  lockouts.set(k, {
    provider,
    model,
    reason,
    until: now + Math.min(duration, MAX_COOLDOWN_MS),
    failureCount,
  });
  evictOverflow();
}

export function isModelLocked(provider: string, model: string, now = Date.now()): boolean {
  const entry = lockouts.get(key(provider, model));
  if (!entry) return false;
  if (now >= entry.until) {
    lockouts.delete(key(provider, model));
    return false;
  }
  return true;
}

export function clearModelLock(provider: string, model: string): void {
  const k = key(provider, model);
  lockouts.delete(k);
  failures.delete(k);
}

export function modelLockouts(now = Date.now()): ModelLockout[] {
  return [...lockouts.values()]
    .filter((e) => now < e.until)
    .map((e) => ({ ...e, remainingMs: e.until - now }) as ModelLockout);
}

export function resetModelLockouts(): void {
  lockouts.clear();
  failures.clear();
}
