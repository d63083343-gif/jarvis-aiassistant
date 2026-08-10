/**
 * RAG helpers (server-only): text extraction, cleaning, chunking and embeddings.
 *
 * Embeddings go through the Lovable AI Gateway (OpenAI-compatible /embeddings)
 * with LOVABLE_API_KEY, or a direct OpenAI key when OPENAI_API_KEY is set.
 * The chat completion itself is untouched — it still flows through OmniRoute.
 */

export const EMBEDDING_DIMS = 1536;
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/** Mime types / extensions we can safely extract text from in the Worker runtime. */
const TEXT_MIME = /^(text\/|application\/(json|xml|x-yaml|yaml|javascript|typescript|sql|csv))/i;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|ya?ml|xml|html?|log|sql|js|ts|tsx|jsx|py|java|c|cpp|rs|go|rb|php|css|ini|conf|env)$/i;

export function isTextLike(name: string, mime?: string | null): boolean {
  if (mime && TEXT_MIME.test(mime)) return true;
  return TEXT_EXT.test(name);
}

/** Strips markup/control characters and normalises whitespace. */
export function cleanText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits text into ~1200 char chunks on paragraph/sentence boundaries with overlap. */
export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = cleanText(text);
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const cut = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf("\n"),
      );
      if (cut > size * 0.5) end = start + cut + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.slice(0, 400);
}

type EmbedTarget = { url: string; key: string; model: string };

function embedTarget(): EmbedTarget | null {
  const lovable = process.env["LOVABLE_API_KEY"]?.trim();
  if (lovable) {
    return {
      url: "https://ai.gateway.lovable.dev/v1/embeddings",
      key: lovable,
      model: EMBEDDING_MODEL,
    };
  }
  const openai = process.env["OPENAI_API_KEY"]?.trim();
  if (openai) {
    return {
      url: "https://api.openai.com/v1/embeddings",
      key: openai,
      model: "text-embedding-3-small",
    };
  }
  return null;
}

export class EmbeddingUnavailableError extends Error {}

/** Embeds a batch of strings; returns vectors in input order. */
export async function embedTexts(inputs: string[]): Promise<number[][]> {
  const target = embedTarget();
  if (!target) throw new EmbeddingUnavailableError("No embedding provider configured");
  if (!inputs.length) return [];

  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += 64) {
    const batch = inputs.slice(i, i + 64);
    const res = await fetch(target.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${target.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: target.model,
        input: batch,
        dimensions: EMBEDDING_DIMS,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Embedding failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      data?: Array<{ index?: number; embedding: number[] }>;
    };
    const data = json.data ?? [];
    const sorted = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const row of sorted) out.push(row.embedding);
  }
  return out;
}

export async function embedQuery(query: string): Promise<number[] | null> {
  const trimmed = query.trim().slice(0, 4000);
  if (!trimmed) return null;
  const [vec] = await embedTexts([trimmed]);
  return vec ?? null;
}
