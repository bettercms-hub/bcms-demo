import { Link } from "@tanstack/react-router";
import { getDelivery } from "@/lib/cms/delivery";
import { useCMS } from "@/lib/cms/store";
import { useEffectiveRole, visibleTabs } from "@/lib/workspace/my-role";
import { useViewportTier } from "@/lib/device";
import { deviceVisibleTabs } from "@/lib/device-caps";

type Scope = "pages" | "collections" | "components";

interface Props {
  wsSlug: string;
  projectSlug: string;
  pathname: string;
  scope?: Scope;
  view?: "pages" | "content";
}

interface Tab {
  key: string;
  label: string;
  to: string;
  search?: Record<string, unknown>;
  match: (pathname: string, scope?: Scope, view?: string) => boolean;
}

// Headless projects don't own hosting, but they DO own the website's data:
// content + SEO, forms, analytics, schema, redirects, sitemap and tracking —
// all served to the customer's own frontend over the API.
const HEADLESS_TABS: Tab[] = [
  {
    key: "content",
    label: "Pages",
    to: "/w/$workspace/p/$project/content",
    match: (p, _s, v) => /\/content$/.test(p) && v !== "content",
  },
  {
    key: "collections",
    label: "Content",
    to: "/w/$workspace/p/$project/content",
    search: { view: "content" },
    match: (p, s, v) => (/\/content$/.test(p) && v === "content") || (p.includes("/editor") && s !== "components"),
  },
  {
    key: "workflow",
    label: "Workflow",
    to: "/w/$workspace/p/$project/workflow",
    match: (p) => p.includes("/workflow"),
  },
  {
    key: "schema",
    label: "Schema",
    to: "/w/$workspace/p/$project/schema",
    match: (p) => p.endsWith("/schema") && !p.includes("/seo"),
  },
  {
    key: "media",
    label: "Media",
    to: "/w/$workspace/p/$project/media",
    match: (p) => p.includes("/media"),
  },
  {
    key: "visual",
    label: "Visual Editor",
    to: "/w/$workspace/p/$project/visual",
    match: (p) => p.includes("/visual"),
  },
  {
    key: "agent",
    label: "Agent",
    to: "/w/$workspace/p/$project/agent",
    match: (p) => p.endsWith("/agent"),
  },
  {
    key: "seo",
    label: "SEO",
    to: "/w/$workspace/p/$project/seo",
    match: (p) => /\/seo(\/|$)/.test(p) && !p.includes("/settings/seo"),
  },
  {
    key: "forms",
    label: "Forms",
    to: "/w/$workspace/p/$project/forms",
    match: (p) => p.includes("/forms"),
  },
  {
    key: "analytics",
    label: "Analytics",
    to: "/w/$workspace/p/$project/analytics",
    match: (p) => p.includes("/analytics") && !p.includes("/settings/analytics"),
  },
  {
    key: "hosting",
    label: "Hosting",
    to: "/w/$workspace/p/$project/hosting",
    match: (p) => p.includes("/hosting"),
  },
  {
    key: "settings",
    label: "Settings",
    to: "/w/$workspace/p/$project/settings/general",
    // API, Webhooks, Tracking and the integration guide all live under Settings.
    match: (p) => p.includes("/settings"),
  },
];

const TABS: Tab[] = [
  {
    key: "content",
    label: "Pages",
    to: "/w/$workspace/p/$project/content",
    match: (p, _s, v) => /\/content$/.test(p) && v !== "content",
  },
  {
    key: "collections",
    label: "Content",
    to: "/w/$workspace/p/$project/content",
    search: { view: "content" },
    match: (p, s, v) => (/\/content$/.test(p) && v === "content") || (p.includes("/editor") && s !== "components"),
  },
  {
    key: "workflow",
    label: "Workflow",
    to: "/w/$workspace/p/$project/workflow",
    match: (p) => p.includes("/workflow"),
  },
  {
    key: "visual",
    label: "Visual Editor",
    to: "/w/$workspace/p/$project/visual",
    match: (p) => p.includes("/visual"),
  },
  {
    key: "agent",
    label: "Agent",
    to: "/w/$workspace/p/$project/agent",
    match: (p) => p.endsWith("/agent"),
  },
  {
    key: "components",
    label: "Schema",
    to: "/w/$workspace/p/$project/schema",
    match: (p) => p.endsWith("/schema") && !p.includes("/seo"),
  },
  {
    key: "media",
    label: "Media",
    to: "/w/$workspace/p/$project/media",
    match: (p) => p.endsWith("/media") || p.includes("/media"),
  },
  {
    key: "forms",
    label: "Forms",
    to: "/w/$workspace/p/$project/forms",
    match: (p) => p.includes("/forms"),
  },
  {
    key: "analytics",
    label: "Analytics",
    to: "/w/$workspace/p/$project/analytics",
    match: (p) => p.includes("/analytics") && !p.includes("/settings/analytics"),
  },
  {
    key: "seo",
    label: "SEO",
    to: "/w/$workspace/p/$project/seo",
    match: (p) => /\/seo(\/|$)/.test(p) && !p.includes("/settings/seo"),
  },
  {
    key: "settings",
    label: "Settings",
    to: "/w/$workspace/p/$project/settings",
    match: (p) => p.includes("/settings") && !p.includes("/settings/publishing"),
  },
  {
    key: "publishing",
    label: "Publishing",
    to: "/w/$workspace/p/$project/settings/publishing",
    match: (p) => p.includes("/settings/publishing"),
  },
];

export function ProjectNav({ wsSlug, projectSlug, pathname, scope, view }: Props) {
  // Reactive: switching delivery mode on the Delivery page swaps the nav live.
  const pr = useCMS((s) =>
    s.projects.find((p) => p.slug === projectSlug && s.workspaces.some((w) => w.slug === wsSlug && w.id === p.workspaceId)),
  );
  // Role-scoped nav: marketers lose the developer surfaces, editors keep
  // content tools only, reviewers see just enough to review.
  const { effective } = useEffectiveRole(wsSlug);
  const allowed = visibleTabs(effective);
  // Device filter stacks on the role filter: phones keep the editor tabs only.
  const tier = useViewportTier();
  const deviceAllowed = deviceVisibleTabs(tier);
  const tabs = (getDelivery(pr).hosted ? TABS : HEADLESS_TABS).filter(
    (t) => allowed.has(t.key) && (deviceAllowed === null || deviceAllowed.has(t.key)),
  );
  return (
    <div className="flex h-12 items-center gap-0.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t) => {
        const active = t.match(pathname, scope, view);
        return (
          <Link
            key={t.key}
            to={t.to as "/w/$workspace/p/$project/editor"}
            params={{ workspace: wsSlug, project: projectSlug }}
            search={t.search as never}
            preload="intent"
            className={`relative inline-flex h-12 shrink-0 items-center rounded-md px-2.5 text-[13px] transition-colors lg:px-3 ${
              active
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {active && (
              <span className="pointer-events-none absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
