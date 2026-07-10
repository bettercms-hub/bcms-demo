import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, Mail } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SettingsSection } from "@/components/cms/SettingsSubNav";
import { accountActions, useProfile } from "@/lib/workspace/account-store";
import { DemoNote, Field, Input, PrimaryButton } from "@/components/cms/account/AccountBits";

export const Route = createFileRoute("/account/email")({
  component: EmailPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EmailPage() {
  const profile = useProfile();
  const [next, setNext] = useState("");
  const current = profile.email || "guest@bettercms.site";

  const valid = EMAIL_RE.test(next.trim());
  const same = next.trim().toLowerCase() === current.toLowerCase();
  const error = next && !valid ? "Enter a valid email address." : same ? "That's already your email." : "";

  function change() {
    const email = next.trim();
    accountActions.updateProfile({ email });
    setNext("");
    toast.success("Email updated", { description: `Your sign-in email is now ${email}.` });
  }

  return (
    <>
      <PageHeader title="Email" description="The address you sign in with and where account notifications are sent." />

      <SettingsSection title="Current email">
        <div className="flex items-center gap-3 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3.5 py-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--card)] text-muted-foreground">
            <Mail className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-foreground">{current}</div>
            <div className="text-[11.5px] text-muted-foreground">Primary sign-in address</div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:color-mix(in_oklab,var(--emerald,#10B981)_14%,transparent)] px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title="Change email" description="We'll send a confirmation link to the new address before it takes effect.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="New email address" error={error}>
              <Input
                type="email"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="you@company.com"
                autoComplete="off"
              />
            </Field>
          </div>
          <PrimaryButton onClick={change} disabled={!valid || same} className="sm:mb-[1px]">
            Update email
          </PrimaryButton>
        </div>
        <DemoNote>
          This is a demo. The address updates instantly here and nothing is emailed; in production a verification link would
          confirm the change first.
        </DemoNote>
      </SettingsSection>
    </>
  );
}
