/**
 * Context-window awareness + context optimisation.
 *
 * `smartTruncate` is a verbatim port of OmniRoute's RTK truncation engine
 * (open-sse/services/compression/engines/rtk/smartTruncate.ts) — pure text, no
 * Node dependencies. `fitToContextWindow` applies OmniRoute's context-limit
 * semantics (registry contextLength, minus a reply reserve) to a chat history:
 * the system prompt and the most recent turns are always preserved, oversized
 * individual messages are RTK-truncated, and the oldest turns are dropped last.
 */

import type { ChatMessage, ContentBlock } from "./formats.server";

export interface SmartTruncateOptions {
  maxLines?: number;
  maxChars?: number;
  preserveHead?: number;
  preserveTail?: number;
  priorityPatterns?: RegExp[];
}

export function smartTruncate(
  text: string,
  options: SmartTruncateOptions = {},
): { text: string; truncated: boolean; droppedLines: number } {
  const maxChars = Math.max(0, Math.floor(options.maxChars ?? 0));
  const maxLines = Math.max(0, Math.floor(options.maxLines ?? 0));
  const lines = text.split(/\r?\n/);
  const overLineLimit = maxLines > 0 && lines.length > maxLines;
  const overCharLimit = maxChars > 0 && text.length > maxChars;
  if (!overLineLimit && !overCharLimit) {
    return { text, truncated: false, droppedLines: 0 };
  }

  const preserveHead = Math.max(0, Math.floor(options.preserveHead ?? 20));
  const preserveTail = Math.max(0, Math.floor(options.preserveTail ?? 20));
  const priorityPatterns = options.priorityPatterns ?? [];
  const priorityLines = priorityPatterns.length
    ? lines.filter((line) => priorityPatterns.some((pattern) => pattern.test(line)))
    : [];

  const head = lines.slice(0, preserveHead);
  const tail = preserveTail > 0 ? lines.slice(-preserveTail) : [];
  const selected = [...head];
  for (const line of priorityLines) {
    if (!selected.includes(line)) selected.push(line);
  }
  const tailStart = lines.length - tail.length;
  tail.forEach((line, offset) => {
    const originalIndex = tailStart + offset;
    if (originalIndex >= preserveHead && !selected.includes(line)) selected.push(line);
  });

  const droppedLines = Math.max(0, lines.length - selected.length);
  let result = [
    ...selected.slice(0, head.length),
    `[rtk:truncated ${droppedLines} lines]`,
    ...selected.slice(head.length),
  ].join("\n");

  if (maxChars > 0 && result.length > maxChars) {
    const marker = "\n[rtk:truncated by chars]\n";
    const budget = Math.max(0, maxChars - marker.length);
    if (budget === 0) {
      result = marker.slice(0, maxChars);
      return { text: result, truncated: true, droppedLines };
    }
    const headChars = Math.ceil(budget * 0.55);
    const tailChars = Math.max(0, budget - headChars);
    const tailText = tailChars > 0 ? result.slice(-tailChars) : "";
    result = `${result.slice(0, headChars)}${marker}${tailText}`;
    if (result.length > maxChars) result = result.slice(0, maxChars);
  }

  return { text: result, truncated: true, droppedLines };
}

/** ~4 chars per token, OmniRoute's estimator heuristic. Images are flat-rated. */
const CHARS_PER_TOKEN = 4;
const IMAGE_TOKENS = 800;

function messageTokens(message: ChatMessage): number {
  if (typeof message.content === "string") {
    return Math.ceil(message.content.length / CHARS_PER_TOKEN);
  }
  return (message.content as ContentBlock[]).reduce((sum, block) => {
    if (block.type === "text") return sum + Math.ceil(block.text.length / CHARS_PER_TOKEN);
    return sum + IMAGE_TOKENS;
  }, 0);
}

export function estimateTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + messageTokens(m) + 4, 0);
}

function truncateMessage(message: ChatMessage, maxChars: number): ChatMessage {
  if (typeof message.content === "string") {
    return { ...message, content: smartTruncate(message.content, { maxChars }).text };
  }
  const blocks = (message.content as ContentBlock[]).map((b) =>
    b.type === "text" ? { ...b, text: smartTruncate(b.text, { maxChars }).text } : b,
  );
  return { ...message, content: blocks };
}

export type FitResult = {
  messages: ChatMessage[];
  /** True when anything was dropped or truncated. */
  optimized: boolean;
  estimatedTokens: number;
  droppedMessages: number;
};

/**
 * Fit a conversation into a model's context window.
 * System messages are never dropped; the newest turn is never dropped.
 */
export function fitToContextWindow(
  messages: ChatMessage[],
  contextLength: number | undefined,
  replyReserveTokens = 1024,
): FitResult {
  const limit = contextLength && contextLength > 0 ? contextLength : 32_000;
  const budget = Math.max(2000, limit - replyReserveTokens);
  let working = [...messages];
  let dropped = 0;

  if (estimateTokens(working) <= budget) {
    return {
      messages: working,
      optimized: false,
      estimatedTokens: estimateTokens(working),
      droppedMessages: 0,
    };
  }

  // 1. RTK-truncate oversized single messages (long RAG blocks, pasted docs).
  const perMessageChars = Math.max(2000, Math.floor((budget * CHARS_PER_TOKEN) / 3));
  working = working.map((m) =>
    messageTokens(m) * CHARS_PER_TOKEN > perMessageChars
      ? truncateMessage(m, perMessageChars)
      : m,
  );

  // 2. Drop the oldest non-system turns until the request fits.
  while (estimateTokens(working) > budget) {
    const index = working.findIndex((m, i) => m.role !== "system" && i < working.length - 1);
    if (index === -1) break;
    working.splice(index, 1);
    dropped += 1;
  }

  return {
    messages: working,
    optimized: true,
    estimatedTokens: estimateTokens(working),
    droppedMessages: dropped,
  };
}
