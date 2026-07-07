import { createFileRoute } from "@tanstack/react-router";
import { SettingsHeader, SettingsRow, SettingsSection } from "@/components/cms/SettingsSubNav";
import { useCMS } from "@/lib/cms/store";
import { StatusBadge } from "@/components/cms/ui/StatusBadge";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/w/$workspace/settings/notifications")({
  component: Notifications,
});

const CHANNELS = [
  { id: "page.published", label: "Page published", desc: "Sent when any page transitions to published." },
  { id: "page.review", label: "Submitted for review", desc: "Sent to reviewers when content is ready." },
  { id: "member.invited", label: "Member invited", desc: "Workspace admins are notified of new invites." },
  { id: "deploy.failed", label: "Deployment failed", desc: "Sent to developers on failed deploys." },
  { id: "billing.usage", label: "Usage threshold", desc: "When any metric crosses 80% of plan limit." },
];

function Notifications() {
  const items = useCMS((s) => s.notifications.slice(0, 10));
  return (
    <>
      <SettingsHeader title="Notifications" description="Choose what events trigger notifications and where they go." />

      <SettingsSection title="Email preferences" description="Per-event delivery for your workspace.">
        {CHANNELS.map((c) => (
          <SettingsRow key={c.id} label={c.label} description={c.desc}>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Switch defaultChecked /> Email
              </label>
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Switch /> In-app
              </label>
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Switch /> Slack
              </label>
            </div>
          </SettingsRow>
        ))}
      </SettingsSection>

      <SettingsSection title="Recent notifications">
        <div className="-mx-5">
          {items.length === 0 ? (
            <div className="px-5 py-6 text-center text-[13px] text-muted-foreground">No notifications yet.</div>
          ) : (
            items.map((n) => (
              <div key={n.id} className="flex items-start gap-3 border-b border-border px-5 py-3 last:border-b-0">
                <StatusBadge
                  label={n.kind}
                  tone={n.kind === "error" ? "danger" : n.kind === "warning" ? "warning" : n.kind === "success" ? "success" : "info"}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-foreground">{n.title}</div>
                  {n.body && <div className="mt-0.5 text-[12px] text-muted-foreground">{n.body}</div>}
                </div>
                <div className="shrink-0 text-[11px] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </SettingsSection>
    </>
  );
}
