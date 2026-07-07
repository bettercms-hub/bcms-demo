import { createFileRoute } from "@tanstack/react-router";
import { SettingsHeader } from "@/components/cms/SettingsSubNav";
import { Button } from "@/components/ui/button";
import { KeyRound, Plus, User2, Server } from "lucide-react";

export const Route = createFileRoute("/w/$workspace/settings/api-keys")({
  component: ApiKeys,
});

function ApiKeys() {
  return (
    <>
      <SettingsHeader
        title="API Keys"
        description="Personal and machine tokens for programmatic access."
      />

      <TokenCard
        icon={User2}
        title="Personal tokens"
        description="Tokens scoped to your user. Revoked when you leave the workspace."
      />
      <div className="h-4" />
      <TokenCard
        icon={Server}
        title="Machine tokens"
        description="Long-lived tokens for servers, CI, and integrations."
      />
    </>
  );
}

function TokenCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof KeyRound;
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
      <header className="flex items-start justify-between gap-4 border-b border-border/60 px-7 py-5">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--color-elevated)] text-primary">
            <Icon className="h-[16px] w-[16px]" strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-foreground">{title}</div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button size="sm" className="h-8 text-[13px]">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New token
        </Button>
      </header>
      <div className="px-7 py-12 text-center">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[color:var(--color-elevated)] text-muted-foreground">
          <KeyRound className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="mt-3 text-[13px] font-medium text-foreground">No tokens yet</div>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
          Create your first {title.toLowerCase()} to start authenticating API requests.
        </p>
      </div>
    </section>
  );
}
