/**
 * Account dialogs — My profile and Preferences, opened from the user menu.
 * Both write to the account store (localStorage), so the sidebar identity
 * and everywhere else update the moment you save.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Monitor, Moon, Sun, User, X } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useAppearance, type Appearance } from "@/lib/cms/appearance";
import { AVATAR_COLORS, accountActions, usePrefs, useProfile } from "@/lib/workspace/account-store";
import { cn } from "@/lib/utils";

function initialsOf(name: string): string {
  return (
    name
      .split(/[\s.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

function Shell({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={title} className="absolute left-1/2 top-[8vh] flex max-h-[84vh] w-[min(460px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] text-foreground shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">{title}</div>
            {subtitle && <div className="truncate text-[11.5px] text-muted-foreground">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ProfileDialog({ email, onClose }: { email: string; onClose: () => void }) {
  const profile = useProfile();
  const [name, setName] = useState(profile.name || (email ? email.split("@")[0] : "Guest"));
  const [title, setTitle] = useState(profile.title);
  const [color, setColor] = useState(profile.avatarColor);

  function save() {
    accountActions.updateProfile({ name: name.trim(), title: title.trim(), avatarColor: color });
    toast.success("Profile updated");
    onClose();
  }

  return (
    <Shell title="My profile" subtitle="How you appear across the workspace" onClose={onClose} footer={
      <>
        <button type="button" onClick={onClose} className="h-8 rounded-md px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)]">Cancel</button>
        <button type="button" onClick={save} disabled={!name.trim()} className="h-8 rounded-md bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40">Save changes</button>
      </>
    }>
      <div className="flex items-center gap-3.5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-[16px] font-semibold text-white" style={{ backgroundColor: color }}>
          {initialsOf(name)}
        </div>
        <div className="min-w-0">
          <div className="text-[11.5px] font-medium text-muted-foreground">Avatar colour</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {AVATAR_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`} className={cn("grid h-6 w-6 place-items-center rounded-full ring-offset-2 ring-offset-[color:var(--card)] transition-transform hover:scale-110", color === c && "ring-2 ring-[color:var(--foreground)]")} style={{ backgroundColor: c }}>
                {color === c && <Check className="h-3 w-3 text-white" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="block">
        <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Display name</div>
        <input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[13px] outline-none transition-colors focus:border-[color:var(--primary)]" />
      </label>
      <label className="block">
        <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Title / role <span className="font-normal text-muted-foreground/70">(optional)</span></div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Content lead" className="h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[13px] outline-none transition-colors focus:border-[color:var(--primary)]" />
      </label>
      <div>
        <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Email</div>
        <div className="flex h-9 items-center gap-2 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-2.5 text-[13px] text-muted-foreground">
          <User className="h-3.5 w-3.5" /> {email}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Email is tied to your sign-in and can't be changed here.</p>
      </div>
    </Shell>
  );
}

export function PreferencesDialog({ onClose }: { onClose: () => void }) {
  const [appearance, setAppearance] = useAppearance();
  const prefs = usePrefs();

  return (
    <Shell title="Preferences" subtitle="Personal settings, saved to this browser" onClose={onClose} footer={
      <button type="button" onClick={onClose} className="h-8 rounded-md bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]">Done</button>
    }>
      <div>
        <div className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">Appearance</div>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { id: "light", label: "Light", icon: Sun },
            { id: "dark", label: "Dark", icon: Moon },
            { id: "system", label: "System", icon: Monitor },
          ] as { id: Appearance; label: string; icon: typeof Sun }[]).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setAppearance(o.id)}
              aria-pressed={appearance === o.id}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-[12px] font-medium transition-colors",
                appearance === o.id ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_7%,transparent)] text-foreground" : "border-[color:var(--color-border)] text-muted-foreground hover:bg-[color:var(--color-row-hover)]",
              )}
            >
              <o.icon className="h-4 w-4" />
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <PrefRow label="Reduce motion" description="Minimise animations and transitions." checked={prefs.reducedMotion} onChange={(v) => accountActions.updatePrefs({ reducedMotion: v })} />

      <div className="h-px bg-[color:var(--border-hairline)]" />
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email me about</div>
      <PrefRow label="Weekly digest" description="A summary of activity across your workspace." checked={prefs.emailDigest} onChange={(v) => accountActions.updatePrefs({ emailDigest: v })} />
      <PrefRow label="Mentions & replies" description="When someone @-mentions or replies to you." checked={prefs.mentionEmails} onChange={(v) => accountActions.updatePrefs({ mentionEmails: v })} />
      <PrefRow label="Product updates" description="New features and occasional tips." checked={prefs.productUpdates} onChange={(v) => accountActions.updatePrefs({ productUpdates: v })} />
    </Shell>
  );
}

function PrefRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-foreground">{label}</span>
        <span className="block text-[11.5px] leading-relaxed text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}
