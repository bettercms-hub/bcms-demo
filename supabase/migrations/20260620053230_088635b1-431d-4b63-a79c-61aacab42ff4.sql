
-- RLS policies for comment-attachments bucket
CREATE POLICY "comment_attachments_authenticated_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'comment-attachments');

CREATE POLICY "comment_attachments_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comment-attachments');

CREATE POLICY "comment_attachments_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'comment-attachments' AND auth.uid() = owner);
