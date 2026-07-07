
-- form
DROP POLICY IF EXISTS "form authenticated write" ON public.form;
DROP POLICY IF EXISTS "form authenticated update" ON public.form;
DROP POLICY IF EXISTS "form authenticated delete" ON public.form;
CREATE POLICY "form auth insert" ON public.form FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "form auth update" ON public.form FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "form auth delete" ON public.form FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- form_field
DROP POLICY IF EXISTS "form_field authenticated insert" ON public.form_field;
DROP POLICY IF EXISTS "form_field authenticated update" ON public.form_field;
DROP POLICY IF EXISTS "form_field authenticated delete" ON public.form_field;
CREATE POLICY "form_field auth insert" ON public.form_field FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "form_field auth update" ON public.form_field FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "form_field auth delete" ON public.form_field FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- form_field_group
DROP POLICY IF EXISTS "form_field_group authenticated insert" ON public.form_field_group;
DROP POLICY IF EXISTS "form_field_group authenticated update" ON public.form_field_group;
DROP POLICY IF EXISTS "form_field_group authenticated delete" ON public.form_field_group;
CREATE POLICY "form_field_group auth insert" ON public.form_field_group FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "form_field_group auth update" ON public.form_field_group FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "form_field_group auth delete" ON public.form_field_group FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- form_submission
DROP POLICY IF EXISTS "form_submission authenticated update" ON public.form_submission;
DROP POLICY IF EXISTS "form_submission authenticated delete" ON public.form_submission;
CREATE POLICY "form_submission auth update" ON public.form_submission FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "form_submission auth delete" ON public.form_submission FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- form_submission_note
DROP POLICY IF EXISTS "form_submission_note authenticated all" ON public.form_submission_note;
CREATE POLICY "form_submission_note auth read" ON public.form_submission_note FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_submission_note auth insert" ON public.form_submission_note FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "form_submission_note auth update" ON public.form_submission_note FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "form_submission_note auth delete" ON public.form_submission_note FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- form_integration
DROP POLICY IF EXISTS "form_integration authenticated all" ON public.form_integration;
CREATE POLICY "form_integration auth read" ON public.form_integration FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_integration auth insert" ON public.form_integration FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "form_integration auth update" ON public.form_integration FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "form_integration auth delete" ON public.form_integration FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- page_form_usage
DROP POLICY IF EXISTS "page_form_usage authenticated insert" ON public.page_form_usage;
DROP POLICY IF EXISTS "page_form_usage authenticated update" ON public.page_form_usage;
DROP POLICY IF EXISTS "page_form_usage authenticated delete" ON public.page_form_usage;
CREATE POLICY "page_form_usage auth insert" ON public.page_form_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "page_form_usage auth update" ON public.page_form_usage FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "page_form_usage auth delete" ON public.page_form_usage FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
