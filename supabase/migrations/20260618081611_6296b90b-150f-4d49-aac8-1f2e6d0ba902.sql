
-- form
DROP POLICY IF EXISTS "forms open all" ON public.form;
REVOKE ALL ON public.form FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form TO authenticated;
GRANT ALL ON public.form TO service_role;
CREATE POLICY "form authenticated read" ON public.form FOR SELECT TO authenticated USING (true);
CREATE POLICY "form authenticated write" ON public.form FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "form authenticated update" ON public.form FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "form authenticated delete" ON public.form FOR DELETE TO authenticated USING (true);

-- form_field
DROP POLICY IF EXISTS "form_field open all" ON public.form_field;
REVOKE ALL ON public.form_field FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_field TO authenticated;
GRANT ALL ON public.form_field TO service_role;
CREATE POLICY "form_field authenticated read" ON public.form_field FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_field authenticated insert" ON public.form_field FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "form_field authenticated update" ON public.form_field FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "form_field authenticated delete" ON public.form_field FOR DELETE TO authenticated USING (true);

-- form_field_group
DROP POLICY IF EXISTS "form_field_group open all" ON public.form_field_group;
REVOKE ALL ON public.form_field_group FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_field_group TO authenticated;
GRANT ALL ON public.form_field_group TO service_role;
CREATE POLICY "form_field_group authenticated read" ON public.form_field_group FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_field_group authenticated insert" ON public.form_field_group FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "form_field_group authenticated update" ON public.form_field_group FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "form_field_group authenticated delete" ON public.form_field_group FOR DELETE TO authenticated USING (true);

-- form_submission
DROP POLICY IF EXISTS "form_submission open all" ON public.form_submission;
REVOKE ALL ON public.form_submission FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_submission TO authenticated;
GRANT ALL ON public.form_submission TO service_role;
CREATE POLICY "form_submission authenticated read" ON public.form_submission FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_submission authenticated update" ON public.form_submission FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "form_submission authenticated delete" ON public.form_submission FOR DELETE TO authenticated USING (true);

-- form_submission_note
DROP POLICY IF EXISTS "form_submission_note open all" ON public.form_submission_note;
REVOKE ALL ON public.form_submission_note FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_submission_note TO authenticated;
GRANT ALL ON public.form_submission_note TO service_role;
CREATE POLICY "form_submission_note authenticated all" ON public.form_submission_note FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- form_integration (contains secrets - NEVER anon)
DROP POLICY IF EXISTS "form_integration open all" ON public.form_integration;
REVOKE ALL ON public.form_integration FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_integration TO authenticated;
GRANT ALL ON public.form_integration TO service_role;
CREATE POLICY "form_integration authenticated all" ON public.form_integration FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- page_form_usage
DROP POLICY IF EXISTS "page_form_usage open all" ON public.page_form_usage;
REVOKE ALL ON public.page_form_usage FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_form_usage TO authenticated;
GRANT ALL ON public.page_form_usage TO service_role;
CREATE POLICY "page_form_usage authenticated read" ON public.page_form_usage FOR SELECT TO authenticated USING (true);
CREATE POLICY "page_form_usage authenticated insert" ON public.page_form_usage FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "page_form_usage authenticated update" ON public.page_form_usage FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "page_form_usage authenticated delete" ON public.page_form_usage FOR DELETE TO authenticated USING (true);
