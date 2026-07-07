import { Outlet, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/cms/shell/AppShell";
import { getWorkspaceBySlug } from "@/lib/cms/use-cms";
import { supabase } from "@/integrations/supabase/client";
import { isGuest } from "@/lib/guest";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/w/$workspace")({
  beforeLoad: ({ params }) => {
    // Validate the slug on the client only. Renamed slugs are persisted in
    // localStorage and applied to the store at load; the server can't read
    // that, so a server-side check would 404 a valid renamed workspace.
    if (typeof window !== "undefined" && !getWorkspaceBySlug(params.workspace)) {
      throw notFound();
    }
  },
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const { workspace } = Route.useParams();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Guest mode ("Continue without signing in") skips the session gate — the app
    // is a mock-data prototype, so no real session is required to browse it.
    if (isGuest()) {
      setChecked(true);
      return;
    }
    let cancel = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancel) return;
      if (!data.session) {
        navigate({ to: "/auth", replace: true });
      } else {
        setChecked(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !isGuest()) navigate({ to: "/auth", replace: true });
    });
    return () => {
      cancel = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Client-side slug validation (server skips it — see beforeLoad). Runs once
  // the store has applied any persisted slug rename.
  if (!getWorkspaceBySlug(workspace)) throw notFound();

  return <AppShell wsSlug={workspace}><Outlet /></AppShell>;
}
