ALTER TABLE public.comment_thread REPLICA IDENTITY FULL;
ALTER TABLE public.comment_message REPLICA IDENTITY FULL;
ALTER TABLE public.comment_reaction REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_thread;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_message;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_reaction;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;