
-- Storage policies for media bucket. Path convention: {project_id}/...
CREATE POLICY "Members read media files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'media' AND EXISTS (
      SELECT 1 FROM public.project p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.is_workspace_member(auth.uid(), p.workspace_id)
    )
  );

CREATE POLICY "Members upload media files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media' AND EXISTS (
      SELECT 1 FROM public.project p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.is_workspace_member(auth.uid(), p.workspace_id)
    )
  );

CREATE POLICY "Members update media files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media' AND EXISTS (
      SELECT 1 FROM public.project p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.is_workspace_member(auth.uid(), p.workspace_id)
    )
  );

CREATE POLICY "Members delete media files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'media' AND EXISTS (
      SELECT 1 FROM public.project p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.is_workspace_member(auth.uid(), p.workspace_id)
    )
  );
