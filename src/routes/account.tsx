/**
 * /account — the signed-in person's own settings, as a full dedicated area
 * (not a modal). Top-level route, so it renders its own clean shell instead
 * of the workspace chrome, the way a professional platform's account settings
 * live apart from any one workspace.
 *
 * Sub-pages: Profile, Login & security (password + 2FA + sessions), Email,
 * Connected accounts, Preferences.
 */
import { Outlet, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isGuest } from "@/lib/guest";
import { useSession } from "@/hooks/use-session";
import { Logo } from "@/components/cms/shell/Logo";
import { ThemeToggle } from "@/components/cms/shell/ThemeToggle";
import { SettingsSubNav } from "@/components/cms/SettingsSubNav";
import { accountActions, useProfile } from "@/lib/workspace/account-store";
import { initialsOf } from "@/components/cms/account/AccountBits";

export const Route = createFileRoute("/account")({
  component: AccountLayout,
});

const NAV = [
  { label: "Profile", href: "/account/profile" },
  { label: "Login & security", href: "/account/security" },
  { label: "Email", href: "/account/email" },
  { label: "Connected accounts", href: "/account/connections" },
  { label: "Preferences", href: "/account/preferences" },
];

function AccountLayout() {
  const navigate = useNavigate();
  const router = useRouter();
  const { user } = useSession();
  const profile = useProfile();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isGuest()) {
      setChecked(true);
      return;
    }
    let cancel = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancel) return;
      if (!data.session) navigate({ to: "/auth", replace: true });
      else setChecked(true);
    });
    return () => {
      cancel = true;
    };
  }, [navigate]);

  // Seed the account email from the signed-in session once, if not set yet.
  useEffect(() => {
    if (user?.email) accountActions.seedEmail(user.email);
  }, [user?.email]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const email = profile.email || user?.email || "guest@bettercms.site";
  const name = profile.name || email.split("@")[0];

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[color:var(--border-hairline)] bg-background px-3 sm:px-5">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.history.back() : navigate({ to: "/" }))}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back to app</span>
        </button>
        <div className="mx-1 h-5 w-px bg-[color:var(--border-hairline)]" />
        <Logo className="h-[18px]" />
        <span className="text-[13px] font-semibold tracking-tight">Account</span>
        <div className="flex-1" />
        <ThemeToggle />
        <div
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold text-white"
          style={{ backgroundColor: profile.avatarColor }}
          title={name}
        >
          {initialsOf(name)}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 max-md:flex-col">
        <SettingsSubNav items={NAV} title="Account" />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
