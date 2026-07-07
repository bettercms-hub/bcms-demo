
-- Per-page SEO/AEO data
CREATE TABLE public.seo_page (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_slug TEXT NOT NULL,
  project_slug TEXT NOT NULL,
  page_id TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  slug TEXT,
  canonical TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  twitter_image TEXT,
  structured_data TEXT,
  indexing TEXT NOT NULL DEFAULT 'index',
  ai_summary TEXT,
  key_takeaways JSONB NOT NULL DEFAULT '[]'::jsonb,
  faqs JSONB NOT NULL DEFAULT '[]'::jsonb,
  entities JSONB NOT NULL DEFAULT '[]'::jsonb,
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  seo_score INT,
  aeo_score INT,
  aeo_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_slug, project_slug, page_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_page TO anon, authenticated;
GRANT ALL ON public.seo_page TO service_role;
ALTER TABLE public.seo_page ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_page open" ON public.seo_page FOR ALL USING (true) WITH CHECK (true);

-- Project-wide SEO settings (defaults, analytics ids, robots, schema)
CREATE TABLE public.seo_project_settings (
  workspace_slug TEXT NOT NULL,
  project_slug TEXT NOT NULL,
  default_title TEXT,
  default_description TEXT,
  default_og_image TEXT,
  default_twitter_handle TEXT,
  ga_id TEXT,
  plausible_domain TEXT,
  robots_txt TEXT,
  schema_jsonld TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_slug, project_slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_project_settings TO anon, authenticated;
GRANT ALL ON public.seo_project_settings TO service_role;
ALTER TABLE public.seo_project_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_project_settings open" ON public.seo_project_settings FOR ALL USING (true) WITH CHECK (true);

-- Redirects
CREATE TABLE public.seo_redirect (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_slug TEXT NOT NULL,
  project_slug TEXT NOT NULL,
  from_path TEXT NOT NULL,
  to_path TEXT NOT NULL,
  code INT NOT NULL DEFAULT 301,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_redirect TO anon, authenticated;
GRANT ALL ON public.seo_redirect TO service_role;
ALTER TABLE public.seo_redirect ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_redirect open" ON public.seo_redirect FOR ALL USING (true) WITH CHECK (true);

-- Tracked keywords
CREATE TABLE public.seo_keyword (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_slug TEXT NOT NULL,
  project_slug TEXT NOT NULL,
  term TEXT NOT NULL,
  rank INT,
  prev_rank INT,
  trend TEXT,
  traffic INT,
  difficulty INT,
  opportunity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_slug, project_slug, term)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_keyword TO anon, authenticated;
GRANT ALL ON public.seo_keyword TO service_role;
ALTER TABLE public.seo_keyword ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_keyword open" ON public.seo_keyword FOR ALL USING (true) WITH CHECK (true);

-- Integration connection state
CREATE TABLE public.seo_integration (
  workspace_slug TEXT NOT NULL,
  project_slug TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_slug, project_slug, provider_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_integration TO anon, authenticated;
GRANT ALL ON public.seo_integration TO service_role;
ALTER TABLE public.seo_integration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seo_integration open" ON public.seo_integration FOR ALL USING (true) WITH CHECK (true);

-- updated_at trigger reuses existing helper
CREATE TRIGGER seo_page_updated BEFORE UPDATE ON public.seo_page FOR EACH ROW EXECUTE FUNCTION public.forms_set_updated_at();
CREATE TRIGGER seo_project_settings_updated BEFORE UPDATE ON public.seo_project_settings FOR EACH ROW EXECUTE FUNCTION public.forms_set_updated_at();
CREATE TRIGGER seo_redirect_updated BEFORE UPDATE ON public.seo_redirect FOR EACH ROW EXECUTE FUNCTION public.forms_set_updated_at();
CREATE TRIGGER seo_keyword_updated BEFORE UPDATE ON public.seo_keyword FOR EACH ROW EXECUTE FUNCTION public.forms_set_updated_at();
CREATE TRIGGER seo_integration_updated BEFORE UPDATE ON public.seo_integration FOR EACH ROW EXECUTE FUNCTION public.forms_set_updated_at();
