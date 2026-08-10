/**
 * RAG server functions: ingest a stored document into the knowledge base and
 * retrieve the most relevant chunks for a query. Both run as the signed-in
 * user (RLS), so knowledge can never leak between accounts.
 *
 * Retrieval only builds *context*; the answer is still produced by the
 * existing OmniRoute → Gemini flow in /api/jarvis-chat.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FILES_BUCKET = "user-files";
const MAX_BYTES = 2 * 1024 * 1024;

export type RagChunk = { source: string; content: string; similarity: number };

/** Ingest a file already uploaded to the user's storage bucket. */
export const ingestKnowledgeFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileId: string }) => {
    if (!input?.fileId) throw new Error("fileId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isTextLike, chunkText, embedTexts } = await import("@/lib/rag.server");

    const { data: file, error: fileErr } = await supabase
      .from("user_files")
      .select("id, name, path, mime_type, size")
      .eq("id", data.fileId)
      .maybeSingle();
    if (fileErr || !file) return { ok: false, reason: "not_found", chunks: 0 };
    if (!isTextLike(file.name, file.mime_type)) {
      return { ok: false, reason: "unsupported", chunks: 0 };
    }
    if ((file.size ?? 0) > MAX_BYTES) return { ok: false, reason: "too_large", chunks: 0 };

    let text = "";
    try {
      const dl = await supabase.storage.from(FILES_BUCKET).download(file.path);
      if (dl.error || !dl.data) return { ok: false, reason: "download_failed", chunks: 0 };
      text = await dl.data.text();
    } catch {
      return { ok: false, reason: "unreadable", chunks: 0 };
    }

    const chunks = chunkText(text);
    if (!chunks.length) return { ok: false, reason: "empty", chunks: 0 };

    let vectors: number[][];
    try {
      vectors = await embedTexts(chunks);
    } catch {
      return { ok: false, reason: "embedding_failed", chunks: 0 };
    }
    if (vectors.length !== chunks.length) {
      return { ok: false, reason: "embedding_failed", chunks: 0 };
    }

    // Re-ingestion replaces previous chunks for the same file.
    await supabase.from("knowledge_chunks").delete().eq("file_id", file.id);

    const rows = chunks.map((content, i) => ({
      user_id: userId,
      file_id: file.id,
      source_name: file.name,
      chunk_index: i,
      content,
      embedding: JSON.stringify(vectors[i]),
    }));

    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from("knowledge_chunks").insert(rows.slice(i, i + 100));
      if (error) return { ok: false, reason: "store_failed", chunks: i };
    }
    return { ok: true, reason: "ingested", chunks: rows.length };
  });

/** Top-k relevant knowledge for a query, scoped to the signed-in user. */
export const retrieveKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string; topK?: number }) => ({
    query: String(input?.query ?? ""),
    topK: Math.min(Math.max(input?.topK ?? 5, 1), 10),
  }))
  .handler(async ({ data, context }): Promise<{ chunks: RagChunk[] }> => {
    const query = data.query.trim();
    if (!query) return { chunks: [] };
    try {
      // Cheap guard: skip the embedding call when the user has no knowledge yet.
      const { count } = await context.supabase
        .from("knowledge_chunks")
        .select("id", { count: "exact", head: true });
      if (!count) return { chunks: [] };

      const { embedQuery } = await import("@/lib/rag.server");
      const vector = await embedQuery(query);
      if (!vector) return { chunks: [] };

      const { data: matches, error } = await context.supabase.rpc("match_knowledge_chunks", {
        query_embedding: JSON.stringify(vector),
        match_count: data.topK,
        similarity_threshold: 0.25,
      });
      if (error || !matches) return { chunks: [] };

      return {
        chunks: (matches as Array<{ source_name: string; content: string; similarity: number }>)
          .map((m) => ({
            source: m.source_name,
            content: m.content.slice(0, 1500),
            similarity: m.similarity,
          }))
          .slice(0, data.topK),
      };
    } catch {
      // Retrieval must never break a normal JARVIS answer.
      return { chunks: [] };
    }
  });

/** Number of indexed chunks for the signed-in user. */
export const knowledgeStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await context.supabase
      .from("knowledge_chunks")
      .select("id", { count: "exact", head: true });
    return { chunks: count ?? 0 };
  });
