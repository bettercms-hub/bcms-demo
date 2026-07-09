import { createFileRoute } from "@tanstack/react-router";
import { SettingsHeader, SettingsRow, SettingsSection } from "@/components/cms/SettingsSubNav";
import { getWorkspaceBySlug } from "@/lib/cms/use-cms";
import { notificationActions } from "@/lib/cms/store";
import { NotificationsList, useUnreadCount } from "@/components/cms/shell/NotificationsList";
import { Switch } from "@/components/ui/switch";
import { CheckCheck } from "lucide-react";

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
  const { workspace } = Route.useParams();
  const ws = getWorkspaceBySlug(workspace);
  const unread = useUnreadCount(ws?.id);
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

      <SettingsSection
        title="Recent notifications"
        description={unread > 0 ? `${unread} unread` : "You're all caught up"}
        action={
          ws && unread > 0 ? (
            <button
              type="button"
              onClick={() => notificationActions.markAllRead(ws.id)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
            </button>
          ) : undefined
        }
        flush
      >
        {ws ? <NotificationsList workspaceId={ws.id} /> : <div className="px-5 py-6 text-center text-[13px] text-muted-foreground">No notifications.</div>}
      </SettingsSection>
    </>
  );
}
