
-- =========================================================
-- WORKSPACE
-- =========================================================
CREATE TABLE public.workspace (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  logo_url text,
  accent_color text,
  owner_user_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace TO anon, authenticated;
GRANT ALL ON public.workspace TO service_role;
ALTER TABLE public.workspace ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace open all" ON public.workspace FOR ALL USING (true) WITH CHECK (true);

-- =========================================================
-- WORKSPACE ROLE
-- workspace_id IS NULL => built-in role shared across all workspaces
-- capabilities jsonb shape:
-- {
--   content:    { view, edit, delete, publish },
--   collections:{ view, edit, schema, delete },
--   media:      { upload, delete, organize },
--   publishing: { draft, review, approve, publish },
--   settings:   { view, edit, domains, api, security, permissions }
-- }
-- =========================================================
CREATE TABLE public.workspace_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspace(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  is_builtin boolean NOT NULL DEFAULT false,
  color text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX workspace_role_builtin_key_uniq
  ON public.workspace_role(key) WHERE workspace_id IS NULL;
CREATE UNIQUE INDEX workspace_role_custom_key_uniq
  ON public.workspace_role(workspace_id, key) WHERE workspace_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_role TO anon, authenticated;
GRANT ALL ON public.workspace_role TO service_role;
ALTER TABLE public.workspace_role ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_role open all" ON public.workspace_role FOR ALL USING (true) WITH CHECK (true);

-- =========================================================
-- WORKSPACE MEMBER
-- =========================================================
CREATE TABLE public.workspace_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspace(id) ON DELETE CASCADE,
  user_ref text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  avatar_url text,
  role_id uuid REFERENCES public.workspace_role(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  last_active_at timestamptz,
  invited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_ref)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_member TO anon, authenticated;
GRANT ALL ON public.workspace_member TO service_role;
ALTER TABLE public.workspace_member ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_member open all" ON public.workspace_member FOR ALL USING (true) WITH CHECK (true);

-- =========================================================
-- WORKSPACE INVITATION
-- =========================================================
CREATE TABLE public.workspace_invitation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspace(id) ON DELETE CASCADE,
  email text NOT NULL,
  role_id uuid REFERENCES public.workspace_role(id) ON DELETE SET NULL,
  project_slugs text[] NOT NULL DEFAULT '{}',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  invited_by_user_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invitation TO anon, authenticated;
GRANT ALL ON public.workspace_invitation TO service_role;
ALTER TABLE public.workspace_invitation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_invitation open all" ON public.workspace_invitation FOR ALL USING (true) WITH CHECK (true);

-- =========================================================
-- PROJECT MEMBER ACCESS (per-project role override)
-- =========================================================
CREATE TABLE public.project_member_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspace(id) ON DELETE CASCADE,
  project_slug text NOT NULL,
  member_id uuid NOT NULL REFERENCES public.workspace_member(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.workspace_role(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_slug, member_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_member_access TO anon, authenticated;
GRANT ALL ON public.project_member_access TO service_role;
ALTER TABLE public.project_member_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_member_access open all" ON public.project_member_access FOR ALL USING (true) WITH CHECK (true);

-- =========================================================
-- updated_at trigger function (reuse existing if any)
-- =========================================================
CREATE OR REPLACE FUNCTION public.workspace_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_workspace_updated_at BEFORE UPDATE ON public.workspace
  FOR EACH ROW EXECUTE FUNCTION public.workspace_set_updated_at();
CREATE TRIGGER trg_workspace_role_updated_at BEFORE UPDATE ON public.workspace_role
  FOR EACH ROW EXECUTE FUNCTION public.workspace_set_updated_at();
CREATE TRIGGER trg_workspace_member_updated_at BEFORE UPDATE ON public.workspace_member
  FOR EACH ROW EXECUTE FUNCTION public.workspace_set_updated_at();
CREATE TRIGGER trg_workspace_invitation_updated_at BEFORE UPDATE ON public.workspace_invitation
  FOR EACH ROW EXECUTE FUNCTION public.workspace_set_updated_at();
CREATE TRIGGER trg_project_member_access_updated_at BEFORE UPDATE ON public.project_member_access
  FOR EACH ROW EXECUTE FUNCTION public.workspace_set_updated_at();

-- =========================================================
-- SEED BUILT-IN ROLES (workspace_id = null, shared)
-- =========================================================
INSERT INTO public.workspace_role (workspace_id, key, name, description, is_builtin, color, capabilities) VALUES
(NULL, 'owner', 'Workspace Owner', 'Full access to everything including billing, members, and workspace deletion.', true, 'amber',
 '{"content":{"view":true,"edit":true,"delete":true,"publish":true},"collections":{"view":true,"edit":true,"schema":true,"delete":true},"media":{"upload":true,"delete":true,"organize":true},"publishing":{"draft":true,"review":true,"approve":true,"publish":true},"settings":{"view":true,"edit":true,"domains":true,"api":true,"security":true,"permissions":true}}'::jsonb),
(NULL, 'site_manager', 'Site Manager', 'Manages projects, settings, publishing, and team access. Cannot manage billing or delete the workspace.', true, 'violet',
 '{"content":{"view":true,"edit":true,"delete":true,"publish":true},"collections":{"view":true,"edit":true,"schema":true,"delete":true},"media":{"upload":true,"delete":true,"organize":true},"publishing":{"draft":true,"review":true,"approve":true,"publish":true},"settings":{"view":true,"edit":true,"domains":true,"api":true,"security":false,"permissions":true}}'::jsonb),
(NULL, 'developer', 'Developer', 'Builds schemas, components, and integrations. Usually cannot publish production content.', true, 'sky',
 '{"content":{"view":true,"edit":true,"delete":false,"publish":false},"collections":{"view":true,"edit":true,"schema":true,"delete":true},"media":{"upload":true,"delete":true,"organize":true},"publishing":{"draft":true,"review":true,"approve":false,"publish":false},"settings":{"view":true,"edit":true,"domains":false,"api":true,"security":false,"permissions":false}}'::jsonb),
(NULL, 'marketer', 'Marketer', 'Owns pages, campaigns, SEO, and publishing. Cannot change schemas or components.', true, 'emerald',
 '{"content":{"view":true,"edit":true,"delete":false,"publish":true},"collections":{"view":true,"edit":false,"schema":false,"delete":false},"media":{"upload":true,"delete":false,"organize":true},"publishing":{"draft":true,"review":true,"approve":true,"publish":true},"settings":{"view":true,"edit":false,"domains":false,"api":false,"security":false,"permissions":false}}'::jsonb),
(NULL, 'content_editor', 'Content Editor', 'Writes content, uploads media, and requests review. Cannot publish or change schema.', true, 'rose',
 '{"content":{"view":true,"edit":true,"delete":false,"publish":false},"collections":{"view":true,"edit":false,"schema":false,"delete":false},"media":{"upload":true,"delete":false,"organize":false},"publishing":{"draft":true,"review":true,"approve":false,"publish":false},"settings":{"view":false,"edit":false,"domains":false,"api":false,"security":false,"permissions":false}}'::jsonb),
(NULL, 'viewer', 'Viewer', 'Read-only access. Can view, preview, comment, and approve. Ideal for clients and stakeholders.', true, 'slate',
 '{"content":{"view":true,"edit":false,"delete":false,"publish":false},"collections":{"view":true,"edit":false,"schema":false,"delete":false},"media":{"upload":false,"delete":false,"organize":false},"publishing":{"draft":false,"review":true,"approve":true,"publish":false},"settings":{"view":false,"edit":false,"domains":false,"api":false,"security":false,"permissions":false}}'::jsonb);
