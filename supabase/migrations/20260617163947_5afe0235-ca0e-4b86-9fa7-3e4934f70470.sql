
CREATE TABLE public.form (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_slug text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  submit_action jsonb NOT NULL DEFAULT '{"kind":"message","message":"Thanks! We received your submission."}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_slug, slug)
);

CREATE TABLE public.form_field_group (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id uuid NOT NULL REFERENCES public.form(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_field (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id uuid NOT NULL REFERENCES public.form(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.form_field_group(id) ON DELETE SET NULL,
  kind text NOT NULL,
  name text NOT NULL,
  label text NOT NULL,
  placeholder text,
  help_text text,
  required boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_submission (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id uuid NOT NULL REFERENCES public.form(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_page_id text,
  source_url text,
  user_agent text,
  ip_country text,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  spam_score numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','spam','archived')),
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_submission_note (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES public.form_submission(id) ON DELETE CASCADE,
  author text,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'note',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_integration (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id uuid NOT NULL REFERENCES public.form(id) ON DELETE CASCADE,
  kind text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.page_form_usage (
  page_id text NOT NULL,
  form_id uuid NOT NULL REFERENCES public.form(id) ON DELETE CASCADE,
  block_id text NOT NULL,
  project_slug text NOT NULL,
  PRIMARY KEY (page_id, block_id)
);

CREATE INDEX form_project_idx ON public.form(project_slug);
CREATE INDEX form_field_form_idx ON public.form_field(form_id, position);
CREATE INDEX form_submission_form_idx ON public.form_submission(form_id, submitted_at DESC);
CREATE INDEX form_integration_form_idx ON public.form_integration(form_id);
CREATE INDEX page_form_usage_form_idx ON public.page_form_usage(form_id);

-- Grants: prototype posture (no auth in app yet). Allow anon + authenticated.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_field_group TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_field TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_submission TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_submission_note TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_integration TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_form_usage TO anon, authenticated;
GRANT ALL ON public.form, public.form_field_group, public.form_field, public.form_submission, public.form_submission_note, public.form_integration, public.page_form_usage TO service_role;

ALTER TABLE public.form ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_field_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_field ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submission_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_integration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_form_usage ENABLE ROW LEVEL SECURITY;

-- Prototype policies: open access (no auth in app yet). Tighten when auth lands.
CREATE POLICY "forms open all" ON public.form FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "form_field_group open all" ON public.form_field_group FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "form_field open all" ON public.form_field FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "form_submission open all" ON public.form_submission FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "form_submission_note open all" ON public.form_submission_note FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "form_integration open all" ON public.form_integration FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "page_form_usage open all" ON public.page_form_usage FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.forms_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER form_set_updated_at BEFORE UPDATE ON public.form
  FOR EACH ROW EXECUTE FUNCTION public.forms_set_updated_at();
