/**
 * Auth — sign in, sign up, reset. Split screen: the form on the left, a
 * quiet product panel on the right (hidden on mobile).
 *
 * SSO first, email second, demo door last. In the prototype the SSO
 * buttons simulate the account: sign-up routes into onboarding with a
 * demo session, sign-in goes straight to the workspace. Email and
 * password run through real Supabase auth; a fresh signup also lands in
 * onboarding. "Continue without signing in" stays for the team demo.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { enableGuest } from "@/lib/guest";
import { defaultWorkspaceSlug } from "@/lib/cms/store";
import { patchOnboarding } from "@/lib/onboarding/onboarding-store";
import { Logo } from "@/components/cms/shell/Logo";
import { toast } from "sonner";
import { Check, Github, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in · BetterCMS" }] }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

const COPY: Record<Mode, { title: string; subtitle: string; cta: string }> = {
  signin: { title: "Welcome back", subtitle: "Sign in to your workspace.", cta: "Sign in" },
  signup: { title: "Create your account", subtitle: "Free to start. No card needed.", cta: "Create account" },
  forgot: { title: "Reset your password", subtitle: "We will email you a reset link.", cta: "Send reset link" },
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3a7.24 7.24 0 0 1-10.8-3.82H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.26 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.27a12 12 0 0 0 0 10.74l3.99-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.98 11.98 0 0 0 1.27 6.63l3.99 3.1A7.17 7.17 0 0 1 12 4.75Z" />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const copy = COPY[mode];

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  /** SSO is simulated in the prototype: same destinations, no provider. */
  function ssoContinue(provider: string) {
    toast.success(`${provider} sign in is simulated in this demo`);
    enableGuest();
    if (mode === "signup") {
      navigate({ to: "/onboarding" });
    } else {
      navigate({ to: "/", replace: true });
    }
  }

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
        patchOnboarding({ name: fullName });
        navigate({ to: "/onboarding" });
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

  const inputCls =
    "h-10 w-full rounded-[8px] border border-[color:var(--color-border)] bg-card px-3 text-[13.5px] text-foreground outline-none transition-[border-color,box-shadow] focus:border-[color:var(--border-strong)] focus:shadow-[var(--shadow-focus)]";

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* ------------------------------------------------------ form side */}
      <div className="flex flex-col px-6 py-6">
        <Logo className="h-6 w-auto self-start" />

        <div className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-10">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">{copy.title}</h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">{copy.subtitle}</p>

          {mode !== "forgot" && (
            <>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => ssoContinue("Google")}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-[color:var(--color-border)] bg-card text-[13px] font-medium text-foreground transition-colors hover:border-[color:var(--border-strong)] hover:bg-[color:var(--color-row-hover)]"
                >
                  <GoogleMark /> Google
                </button>
                <button
                  type="button"
                  onClick={() => ssoContinue("GitHub")}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-[color:var(--color-border)] bg-card text-[13px] font-medium text-foreground transition-colors hover:border-[color:var(--border-strong)] hover:bg-[color:var(--color-row-hover)]"
                >
                  <Github className="h-4 w-4" /> GitHub
                </button>
              </div>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-[color:var(--border-hairline)]" />
                <span className="text-[11px] text-muted-foreground">or with email</span>
                <span className="h-px flex-1 bg-[color:var(--border-hairline)]" />
              </div>
            </>
          )}

          <form onSubmit={onSubmit} className={mode === "forgot" ? "mt-6" : ""}>
            {mode === "signup" && (
              <label className="mb-3 block">
                <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Full name</div>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" placeholder="Jane Doe" className={inputCls} />
              </label>
            )}

            <label className="mb-3 block">
              <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Email</div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@company.com" className={inputCls} />
            </label>

            {mode !== "forgot" && (
              <label className="mb-4 block">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11.5px] font-medium text-muted-foreground">Password</span>
                  {mode === "signin" && (
                    <button type="button" onClick={() => setMode("forgot")} className="text-[11.5px] text-primary hover:underline">
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
                  placeholder={mode === "signup" ? "8 or more characters" : "Your password"}
                  className={inputCls}
                />
              </label>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-[6px] bg-primary text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] active:bg-[var(--primary-pressed)] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {copy.cta}
            </button>
          </form>

          <div className="mt-5 text-center text-[12.5px] text-muted-foreground">
            {mode === "signin" ? (
              <>
                New here?{" "}
                <button type="button" onClick={() => setMode("signup")} className="font-medium text-primary hover:underline">
                  Create an account
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setMode("signin")} className="font-medium text-primary hover:underline">
                Back to sign in
              </button>
            )}
          </div>

          <div className="mt-8 border-t border-[color:var(--border-hairline)] pt-5">
            <button
              type="button"
              onClick={() => {
                enableGuest();
                navigate({ to: "/w/$workspace", params: { workspace: defaultWorkspaceSlug() }, replace: true });
              }}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-[color:var(--color-border)] text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-[color:var(--color-border-strong)] hover:text-foreground"
            >
              <Sparkles className="h-3.5 w-3.5" /> Continue without signing in
            </button>
            <p className="mt-1.5 text-center text-[10.5px] text-muted-foreground/70">Explore the full demo with seeded workspaces. No account needed.</p>
          </div>
        </div>

        <p className="text-[10.5px] text-muted-foreground/60">By continuing you agree to the Terms and the Privacy Policy.</p>
      </div>

      {/* ----------------------------------------------------- brand side */}
      <div className="relative hidden overflow-hidden bg-[color:var(--s2)] lg:block">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 left-10 h-96 w-96 rounded-full bg-[color:color-mix(in_srgb,var(--brand-burgundy)_10%,transparent)] blur-3xl" aria-hidden />

        <div className="relative flex h-full flex-col justify-center px-14 xl:px-20">
          <h2 className="max-w-[420px] text-[26px] font-semibold leading-[1.25] tracking-[-0.01em] text-foreground">
            Structured content, visual editing, and an agent that does the busywork.
          </h2>

          {/* small product vignette: the workspace at a glance */}
          <div className="mt-8 w-full max-w-[420px] rounded-2xl border border-[color:var(--color-border)] bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-[12px] font-bold text-background">A</span>
              <div>
                <div className="text-[13px] font-semibold text-foreground">Acme Inc</div>
                <div className="text-[10.5px] text-muted-foreground">Agency workspace · 3 projects</div>
              </div>
              <span className="ml-auto rounded-[4px] bg-[var(--status-live-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--status-live-fg)]">All sites live</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {[
                ["Marketing site", "24 pages · published 2h ago"],
                ["Docs", "llms.txt · markdown twins on"],
                ["Client: Harbor & Co", "SEO batch · 12 drafts ready"],
              ].map(([name, meta]) => (
                <div key={name} className="flex items-center justify-between rounded-lg bg-[color:var(--s2)] px-3 py-2">
                  <span className="text-[12px] font-medium text-foreground">{name}</span>
                  <span className="text-[10.5px] text-muted-foreground">{meta}</span>
                </div>
              ))}
            </div>
          </div>

          <ul className="mt-8 space-y-2">
            {["Pages composed from sections your developers approved", "An agent that drafts, audits and undoes in one click", "Every page served as markdown for AI answer engines"].map((line) => (
              <li key={line} className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
