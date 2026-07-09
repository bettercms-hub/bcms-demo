import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SettingsSection } from "@/components/cms/SettingsSubNav";
import { AVATAR_COLORS, accountActions, useProfile } from "@/lib/workspace/account-store";
import { Field, GhostButton, Input, Label, PrimaryButton, initialsOf } from "@/components/cms/account/AccountBits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const profile = useProfile();
  const [name, setName] = useState(profile.name);
  const [title, setTitle] = useState(profile.title);
  const [bio, setBio] = useState(profile.bio);
  const [color, setColor] = useState(profile.avatarColor);

  const displayName = name || profile.email.split("@")[0] || "You";
  const dirty = name !== profile.name || title !== profile.title || bio !== profile.bio || color !== profile.avatarColor;

  function save() {
    accountActions.updateProfile({ name: name.trim(), title: title.trim(), bio: bio.trim(), avatarColor: color });
    toast.success("Profile updated");
  }
  function reset() {
    setName(profile.name);
    setTitle(profile.title);
    setBio(profile.bio);
    setColor(profile.avatarColor);
  }

  return (
    <>
      <PageHeader title="Profile" description="How you appear to teammates across every workspace and project." />

      <SettingsSection title="Avatar" description="Shown next to your name in the sidebar, comments and activity.">
        <div className="flex items-center gap-5">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-[19px] font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {initialsOf(displayName)}
          </div>
          <div className="min-w-0">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Colour ${c}`}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full ring-offset-2 ring-offset-[color:var(--card)] transition-transform hover:scale-110",
                    color === c && "ring-2 ring-[color:var(--foreground)]",
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Details" description="Your name and role are visible to people you collaborate with.">
        <div className="space-y-4">
          <Field label="Display name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </Field>
          <Field label="Title / role" hint="optional">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Content lead" />
          </Field>
          <label className="block">
            <Label hint="optional">Bio</Label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={240}
              placeholder="A sentence about what you do."
              className="w-full resize-none rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-[color:var(--primary)]"
            />
            <div className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">{bio.length}/240</div>
          </label>
        </div>
      </SettingsSection>

      <div className="flex items-center justify-end gap-2">
        <GhostButton onClick={reset} disabled={!dirty}>
          Discard
        </GhostButton>
        <PrimaryButton onClick={save} disabled={!dirty || !name.trim()}>
          Save changes
        </PrimaryButton>
      </div>
    </>
  );
}
