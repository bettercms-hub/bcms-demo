import { createFileRoute } from "@tanstack/react-router";
import { Monitor, Moon, Sun } from "lucide-react";
import { PageHeader, SettingsRow, SettingsSection } from "@/components/cms/SettingsSubNav";
import { Switch } from "@/components/ui/switch";
import { useAppearance, type Appearance } from "@/lib/cms/appearance";
import { accountActions, usePrefs } from "@/lib/workspace/account-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account/preferences")({
  component: PreferencesPage,
});

const MODES: { id: Appearance; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

function PreferencesPage() {
  const [appearance, setAppearance] = useAppearance();
  const prefs = usePrefs();

  return (
    <>
      <PageHeader title="Preferences" description="Personal settings for how the app looks and what lands in your inbox." />

      <SettingsSection title="Appearance" description="Choose a theme, or match your operating system.">
        <div className="grid max-w-md grid-cols-3 gap-2">
          {MODES.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setAppearance(o.id)}
              aria-pressed={appearance === o.id}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-[12.5px] font-medium transition-colors",
                appearance === o.id
                  ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_7%,transparent)] text-foreground"
                  : "border-[color:var(--color-border)] text-muted-foreground hover:bg-[color:var(--color-row-hover)]",
              )}
            >
              <o.icon className="h-5 w-5" />
              {o.label}
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-[color:var(--border-hairline)] pt-1">
          <SettingsRow label="Reduce motion" description="Minimise animations and transitions across the app.">
            <Switch checked={prefs.reducedMotion} onCheckedChange={(v) => accountActions.updatePrefs({ reducedMotion: v })} aria-label="Reduce motion" />
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection title="Email notifications" description="We'll only email you about the things you turn on here.">
        <SettingsRow label="Weekly digest" description="A summary of activity across your workspace.">
          <Switch checked={prefs.emailDigest} onCheckedChange={(v) => accountActions.updatePrefs({ emailDigest: v })} aria-label="Weekly digest" />
        </SettingsRow>
        <SettingsRow label="Mentions & replies" description="When someone @-mentions or replies to you.">
          <Switch checked={prefs.mentionEmails} onCheckedChange={(v) => accountActions.updatePrefs({ mentionEmails: v })} aria-label="Mentions and replies" />
        </SettingsRow>
        <SettingsRow label="Product updates" description="New features and occasional tips.">
          <Switch checked={prefs.productUpdates} onCheckedChange={(v) => accountActions.updatePrefs({ productUpdates: v })} aria-label="Product updates" />
        </SettingsRow>
      </SettingsSection>
    </>
  );
}
