
-- Helper: workspace membership by slug (for seo_* tables that key on workspace_slug)
CREATE OR REPLACE FUNCTION public.is_workspace_member_by_slug(_user uuid, _slug text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace w
    JOIN public.workspace_member m ON m.workspace_id = w.id
    WHERE w.slug = _slug AND m.user_ref = _user::text
  );
$$;

-- workspace
DROP POLICY IF EXISTS "workspace open all" ON public.workspace;
REVOKE ALL ON public.workspace FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace TO authenticated;
GRANT ALL ON public.workspace TO service_role;
CREATE POLICY "workspace member read" ON public.workspace FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), id) OR public.is_workspace_owner(auth.uid(), id));
CREATE POLICY "workspace owner insert" ON public.workspace FOR INSERT TO authenticated
  WITH CHECK (owner_user_ref = auth.uid()::text);
CREATE POLICY "workspace owner update" ON public.workspace FOR UPDATE TO authenticated
  USING (public.is_workspace_owner(auth.uid(), id))
  WITH CHECK (public.is_workspace_owner(auth.uid(), id));
CREATE POLICY "workspace owner delete" ON public.workspace FOR DELETE TO authenticated
  USING (public.is_workspace_owner(auth.uid(), id));

-- workspace_member
DROP POLICY IF EXISTS "workspace_member open all" ON public.workspace_member;
REVOKE ALL ON public.workspace_member FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_member TO authenticated;
GRANT ALL ON public.workspace_member TO service_role;
CREATE POLICY "workspace_member read" ON public.workspace_member FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "workspace_member owner insert" ON public.workspace_member FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_owner(auth.uid(), workspace_id) OR user_ref = auth.uid()::text);
CREATE POLICY "workspace_member owner update" ON public.workspace_member FOR UPDATE TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_owner(auth.uid(), workspace_id));
CREATE POLICY "workspace_member owner delete" ON public.workspace_member FOR DELETE TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id));

-- workspace_role
DROP POLICY IF EXISTS "workspace_role open all" ON public.workspace_role;
REVOKE ALL ON public.workspace_role FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_role TO authenticated;
GRANT ALL ON public.workspace_role TO service_role;
CREATE POLICY "workspace_role member read" ON public.workspace_role FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "workspace_role owner insert" ON public.workspace_role FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_owner(auth.uid(), workspace_id));
CREATE POLICY "workspace_role owner update" ON public.workspace_role FOR UPDATE TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_owner(auth.uid(), workspace_id));
CREATE POLICY "workspace_role owner delete" ON public.workspace_role FOR DELETE TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id));

-- workspace_invitation
DROP POLICY IF EXISTS "workspace_invitation open all" ON public.workspace_invitation;
REVOKE ALL ON public.workspace_invitation FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invitation TO authenticated;
GRANT ALL ON public.workspace_invitation TO service_role;
CREATE POLICY "workspace_invitation owner read" ON public.workspace_invitation FOR SELECT TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id));
CREATE POLICY "workspace_invitation owner insert" ON public.workspace_invitation FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_owner(auth.uid(), workspace_id));
CREATE POLICY "workspace_invitation owner update" ON public.workspace_invitation FOR UPDATE TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_owner(auth.uid(), workspace_id));
CREATE POLICY "workspace_invitation owner delete" ON public.workspace_invitation FOR DELETE TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id));

-- project_member_access
DROP POLICY IF EXISTS "project_member_access open all" ON public.project_member_access;
REVOKE ALL ON public.project_member_access FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_member_access TO authenticated;
GRANT ALL ON public.project_member_access TO service_role;
CREATE POLICY "project_member_access read" ON public.project_member_access FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "project_member_access owner write" ON public.project_member_access FOR ALL TO authenticated
  USING (public.is_workspace_owner(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_owner(auth.uid(), workspace_id));

-- seo_integration
DROP POLICY IF EXISTS "seo_integration open" ON public.seo_integration;
REVOKE ALL ON public.seo_integration FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_integration TO authenticated;
GRANT ALL ON public.seo_integration TO service_role;
CREATE POLICY "seo_integration member all" ON public.seo_integration FOR ALL TO authenticated
  USING (public.is_workspace_member_by_slug(auth.uid(), workspace_slug))
  WITH CHECK (public.is_workspace_member_by_slug(auth.uid(), workspace_slug));

-- seo_page_version
DROP POLICY IF EXISTS "seo_page_version open" ON public.seo_page_version;
REVOKE ALL ON public.seo_page_version FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_page_version TO authenticated;
GRANT ALL ON public.seo_page_version TO service_role;
CREATE POLICY "seo_page_version member all" ON public.seo_page_version FOR ALL TO authenticated
  USING (public.is_workspace_member_by_slug(auth.uid(), workspace_slug))
  WITH CHECK (public.is_workspace_member_by_slug(auth.uid(), workspace_slug));

-- seo_project_settings
DROP POLICY IF EXISTS "seo_project_settings open" ON public.seo_project_settings;
REVOKE ALL ON public.seo_project_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_project_settings TO authenticated;
GRANT ALL ON public.seo_project_settings TO service_role;
CREATE POLICY "seo_project_settings member all" ON public.seo_project_settings FOR ALL TO authenticated
  USING (public.is_workspace_member_by_slug(auth.uid(), workspace_slug))
  WITH CHECK (public.is_workspace_member_by_slug(auth.uid(), workspace_slug));

-- Restrict SECURITY DEFINER helpers: keep available for RLS evaluation, block direct anon RPC.
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member_by_slug(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_workspace_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member_by_slug(uuid, text) TO authenticated;
