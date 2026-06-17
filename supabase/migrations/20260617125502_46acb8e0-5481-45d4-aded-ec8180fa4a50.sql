
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.document_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('invoice','expense','business_card','project')),
  ref_id uuid NOT NULL,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, ref_id)
);

GRANT SELECT ON public.document_embeddings TO authenticated;
GRANT ALL ON public.document_embeddings TO service_role;

ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own embeddings"
  ON public.document_embeddings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX document_embeddings_user_idx ON public.document_embeddings (user_id);
CREATE INDEX document_embeddings_vec_idx
  ON public.document_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_document_embeddings(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int DEFAULT 10,
  filter_kinds text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  kind text,
  ref_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    d.id, d.kind, d.ref_id, d.content, d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.document_embeddings d
  WHERE d.user_id = match_user_id
    AND (filter_kinds IS NULL OR d.kind = ANY(filter_kinds))
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE TRIGGER document_embeddings_updated_at
  BEFORE UPDATE ON public.document_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
