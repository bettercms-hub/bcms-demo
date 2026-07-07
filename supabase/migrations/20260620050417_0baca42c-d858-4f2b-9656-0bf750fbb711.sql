
-- =========================================================================
-- Universal Comments & AI Collaboration — Phase 1 schema
-- =========================================================================

-- Enums --------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.comment_surface AS ENUM (
    'editor','preview','split','page','component','collection',
    'media','seo','analytics','forms','settings','schema','navigation','template'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.comment_anchor_kind AS ENUM ('page','block','field','selection','element');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.comment_status AS ENUM ('open','resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.comment_priority AS ENUM ('none','low','medium','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.comment_author_kind AS ENUM ('user','ai','system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- comment_thread -----------------------------------------------------------
CREATE TABLE public.comment_thread (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspace(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.project(id) ON DELETE CASCADE,
  surface public.comment_surface NOT NULL DEFAULT 'editor',
  page_id text,
  anchor_kind public.comment_anchor_kind NOT NULL DEFAULT 'page',
  anchor_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  viewport jsonb NOT NULL DEFAULT '{}'::jsonb,
  version_label text,
  status public.comment_status NOT NULL DEFAULT 'open',
  priority public.comment_priority NOT NULL DEFAULT 'none',
  assignee_user_id uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comment_thread_project_surface_idx
  ON public.comment_thread (project_id, surface, page_id, status);
CREATE INDEX comment_thread_workspace_idx
  ON public.comment_thread (workspace_id, last_activity_at DESC);
CREATE INDEX comment_thread_assignee_idx
  ON public.comment_thread (assignee_user_id) WHERE assignee_user_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_thread TO authenticated;
GRANT ALL ON public.comment_thread TO service_role;
ALTER TABLE public.comment_thread ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view threads"
  ON public.comment_thread FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can create threads"
  ON public.comment_thread FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_member(auth.uid(), workspace_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Workspace members can update threads"
  ON public.comment_thread FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can delete threads"
  ON public.comment_thread FOR DELETE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));


-- comment_message ----------------------------------------------------------
CREATE TABLE public.comment_message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.comment_thread(id) ON DELETE CASCADE,
  author_kind public.comment_author_kind NOT NULL DEFAULT 'user',
  author_user_id uuid,
  body text NOT NULL DEFAULT '',
  mentions jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_edit jsonb,
  parent_message_id uuid REFERENCES public.comment_message(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comment_message_thread_idx
  ON public.comment_message (thread_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_message TO authenticated;
GRANT ALL ON public.comment_message TO service_role;
ALTER TABLE public.comment_message ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view messages"
  ON public.comment_message FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.comment_thread t
    WHERE t.id = comment_message.thread_id
      AND public.is_workspace_member(auth.uid(), t.workspace_id)
  ));

CREATE POLICY "Workspace members can add messages"
  ON public.comment_message FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.comment_thread t
    WHERE t.id = comment_message.thread_id
      AND public.is_workspace_member(auth.uid(), t.workspace_id)
  ));

CREATE POLICY "Authors can update their own messages"
  ON public.comment_message FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid())
  WITH CHECK (author_user_id = auth.uid());

CREATE POLICY "Authors can delete their own messages"
  ON public.comment_message FOR DELETE TO authenticated
  USING (author_user_id = auth.uid());


-- comment_reaction ---------------------------------------------------------
CREATE TABLE public.comment_reaction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.comment_message(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX comment_reaction_message_idx ON public.comment_reaction (message_id);

GRANT SELECT, INSERT, DELETE ON public.comment_reaction TO authenticated;
GRANT ALL ON public.comment_reaction TO service_role;
ALTER TABLE public.comment_reaction ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view reactions"
  ON public.comment_reaction FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.comment_message m
    JOIN public.comment_thread t ON t.id = m.thread_id
    WHERE m.id = comment_reaction.message_id
      AND public.is_workspace_member(auth.uid(), t.workspace_id)
  ));

CREATE POLICY "Users can add their own reactions"
  ON public.comment_reaction FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their own reactions"
  ON public.comment_reaction FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- comment_read_state -------------------------------------------------------
CREATE TABLE public.comment_read_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.comment_thread(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, user_id)
);

CREATE INDEX comment_read_state_user_idx ON public.comment_read_state (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_read_state TO authenticated;
GRANT ALL ON public.comment_read_state TO service_role;
ALTER TABLE public.comment_read_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see only their own read state"
  ON public.comment_read_state FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users manage their own read state insert"
  ON public.comment_read_state FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage their own read state update"
  ON public.comment_read_state FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage their own read state delete"
  ON public.comment_read_state FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- Triggers -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.comments_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER comment_thread_touch_updated
  BEFORE UPDATE ON public.comment_thread
  FOR EACH ROW EXECUTE FUNCTION public.comments_set_updated_at();

CREATE TRIGGER comment_message_touch_updated
  BEFORE UPDATE ON public.comment_message
  FOR EACH ROW EXECUTE FUNCTION public.comments_set_updated_at();

CREATE OR REPLACE FUNCTION public.comments_bump_thread_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.comment_thread
    SET last_activity_at = now(), updated_at = now()
    WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER comment_message_bump_thread
  AFTER INSERT ON public.comment_message
  FOR EACH ROW EXECUTE FUNCTION public.comments_bump_thread_activity();


-- Realtime -----------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_thread;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_message;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_reaction;
