import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Cloud, Database, Globe, Plug, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SettingsHeader, SettingsSection } from "@/components/cms/SettingsSubNav";
import {
  DELIVERY_MODES,
  DELIVERY_MODE_ORDER,
  getDelivery,
  modeOf,
  switchSummary,
  type DeliveryMode,
} from "@/lib/cms/delivery";
import { projectActions, useCMS } from "@/lib/cms/store";
import { toast } from "sonner";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/delivery")({
  component: DeliveryPage,
});

function DeliveryPage() {
  const { workspace, project } = Route.useParams();
  const pr = useCMS((s) =>
    s.projects.find((p) => p.slug === project && s.workspaces.some((w) => w.slug === workspace && w.id === p.workspaceId)),
  );
  const [target, setTarget] = useState<DeliveryMode | null>(null);

  if (!pr) return null;
  const d = getDelivery(pr);
  const mode = modeOf(pr);
  const staging = `${pr.slug}.bettercms.site`;
  const restUrl = `https://api.bettercms.site/v1/${pr.id}/content`;

  function applyMode(next: DeliveryMode) {
    projectActions.setDelivery(pr!.id, DELIVERY_MODES[next].delivery);
    setTarget(null);
    toast.success(`Delivery switched to ${DELIVERY_MODES[next].label}. Content stayed exactly where it was.`);
  }

  return (
    <>
      <SettingsHeader
        title="Delivery"
        description="Choose who renders and serves this site. Switching never moves your content."
      />

      {/* Mode presets */}
      <SettingsSection
        title="Delivery mode"
        description="Hosted, headless, or both at once. The nav and settings adapt to what is on."
      >
        <div className="grid gap-3 md:grid-cols-3">
          {DELIVERY_MODE_ORDER.map((m) => {
            const def = DELIVERY_MODES[m];
            const active = m === mode;
            return (
              <button
                key={m}
                type="button"
                onClick={() => !active && setTarget(m)}
                className={`flex flex-col rounded-xl border p-4 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-[color:var(--color-border)] bg-[color:var(--s1)] hover:border-[color:var(--color-border-strong,var(--color-border))] hover:bg-[color:var(--color-row-hover)]"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-foreground">{def.label}</span>
                  {active && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-[4px] bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold text-primary">
                      <Check className="h-3 w-3" /> Current
                    </span>
                  )}
                </div>
                <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">{def.tagline}</p>
                <ul className="mt-auto space-y-1">
                  {def.includes.map((line) => (
                    <li key={line} className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-status-success" />
                      {line}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          Renders with: <span className="text-foreground/80">{DELIVERY_MODES[mode].renderer}</span>
        </p>
      </SettingsSection>

      {/* Architecture explainer */}
      <SettingsSection
        title="How it fits together"
        description="Delivery is an adapter on top of the content core, not a different product."
      >
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
          {/* Content core */}
          <div className="flex-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--s1)] p-4">
            <div className="mb-1.5 flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-[13px] font-semibold text-foreground">Content core</span>
            </div>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Schemas, entries, pages as block trees, media, SEO. Lives here no matter the mode.
            </p>
          </div>

          <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-muted-foreground md:rotate-0" />

          {/* Adapters */}
          <div className="flex flex-1 flex-col gap-2">
            <AdapterBox
              on={d.hosted}
              icon={Cloud}
              label="BetterCMS Cloud hosting"
              detail={d.hosted ? `Rendering and serving ${pr.domain ?? staging}` : "Off in this mode"}
            />
            <AdapterBox
              on={d.api}
              icon={Plug}
              label="Content Delivery API"
              detail={d.api ? "Serving JSON to any frontend or agent" : "Off in this mode"}
            />
          </div>

          <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-muted-foreground md:rotate-0" />

          {/* Consumers */}
          <div className="flex flex-1 flex-col gap-2">
            <ConsumerBox on={d.hosted} icon={Globe} label={`Visitors on ${pr.domain ?? staging}`} />
            <ConsumerBox on={d.api} icon={Smartphone} label="Your frontend, mobile app, agents over MCP" />
          </div>
        </div>
      </SettingsSection>

      {/* Active targets */}
      <SettingsSection title="Delivery targets" description="What is live right now, and where to manage it.">
        <div className="space-y-2">
          <TargetRow
            on={d.hosted}
            label="Hosted site"
            value={d.hosted ? (pr.domain ?? staging) : "Hosting is off. Your frontend renders this site."}
            action={
              d.hosted ? (
                <Link
                  to={`/w/${workspace}/p/${project}/settings/domains` as never}
                  className="text-[12px] font-medium text-primary hover:underline"
                >
                  Domains
                </Link>
              ) : null
            }
          />
          <TargetRow
            on={d.api}
            label="Content Delivery API"
            value={d.api ? restUrl : "The API is off. Turn on Headless or Hybrid to serve content."}
            mono={d.api}
            action={
              d.api ? (
                <Link
                  to={`/w/${workspace}/p/${project}/settings/api` as never}
                  className="text-[12px] font-medium text-primary hover:underline"
                >
                  API and keys
                </Link>
              ) : null
            }
          />
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          Hybrid runs both from the same content core: the hosted renderer is simply another consumer of the same API
          your own frontend would use.
        </p>
      </SettingsSection>

      {/* Switch dialog */}
      <Dialog open={target != null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-[440px]">
          {target && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Switch to {DELIVERY_MODES[target].label}
                </DialogTitle>
                <DialogDescription>{DELIVERY_MODES[target].tagline}</DialogDescription>
              </DialogHeader>
              <ul className="space-y-2">
                {switchSummary(mode, target).map((line, i, arr) => (
                  <li
                    key={line}
                    className={`flex items-start gap-2 text-[12.5px] leading-relaxed ${
                      i === arr.length - 1 ? "text-status-success" : "text-muted-foreground"
                    }`}
                  >
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success" />
                    {line}
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setTarget(null)}
                  className="inline-flex h-9 items-center rounded-[6px] px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => applyMode(target)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
                >
                  Switch to {DELIVERY_MODES[target].label}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AdapterBox({
  on,
  icon: Icon,
  label,
  detail,
}: {
  on: boolean;
  icon: typeof Cloud;
  label: string;
  detail: string;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        on ? "border-[color:var(--color-border)] bg-[color:var(--card)]" : "border-dashed border-[color:var(--color-border)] bg-transparent opacity-60"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${on ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-[12.5px] font-medium text-foreground">{label}</span>
        <span
          className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${on ? "bg-status-success" : "bg-[color:var(--s4)]"}`}
          aria-hidden
        />
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

function ConsumerBox({ on, icon: Icon, label }: { on: boolean; icon: typeof Globe; label: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border p-3 ${
        on ? "border-[color:var(--color-border)] bg-[color:var(--card)]" : "border-dashed border-[color:var(--color-border)] opacity-50"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${on ? "text-foreground/70" : "text-muted-foreground"}`} />
      <span className="text-[11.5px] leading-snug text-muted-foreground">{label}</span>
    </div>
  );
}

function TargetRow({
  on,
  label,
  value,
  mono,
  action,
}: {
  on: boolean;
  label: string;
  value: string;
  mono?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--card)] px-3.5 py-2.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? "bg-status-success" : "bg-[color:var(--s4)]"}`} aria-hidden />
      <span className="w-40 shrink-0 text-[12.5px] font-medium text-foreground">{label}</span>
      <span className={`min-w-0 flex-1 truncate text-[12px] ${mono ? "font-mono" : ""} ${on ? "text-foreground/80" : "text-muted-foreground"}`}>
        {value}
      </span>
      {action}
    </div>
  );
}
