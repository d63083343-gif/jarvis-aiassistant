/**
 * Fallback Policy — adapted from OmniRoute (src/domain/fallbackPolicy.ts).
 *
 * Declarative fallback chain for model routing. When a primary provider is
 * unavailable, the router resolves alternative providers in priority order.
 * The original OmniRoute version persists chains in SQLite; this edge-runtime
 * port keeps the same API with an in-memory store only.
 */

export type FallbackEntry = {
  provider: string;
  priority?: number;
  enabled?: boolean;
};

type ResolvedEntry = Required<FallbackEntry>;

const fallbackChains = new Map<string, ResolvedEntry[]>();

/** Register (or replace) a fallback chain for a routing key. */
export function registerFallback(key: string, chain: FallbackEntry[]): void {
  const sorted = [...chain]
    .map((e, i) => ({
      provider: e.provider,
      priority: e.priority ?? i,
      enabled: e.enabled ?? true,
    }))
    .sort((a, b) => a.priority - b.priority);
  fallbackChains.set(key, sorted);
}

/** Enabled providers for a key, in priority order, minus already-tried ones. */
export function resolveFallbackChain(
  key: string,
  excludeProviders: string[] = [],
): ResolvedEntry[] {
  const chain = fallbackChains.get(key);
  if (!chain) return [];
  const excluded = new Set(excludeProviders);
  return chain.filter((e) => e.enabled && !excluded.has(e.provider));
}

/** Next provider id for a key, or null when the chain is exhausted. */
export function getNextFallback(
  key: string,
  excludeProviders: string[] = [],
): string | null {
  const chain = resolveFallbackChain(key, excludeProviders);
  return chain.length > 0 ? chain[0].provider : null;
}

export function hasFallback(key: string): boolean {
  const chain = fallbackChains.get(key);
  return !!chain && chain.some((e) => e.enabled);
}

export function getAllFallbackChains(): Record<string, ResolvedEntry[]> {
  return Object.fromEntries(fallbackChains.entries());
}

export function resetAllFallbacks(): void {
  fallbackChains.clear();
}
