/**
 * Provider error classification — ported from OmniRoute
 * (open-sse/services/accountFallback.ts signal lists + errorClassifier.ts).
 *
 * The upstream lists are the single source of truth for deciding whether a
 * failure is transient (retry / fall back), model-scoped (lock that model and
 * try another model on the same provider), or account-scoped (cool the whole
 * provider down). Only the pure, runtime-independent parts are ported: the
 * upstream SQLite/connection bookkeeping has no equivalent here.
 */

export const ACCOUNT_DEACTIVATED_SIGNALS = [
  "account_deactivated",
  "account has been deactivated",
  "account has been disabled",
  "your account has been suspended",
  "this account is deactivated",
];

export const CREDITS_EXHAUSTED_SIGNALS = [
  "insufficient_quota",
  "billing_hard_limit_reached",
  "exceeded your current quota",
  "exceeded your current usage quota",
  "credit_balance_too_low",
  "your credit balance is too low",
  "credits exhausted",
  "out of credits",
  "payment required",
  "free tier of the model has been exhausted",
  "tier has been exhausted",
  "insufficient balance",
  "insufficient_balance",
  "insufficient account balance",
];

export const CONTEXT_OVERFLOW_PATTERNS = [
  /\binput is too long\b/i,
  /\binput too long\b/i,
  /\bcontext.*(too long|exceeded|overflow|limit)/i,
  /\btoo many tokens\b/i,
  /\bprompt is too long\b/i,
  /\bcontext window/i,
  /\bmaximum context/i,
  /\bmax.*token/i,
  /\btoken limit/i,
  /\brequest too large\b/i,
];

