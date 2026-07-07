import { createFileRoute } from "@tanstack/react-router";
import { SettingsHeader } from "@/components/cms/SettingsSubNav";
import { Button } from "@/components/ui/button";
import { Webhook, Plus } from "lucide-react";

export const Route = createFileRoute("/w/$workspace/settings/webhooks")({
  component: Webhooks,
});

function Webhooks() {
  return (
    <>
      <SettingsHeader
        title="Webhooks"
        description="Subscribe to events and deliver them to your endpoints."
      />

      <section className="rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
        <header className="flex items-center justify-between gap-4 border-b border-border/60 px-7 py-5">
          <div>
            <div className="text-[14px] font-semibold text-foreground">Endpoints</div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              We POST signed JSON payloads to your URLs and retry on failure.
            </p>
          </div>
          <Button size="sm" className="h-8 text-[13px]">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New endpoint
          </Button>
        </header>
        <div className="px-7 py-14 text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[color:var(--color-elevated)] text-muted-foreground">
            <Webhook className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="mt-3 text-[13px] font-medium text-foreground">No endpoints configured</div>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            Connect your first endpoint to receive real-time events for publishing, comments, and more.
          </p>
        </div>
      </section>
    </>
  );
}
