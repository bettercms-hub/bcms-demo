import { createFileRoute } from "@tanstack/react-router";
import { SettingsHeader } from "@/components/cms/SettingsSubNav";
import { Slack, Github, Cloud, Triangle, Zap, MessageSquare, FileText, type LucideIcon } from "lucide-react";

export const Route = createFileRoute("/w/$workspace/settings/integrations")({
  component: Integrations,
});

interface Integration {
  name: string;
  description: string;
  icon: LucideIcon;
  accent: string;
}

const INTEGRATIONS: Integration[] = [
  { name: "Slack", description: "Get notifications about publishing, comments, and team activity.", icon: Slack, accent: "text-[#E01E5A]" },
  { name: "GitHub", description: "Sync content changes with your repository workflow.", icon: Github, accent: "text-foreground" },
  { name: "Cloudflare", description: "Manage DNS, CDN, and edge deployments from BetterCMS.", icon: Cloud, accent: "text-[#F38020]" },
  { name: "Vercel", description: "Trigger preview and production deployments on publish.", icon: Triangle, accent: "text-foreground" },
  { name: "Zapier", description: "Connect BetterCMS to 5,000+ apps with no code.", icon: Zap, accent: "text-[#FF4F00]" },
  { name: "Discord", description: "Send activity updates to Discord channels.", icon: MessageSquare, accent: "text-[#5865F2]" },
  { name: "Notion", description: "Import content and keep documentation in sync.", icon: FileText, accent: "text-foreground" },
];

function Integrations() {
  return (
    <>
      <SettingsHeader
        title="Integrations"
        description="Connect external services to extend your workspace."
      />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((it) => (
          <article
            key={it.name}
            className="group relative flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-150 hover:bg-[color:var(--color-elevated)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-[color:var(--color-elevated)]">
                <it.icon className={`h-5 w-5 ${it.accent}`} strokeWidth={1.75} />
              </div>
              <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Coming soon
              </span>
            </div>
            <div>
              <div className="text-[14px] font-semibold text-foreground">{it.name}</div>
              <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">
                {it.description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
