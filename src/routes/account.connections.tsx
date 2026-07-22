import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SettingsSection } from "@/components/cms/SettingsSubNav";
import {
  CONNECTION_META,
  CONNECTION_ORDER,
  accountActions,
  useConnections,
  useProfile,
  type ConnectionProvider,
} from "@/lib/workspace/account-store";
import { DangerButton, PrimaryButton } from "@/components/cms/account/AccountBits";

export const Route = createFileRoute("/account/connections")({
  component: ConnectionsPage,
});

const BRAND: Record<ConnectionProvider, string> = {
  google: "#4285F4",
  github: "#181717",
  slack: "#4A154B",
  figma: "#F24E1E",
  notion: "#111111",
  linear: "#5E6AD2",
};

/** A sensible demo handle for a freshly linked provider. */
function handleFor(provider: ConnectionProvider, email: string): string {
  const user = (email.split("@")[0] || "you").toLowerCase();
  switch (provider) {
    case "google":
      return email || "you@gmail.com";
    case "slack":
      return "Acme workspace";
    case "figma":
      return `${user}@figma`;
    case "notion":
      return "Acme team";
    default:
      return user;
  }
}

function ProviderRow({ provider, email }: { provider: ConnectionProvider; email: string }) {
  const connections = useConnections();
  const meta = CONNECTION_META[provider];
  const conn = connections[provider];
  const [busy, setBusy] = useState(false);

  function connect() {
    setBusy(true);
    setTimeout(() => {
      accountActions.connect(provider, handleFor(provider, email), Date.now());
      setBusy(false);
      toast.success(`${meta.label} connected`);
    }, 550);
  }
  function disconnect() {
    accountActions.disconnect(provider);
    toast(`${meta.label} disconnected`);
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[13px] font-bold text-white"
        style={{ backgroundColor: BRAND[provider] }}
        aria-hidden
      >
        {meta.label[0]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-foreground">{meta.label}</span>
          {conn && (
            <span className="inline-flex items-center gap-1 rounded-[4px] bg-[var(--status-live-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--status-live-fg)]">
              <Check className="h-3 w-3" /> Connected
            </span>
          )}
        </div>
        <div className="truncate text-[11.5px] text-muted-foreground">{conn ? conn.handle : meta.blurb}</div>
      </div>
      {conn ? (
        <DangerButton onClick={disconnect}>Disconnect</DangerButton>
      ) : (
        <PrimaryButton onClick={connect} disabled={busy}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Connect
        </PrimaryButton>
      )}
    </div>
  );
}

function ConnectionsPage() {
  const profile = useProfile();
  const email = profile.email || "you@bettercms.site";

  return (
    <>
      <PageHeader title="Connected accounts" description="Link the apps you already use so BetterCMS can sign you in and work with them." />
      <SettingsSection title="Apps" description="Connect or disconnect at any time. Disconnecting revokes access immediately." flush>
        <div className="divide-y divide-[color:var(--border-hairline)]">
          {CONNECTION_ORDER.map((p) => (
            <ProviderRow key={p} provider={p} email={email} />
          ))}
        </div>
      </SettingsSection>
    </>
  );
}
