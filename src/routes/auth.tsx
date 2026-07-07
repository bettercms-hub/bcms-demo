import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { enableGuest } from "@/lib/guest";
import { Logo } from "@/components/cms/shell/Logo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in · BetterCMS" }] }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email for a reset link");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="mx-auto h-8 w-auto" />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
            {mode === "signin" && "Sign in to your workspace"}
            {mode === "signup" && "Create your account"}
            {mode === "forgot" && "Reset your password"}
          </h1>
        </div>

        <form onSubmit={onSubmit} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          {mode === "signup" && (
            <label className="mb-3 block">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Full name</div>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
          )}

          <label className="mb-3 block">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Email</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>

          {mode !== "forgot" && (
            <label className="mb-4 block">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Password</span>
                {mode === "signin" && (
                  <button type="button" onClick={() => setMode("forgot")} className="text-[11px] text-primary hover:underline">
                    Forgot?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {mode === "signin" && "Sign in"}
            {mode === "signup" && "Create account"}
            {mode === "forgot" && "Send reset link"}
          </button>

          <div className="mt-4 text-center text-[12px] text-muted-foreground">
            {mode === "signin" ? (
              <>
                No account?{" "}
                <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">
                  Sign up
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setMode("signin")} className="text-primary hover:underline">
                  Back to sign in
                </button>
              </>
            )}
          </div>
        </form>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          <button
            type="button"
            onClick={() => {
              enableGuest();
              navigate({ to: "/w/$workspace", params: { workspace: "flowtrix" }, replace: true });
            }}
            className="hover:underline"
          >
            Continue without signing in
          </button>
        </p>
      </div>
    </div>
  );
}