export const MODEL_ACCESS_DENIED_PATTERNS = [
  /\binvalid model\b/i,
  /\bmodel.*not.*(?:available|found|supported|accessible)\b/i,
  /\bmodel.*(?:does not exist|doesn't exist)\b/i,
  /\bunsupported\s+model\b/i,
  /\baccess.*denied.*model\b/i,
  /\bmodel.*access.*denied\b/i,
  /\bplease select a different model\b/i,
];

const MODEL_ACCESS_DENIED_CODES = new Set(["model_not_found", "deployment_not_found"]);
const MODEL_ACCESS_DENIED_TYPES = new Set(["not_found_error"]);

const AUTH_CREDENTIAL_ERROR_PATTERNS = [
  /\b(?:invalid|incorrect|expired|missing|revoked)\s+api[\s_-]?key\b/i,
  /\bapi[\s_-]?key\s+(?:is\s+)?(?:invalid|incorrect|expired|missing|revoked|not\s+valid)\b/i,
  /\bauthentication\s+(?:failed|error|required)\b/i,
  /\b(?:invalid|expired|missing|revoked)\s+(?:token|credentials?|bearer)\b/i,
  /\bnot\s+authenticated\b/i,
];

export const RATE_LIMIT_TEXT_PATTERNS = [
  /high.?frequency/i,
  /non-compliant/i,
  /too many requests/i,
  /rate.?limit/i,
  /频繁/,
  /频率/,
];

const lower = (t: string) => String(t ?? "").toLowerCase();

export function isAccountDeactivated(text: string): boolean {
  return ACCOUNT_DEACTIVATED_SIGNALS.some((s) => lower(text).includes(s));
}

export function isCreditsExhausted(text: string): boolean {
  return CREDITS_EXHAUSTED_SIGNALS.some((s) => lower(text).includes(s));
}

export function isContextOverflow(text: string): boolean {
  return CONTEXT_OVERFLOW_PATTERNS.some((p) => p.test(text ?? ""));
}

export function isAuthCredentialError(text: string): boolean {
  return AUTH_CREDENTIAL_ERROR_PATTERNS.some((p) => p.test(text ?? ""));
}

export function isRateLimitText(text: string): boolean {
  return RATE_LIMIT_TEXT_PATTERNS.some((p) => p.test(text ?? ""));
}

/** Structured code/type first (upstream order), then bounded regex fallback. */
export function isModelAccessDenied(text: string): boolean {
  const body = safeJson(text);
  const err = (body?.error ?? body) as Record<string, unknown> | undefined;
  const code = typeof err?.code === "string" ? err.code : "";
  const type = typeof err?.type === "string" ? err.type : "";
  if (MODEL_ACCESS_DENIED_CODES.has(code) || MODEL_ACCESS_DENIED_TYPES.has(type)) return true;
  if (isAuthCredentialError(text)) return false;
  return MODEL_ACCESS_DENIED_PATTERNS.some((p) => p.test(text ?? ""));
}

function safeJson(text: string): Record<string, any> | undefined {
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Empty-but-legitimate completions (errorClassifier.isEmptyContentResponse). */
const LEGIT_EMPTY_OPENAI_FINISH = new Set(["length", "tool_calls", "content_filter"]);
const LEGIT_EMPTY_CLAUDE_STOP = new Set(["max_tokens", "tool_use"]);

export function isEmptyContentResponse(responseBody: unknown): boolean {
  if (!responseBody || typeof responseBody !== "object") return false;
  const body = responseBody as Record<string, any>;

  if (Array.isArray(body.choices)) {
    const choice = body.choices[0];
    if (!choice) return true;
    if (LEGIT_EMPTY_OPENAI_FINISH.has(String(choice.finish_reason ?? ""))) return false;
    const content = choice.message?.content ?? choice.delta?.content;
    return content === null || content === undefined || content === "";
  }
  if (Array.isArray(body.content)) {
    if (body.content.length > 0) return false;
    return !LEGIT_EMPTY_CLAUDE_STOP.has(String(body.stop_reason ?? ""));
  }
  if (Array.isArray(body.candidates)) {
    const finish = String(body.candidates[0]?.finishReason ?? "");
    if (finish === "MAX_TOKENS" || finish === "SAFETY") return false;
  }
  return false;
}

export type FailureScope = "model" | "provider" | "request";

export type Classification = {
  kind:
    | "rate_limited"
    | "credits_exhausted"
    | "account_deactivated"
    | "model_access_denied"
    | "context_overflow"
    | "auth_error"
    | "server_error"
    | "network_error"
    | "empty_response"
    | "bad_request";
  scope: FailureScope;
  /** Whether routing should move on (next model / next provider). */
  fallback: boolean;
  /** Suggested cooldown for the failing scope, in ms (0 = use default backoff). */
  cooldownMs: number;
};

const MINUTE = 60_000;

/** Map an upstream HTTP failure onto OmniRoute's fallback semantics. */
export function classifyFailure(status: number | undefined, body: string): Classification {
  const text = body ?? "";

  if (status === 429 || (status === 400 && isRateLimitText(text))) {
    return { kind: "rate_limited", scope: "provider", fallback: true, cooldownMs: 0 };
  }
  if (status === 402 || isCreditsExhausted(text)) {
    return { kind: "credits_exhausted", scope: "provider", fallback: true, cooldownMs: 30 * MINUTE };
  }
  if (isAccountDeactivated(text)) {
    return {
      kind: "account_deactivated",
      scope: "provider",
      fallback: true,
      cooldownMs: 60 * MINUTE,
    };
  }
  if (isContextOverflow(text)) {
    return { kind: "context_overflow", scope: "request", fallback: true, cooldownMs: 0 };
  }
  if (status === 404 || isModelAccessDenied(text)) {
    return {
      kind: "model_access_denied",
      scope: "model",
      fallback: true,
      cooldownMs: 30 * MINUTE,
    };
  }
  if (status === 401 || status === 403 || isAuthCredentialError(text)) {
    return { kind: "auth_error", scope: "provider", fallback: true, cooldownMs: 10 * MINUTE };
  }
  if (status !== undefined && status >= 500) {
    return { kind: "server_error", scope: "provider", fallback: true, cooldownMs: 0 };
  }
  if (status === 408 || status === 409 || status === 425) {
    return { kind: "server_error", scope: "provider", fallback: true, cooldownMs: 0 };
  }
  return { kind: "bad_request", scope: "request", fallback: false, cooldownMs: 0 };
}
