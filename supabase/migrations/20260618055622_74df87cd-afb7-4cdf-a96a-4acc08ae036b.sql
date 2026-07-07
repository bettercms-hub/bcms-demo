
CREATE TABLE public.seo_page_version (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_slug TEXT NOT NULL,
  project_slug TEXT NOT NULL,
  page_id TEXT NOT NULL,
  version_num INT NOT NULL,
  label TEXT,
  author_ref TEXT,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_slug, project_slug, page_id, version_num)
);
CREATE INDEX seo_page_version_page_idx
  ON public.seo_page_version (workspace_slug, project_slug, page_id, version_num DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_page_version TO anon, authenticated;
GRANT ALL ON public.seo_page_version TO service_role;
ALTER TABLE public.seo_page_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_page_version open" ON public.seo_page_version
  FOR ALL USING (true) WITH CHECK (true);
