
-- PROJECT
CREATE TABLE public.project (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project TO authenticated;
GRANT ALL ON public.project TO service_role;
ALTER TABLE public.project ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view workspace projects"
  ON public.project FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members create workspace projects"
  ON public.project FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members update workspace projects"
  ON public.project FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Owners delete workspace projects"
  ON public.project FOR DELETE TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id));

CREATE TRIGGER project_set_updated_at BEFORE UPDATE ON public.project
  FOR EACH ROW EXECUTE FUNCTION public.workspace_set_updated_at();

-- MEDIA FOLDER
CREATE TABLE public.media_folder (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.project(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.media_folder(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_folder TO authenticated;
GRANT ALL ON public.media_folder TO service_role;
ALTER TABLE public.media_folder ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view media folders"
  ON public.media_folder FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project p WHERE p.id = project_id AND public.is_workspace_member(auth.uid(), p.workspace_id)));
CREATE POLICY "Members manage media folders"
  ON public.media_folder FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project p WHERE p.id = project_id AND public.is_workspace_member(auth.uid(), p.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.project p WHERE p.id = project_id AND public.is_workspace_member(auth.uid(), p.workspace_id)));

-- MEDIA ASSET
CREATE TABLE public.media_asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.project(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.media_folder(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  storage_path TEXT NOT NULL,
  thumb_path TEXT,
  alt_text TEXT,
  caption TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  favorite BOOLEAN NOT NULL DEFAULT false,
  optimized BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_asset TO authenticated;
GRANT ALL ON public.media_asset TO service_role;
ALTER TABLE public.media_asset ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view media assets"
  ON public.media_asset FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project p WHERE p.id = project_id AND public.is_workspace_member(auth.uid(), p.workspace_id)));
CREATE POLICY "Members manage media assets"
  ON public.media_asset FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.project p WHERE p.id = project_id AND public.is_workspace_member(auth.uid(), p.workspace_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.project p WHERE p.id = project_id AND public.is_workspace_member(auth.uid(), p.workspace_id)));

CREATE TRIGGER media_folder_set_updated_at BEFORE UPDATE ON public.media_folder
  FOR EACH ROW EXECUTE FUNCTION public.workspace_set_updated_at();
CREATE TRIGGER media_asset_set_updated_at BEFORE UPDATE ON public.media_asset
  FOR EACH ROW EXECUTE FUNCTION public.workspace_set_updated_at();

CREATE INDEX idx_project_workspace ON public.project(workspace_id);
CREATE INDEX idx_media_folder_project ON public.media_folder(project_id);
CREATE INDEX idx_media_asset_project ON public.media_asset(project_id);
CREATE INDEX idx_media_asset_folder ON public.media_asset(folder_id);
