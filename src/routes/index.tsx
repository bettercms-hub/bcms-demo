import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isGuest } from "@/lib/guest";
import { defaultWorkspaceSlug } from "@/lib/cms/store";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    if (isGuest()) {
      navigate({ to: "/w/$workspace", params: { workspace: defaultWorkspaceSlug() }, replace: true });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/auth", replace: true });
      } else {
        navigate({ to: "/w/$workspace", params: { workspace: defaultWorkspaceSlug() }, replace: true });
      }
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
