/**
 * NotificationsList — the shared notification feed, used by the top-bar bell
 * dropdown and the workspace notification settings page. Reads the store,
 * shows unread state, and supports mark-read (per item) + mark-all-read.
 */
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, XCircle } from "lucide-react";
import { useCMS, notificationActions } from "@/lib/cms/store";
import { formatRelative } from "@/lib/cms/format-time";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/cms/types";

const KIND: Record<Notification["kind"], { icon: typeof Info; tone: string }> = {
  info: { icon: Info, tone: "text-sky-500" },
  success: { icon: CheckCircle2, tone: "text-emerald-500" },
  warning: { icon: AlertTriangle, tone: "text-amber-500" },
  error: { icon: XCircle, tone: "text-rose-500" },
};

/** Notifications for a workspace, newest first. */
export function useNotifications(workspaceId: string | undefined): Notification[] {
  return useCMS((s) =>
    workspaceId
      ? [...s.notifications.filter((n) => n.workspaceId === workspaceId)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : [],
  );
}

export function useUnreadCount(workspaceId: string | undefined): number {
  return useCMS((s) => (workspaceId ? s.notifications.filter((n) => n.workspaceId === workspaceId && !n.readAt).length : 0));
}

export function NotificationsList({
  workspaceId,
  max,
  onNavigate,
}: {
  workspaceId: string;
  /** Cap the number shown (the bell shows a few; the settings page shows all). */
  max?: number;
  /** Called when a row is activated, so a dropdown host can close. */
  onNavigate?: () => void;
}) {
  const all = useNotifications(workspaceId);
  const items = max ? all.slice(0, max) : all;

  if (all.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <Bell className="mx-auto h-5 w-5 text-muted-foreground/60" />
        <div className="mt-2 text-[12.5px] font-medium text-foreground">You're all caught up</div>
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">New activity will appear here.</div>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[color:var(--border-hairline)]">
      {items.map((n) => {
        const meta = KIND[n.kind];
        const Icon = meta.icon;
        const unread = !n.readAt;
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => {
                if (unread) notificationActions.markRead(n.id);
                onNavigate?.();
              }}
              className={cn(
                "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--color-row-hover)]",
                unread && "bg-[color:color-mix(in_oklab,var(--primary)_4%,transparent)]",
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.tone)} strokeWidth={1.9} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className={cn("truncate text-[12.5px]", unread ? "font-semibold text-foreground" : "font-medium text-foreground/90")}>{n.title}</span>
                  {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </span>
                {n.body && <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">{n.body}</span>}
                <span className="mt-0.5 block text-[10.5px] text-muted-foreground/70">{formatRelative(n.createdAt)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Small header with a mark-all-read action; shared by both hosts. */
export function NotificationsHeader({ workspaceId, title = "Notifications" }: { workspaceId: string; title?: string }) {
  const unread = useUnreadCount(workspaceId);
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
        {title}
        {unread > 0 && (
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9.5px] font-semibold text-primary-foreground">{unread}</span>
        )}
      </div>
      {unread > 0 && (
        <button
          type="button"
          onClick={() => notificationActions.markAllRead(workspaceId)}
          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
        </button>
      )}
    </div>
  );
}
