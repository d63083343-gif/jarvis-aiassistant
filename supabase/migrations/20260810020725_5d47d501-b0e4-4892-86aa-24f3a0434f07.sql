CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.user_files(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own knowledge" ON public.knowledge_chunks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX knowledge_chunks_user_idx ON public.knowledge_chunks (user_id, created_at DESC);
CREATE INDEX knowledge_chunks_embedding_idx
  ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count integer DEFAULT 5,
  similarity_threshold double precision DEFAULT 0.2
)
RETURNS TABLE (
  id uuid,
  source_name text,
  content text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT k.id, k.source_name, k.content,
         1 - (k.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks k
  WHERE k.user_id = auth.uid()
    AND 1 - (k.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY k.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 20)
$$;

GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector, integer, double precision) TO authenticated;