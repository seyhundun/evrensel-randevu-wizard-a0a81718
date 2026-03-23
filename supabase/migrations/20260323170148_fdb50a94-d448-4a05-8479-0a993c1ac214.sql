CREATE TABLE public.link_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  page_title TEXT,
  page_content TEXT,
  ai_answer TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.link_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to link_analyses" ON public.link_analyses
  FOR ALL TO public USING (true) WITH CHECK (true);
