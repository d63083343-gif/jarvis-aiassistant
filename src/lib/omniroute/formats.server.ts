/**
 * OmniRoute format compatibility layer.
 *
 * OmniRoute normalises every conversation to the OpenAI chat shape and
 * translates it to the upstream's native protocol. This is the edge-safe
 * subset of that layer (adapted from open-sse/translator/{request,response}):
 * OpenAI-compatible, Gemini generateContent, and Anthropic messages — enough
 * to reach every provider in the vendored catalog without a Node runtime.
 */

import type { ProviderConfig } from "./providers.server";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentBlock[];
};

function blocks(content: ChatMessage["content"]): ContentBlock[] {
  return typeof content === "string" ? [{ type: "text", text: content }] : content;
}

function plainText(content: ChatMessage["content"]): string {
  return blocks(content)
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function splitDataUrl(url: string): { mimeType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(url);
  return m ? { mimeType: m[1], data: m[2] } : null;
}

function qualifiedModel(provider: ProviderConfig, model: string): string {
  const prefix = provider.modelIdPrefix;
  return prefix && !model.startsWith(prefix) ? `${prefix}${model}` : model;
}

function authHeaders(provider: ProviderConfig): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...(provider.headers ?? {}),
  };
  const name = provider.authHeader;
  const value = provider.apiKey;
  if (name === "bearer" || name.toLowerCase() === "authorization") {
    h["Authorization"] = `${provider.authPrefix ?? "Bearer"} ${value}`.trim();
  } else if (name.toLowerCase() === "key") {
    h["key"] = value;
  } else {
    h[name] = provider.authPrefix ? `${provider.authPrefix} ${value}` : value;
  }
  if (provider.format === "claude") h["anthropic-version"] = "2023-06-01";
  return h;
}

/** Endpoint URL for a chat completion, mirroring OmniRoute's urlBuilder rules. */
function endpoint(provider: ProviderConfig, model: string): string {
  const base = provider.baseUrl.replace(/\/$/, "");
  if (provider.format === "gemini") {
    return `${base}/${qualifiedModel(provider, model)}:generateContent`;
  }
  if (provider.format === "claude") {
    return /\/messages$/.test(base) ? base : `${base}/messages`;
  }
  if (provider.chatPath) return `${base}${provider.chatPath}`;
  if (/chat\/completions$/.test(base)) return base;
  return `${base}/chat/completions${provider.urlSuffix ?? ""}`;
}

function openAiBody(
  provider: ProviderConfig,
  model: string,
  messages: ChatMessage[],
): Record<string, unknown> {
  return {
    model: qualifiedModel(provider, model),
    messages,
    ...(provider.extraBody ?? {}),
  };
}

/** OpenAI chat → Gemini generateContent (translator/request/openai-to-gemini). */
function geminiBody(messages: ChatMessage[]): Record<string, unknown> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => plainText(m.content))
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: blocks(m.content).map((b) => {
        if (b.type === "text") return { text: b.text };
        const inline = splitDataUrl(b.image_url.url);
        return inline
          ? { inlineData: { mimeType: inline.mimeType, data: inline.data } }
          : { fileData: { fileUri: b.image_url.url } };
      }),
    }));
  return {
    contents,
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  };
}

/** OpenAI chat → Anthropic messages (translator/request/openai-to-claude). */
function claudeBody(model: string, messages: ChatMessage[]): Record<string, unknown> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => plainText(m.content))
    .join("\n\n");
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role,
      content: blocks(m.content).map((b) => {
        if (b.type === "text") return { type: "text", text: b.text };
        const inline = splitDataUrl(b.image_url.url);
        return inline
          ? {
              type: "image",
              source: { type: "base64", media_type: inline.mimeType, data: inline.data },
            }
          : { type: "image", source: { type: "url", url: b.image_url.url } };
      }),
    }));
  return {
    model,
    max_tokens: 1024,
    messages: rest,
    ...(system ? { system } : {}),
  };
}

/**
 * Delete params the model declares as unsupported — port of OmniRoute's
 * open-sse/handlers/chatCore/unsupportedParamsStrip.ts. The registry's
 * `unsupportedParams` is the authority (e.g. reasoning_effort on models that
 * 400 on it), so a fallback model never receives a param it rejects.
 */
export function stripUnsupportedParams(
  body: Record<string, unknown>,
  unsupported: readonly string[],
): { strippedParams: string[] } {
  const strippedParams: string[] = [];
  for (const param of unsupported) {
    if (Object.hasOwn(body, param)) {
      strippedParams.push(param);
      delete body[param];
    }
  }
  return { strippedParams };
}

export function buildRequest(
  provider: ProviderConfig,
  model: string,
  messages: ChatMessage[],
  options: { unsupportedParams?: readonly string[] } = {},
): { url: string; init: RequestInit; strippedParams: string[] } {
  const body =
    provider.format === "gemini"
      ? geminiBody(messages)
      : provider.format === "claude"
        ? claudeBody(qualifiedModel(provider, model), messages)
        : openAiBody(provider, model, messages);
  const { strippedParams } = stripUnsupportedParams(
    body as Record<string, unknown>,
    options.unsupportedParams ?? [],
  );
  return {
    url: endpoint(provider, model),
    init: {
      method: "POST",
      headers: authHeaders(provider),
      body: JSON.stringify(body),
    },
    strippedParams,
  };
}

/** Native response → plain assistant text (translator/response/*-to-openai). */
export function extractContent(provider: ProviderConfig, data: unknown): string {
  const d = data as Record<string, any>;
  if (provider.format === "gemini") {
    const parts = d?.candidates?.[0]?.content?.parts ?? [];
    return parts
      .filter((p: any) => typeof p?.text === "string" && !p.thought)
      .map((p: any) => p.text)
      .join("");
  }
  if (provider.format === "claude") {
    const content = d?.content ?? [];
    return Array.isArray(content)
      ? content
          .filter((c: any) => c?.type === "text")
          .map((c: any) => c.text)
          .join("")
      : "";
  }
  const message = d?.choices?.[0]?.message;
  if (typeof message?.content === "string") return message.content;
  if (Array.isArray(message?.content)) {
    return message.content
      .map((c: any) => (typeof c === "string" ? c : (c?.text ?? "")))
      .join("");
  }
  return "";
}
