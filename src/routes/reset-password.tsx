import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password · BetterCMS" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash and auto-creates a session
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-[28px] font-semibold tracking-tight text-foreground">Set a new password</h1>
        <form onSubmit={onSubmit} className="rounded-xl border border-[color:var(--border-hairline)] bg-card p-5">
          {!ready && (
            <p className="mb-3 text-[12px] text-muted-foreground">
              Open this page from the password reset email link.
            </p>
          )}
          <label className="mb-4 block">
            <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">New password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="h-10 w-full rounded-[8px] border border-[color:var(--color-border)] bg-card px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] focus:border-[color:var(--border-strong)] focus:shadow-[var(--shadow-focus)]"
            />
          </label>
          <button
            type="submit"
            disabled={loading || !ready}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-[6px] bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] active:bg-[var(--primary-pressed)] disabled:opacity-60"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}
