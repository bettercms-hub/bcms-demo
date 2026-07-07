
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by self or workspace teammates"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_member m1
      JOIN public.workspace_member m2
        ON m1.workspace_id = m2.workspace_id
      WHERE m1.user_ref = auth.uid()::text
        AND m2.user_ref = profiles.id::text
    )
  );

DROP POLICY IF EXISTS "seo_page open" ON public.seo_page;
CREATE POLICY "seo_page workspace members"
  ON public.seo_page
  FOR ALL
  TO authenticated
  USING (public.is_workspace_member_by_slug(auth.uid(), workspace_slug))
  WITH CHECK (public.is_workspace_member_by_slug(auth.uid(), workspace_slug));

DROP POLICY IF EXISTS "seo_keyword open" ON public.seo_keyword;
CREATE POLICY "seo_keyword workspace members"
  ON public.seo_keyword
  FOR ALL
  TO authenticated
  USING (public.is_workspace_member_by_slug(auth.uid(), workspace_slug))
  WITH CHECK (public.is_workspace_member_by_slug(auth.uid(), workspace_slug));

DROP POLICY IF EXISTS "seo_redirect open" ON public.seo_redirect;
CREATE POLICY "seo_redirect workspace members"
  ON public.seo_redirect
  FOR ALL
  TO authenticated
  USING (public.is_workspace_member_by_slug(auth.uid(), workspace_slug))
  WITH CHECK (public.is_workspace_member_by_slug(auth.uid(), workspace_slug));

DROP POLICY IF EXISTS comment_attachments_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS comment_attachments_authenticated_select ON storage.objects;

CREATE POLICY comment_attachments_workspace_member_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'comment-attachments'
    AND public.is_workspace_member(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

CREATE POLICY comment_attachments_workspace_member_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'comment-attachments'
    AND public.is_workspace_member(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

DROP POLICY IF EXISTS "Members read media files" ON storage.objects;
DROP POLICY IF EXISTS "Members upload media files" ON storage.objects;
DROP POLICY IF EXISTS "Members update media files" ON storage.objects;
DROP POLICY IF EXISTS "Members delete media files" ON storage.objects;

CREATE POLICY "Members read media files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'media'
    AND EXISTS (
      SELECT 1 FROM public.project p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.is_workspace_member(auth.uid(), p.workspace_id)
    )
  );

CREATE POLICY "Members upload media files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND EXISTS (
      SELECT 1 FROM public.project p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.is_workspace_member(auth.uid(), p.workspace_id)
    )
  );

CREATE POLICY "Members update media files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND EXISTS (
      SELECT 1 FROM public.project p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.is_workspace_member(auth.uid(), p.workspace_id)
    )
  );

CREATE POLICY "Members delete media files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND EXISTS (
      SELECT 1 FROM public.project p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.is_workspace_member(auth.uid(), p.workspace_id)
    )
  );

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
