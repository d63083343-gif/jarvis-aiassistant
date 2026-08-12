/**
 * Capability-aware model selection.
 *
 * OmniRoute routes on the registry's declared model capabilities
 * (supportsVision / toolCalling / contextLength / unsupportedParams) rather
 * than on a single hardcoded model per provider. This module turns the
 * vendored catalog metadata into an ordered candidate list per request tier so
 * routing can try another model on the same provider before failing over, and
 * so a vision request never lands on a text-only model.
 */

import type { OmniModel } from "./registry";
import type { ProviderConfig } from "./providers.server";
import { isModelLocked } from "./modelLockout.server";

export type Tier = "text" | "vision" | "utility";

export type ModelCandidate = {
  id: string;
  contextLength?: number;
  supportsVision?: boolean;
  toolCalling?: boolean;
  unsupportedParams: string[];
};

function toCandidate(m: OmniModel, fallbackContext?: number): ModelCandidate {
  return {
    id: m.id,
    contextLength: m.contextLength ?? fallbackContext,
    supportsVision: m.supportsVision,
    toolCalling: m.toolCalling,
    unsupportedParams: m.unsupportedParams ?? [],
  };
}

export function modelMeta(provider: ProviderConfig, modelId: string): ModelCandidate {
  const found = provider.models.find((m) => m.id === modelId);
  return found
    ? toCandidate(found, provider.defaultContextLength)
    : { id: modelId, contextLength: provider.defaultContextLength, unsupportedParams: [] };
}

/**
 * Ordered models to try on a provider for a tier. The configured/preferred
 * model comes first; capability-compatible siblings follow as in-provider
 * fallbacks. Locked-out models are filtered out.
 */
export function candidateModels(
  provider: ProviderConfig,
  tier: Tier,
  requireTools = false,
): ModelCandidate[] {
  const preferred =
    tier === "vision" ? provider.visionModel : tier === "utility" ? provider.utilityModel : provider.textModel;

  const all = provider.models.map((m) => toCandidate(m, provider.defaultContextLength));
  let pool = all;
  if (tier === "vision") pool = pool.filter((m) => m.supportsVision);
  if (requireTools) pool = pool.filter((m) => m.toolCalling !== false);

  const head = pool.filter((m) => m.id === preferred);
  // Preferred model may be an env override that isn't in the catalog.
  if (head.length === 0 && preferred && tier !== "vision") {
    head.push(modelMeta(provider, preferred));
  }
  const rest = pool.filter((m) => m.id !== preferred).slice(0, 2);
  return [...head, ...rest].filter((m) => !isModelLocked(provider.id, m.id));
}
