import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    key: "library",
    label: "Components",
    to: "/w/$workspace/p/$project/components",
    match: (p) => p.endsWith("/components"),
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
    label: "Visual editor",
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
    label: "Visual editor",
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
    key: "library",
    label: "Components",
    to: "/w/$workspace/p/$project/components",
    match: (p) => p.endsWith("/components"),
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

/** Space reserved for the "+N" chip (incl. its gap) when tabs overflow. */
const CHIP_RESERVE = 48;
const TAB_GAP = 2; // gap-0.5

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

  // Overflow into the "+N" chip: a hidden measuring strip renders every tab
  // with the real classes; on resize we count how many fit in the container
  // (reserving room for the chip) and fold the rest into a dropdown.
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(tabs.length);
  const tabKeys = tabs.map((t) => t.key).join(",");

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const compute = () => {
      const avail = container.clientWidth;
      const widths = Array.from(measure.children).map((c) => (c as HTMLElement).offsetWidth);
      if (widths.length === 0) return;
      const full = widths.reduce((a, b) => a + b, 0) + TAB_GAP * (widths.length - 1);
      if (full <= avail) {
        setVisibleCount(widths.length);
        return;
      }
      let total = 0;
      let count = 0;
      for (let i = 0; i < widths.length; i++) {
        const next = total + widths[i] + (i > 0 ? TAB_GAP : 0);
        if (next + TAB_GAP + CHIP_RESERVE > avail) break;
        total = next;
        count++;
      }
      setVisibleCount(Math.max(1, count));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    return () => ro.disconnect();
    // Re-measure when the tab set itself changes (role/device/delivery).
  }, [tabKeys]);

  const visible = tabs.slice(0, visibleCount);
  const hidden = tabs.slice(visibleCount);
  const hiddenActive = hidden.some((t) => t.match(pathname, scope, view));

  const tabClass = (active: boolean) =>
    `relative inline-flex h-12 shrink-0 items-center rounded-md px-2.5 text-[13px] tracking-[-0.01em] transition-colors lg:px-3 ${
      active ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1 overflow-hidden">
      {/* Invisible measuring strip — same markup, never interactive. The
          zero-height overflow-hidden wrapper keeps its width from creating
          scrollable overflow (focus would scroll the real strip sideways). */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-hidden">
        <div ref={measureRef} className="invisible flex w-max items-center">
          {tabs.map((t) => (
            <span key={t.key} className={tabClass(false)}>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex h-12 items-center justify-center gap-0.5 px-1">
        {visible.map((t) => {
          const active = t.match(pathname, scope, view);
          return (
            <Link
              key={t.key}
              to={t.to as "/w/$workspace/p/$project/editor"}
              params={{ workspace: wsSlug, project: projectSlug }}
              search={t.search as never}
              preload="intent"
              className={tabClass(active)}
            >
              {t.label}
              {active && (
                <span className="pointer-events-none absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
        {hidden.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`${hidden.length} more tabs`}
                className={`relative inline-flex h-7 shrink-0 items-center rounded-md px-2 text-[12px] font-medium transition-colors ${
                  hiddenActive
                    ? "bg-[color:var(--s4)] text-foreground"
                    : "bg-[color:var(--s3)] text-muted-foreground hover:bg-[color:var(--s4)] hover:text-foreground"
                }`}
              >
                +{hidden.length}
                {hiddenActive && (
                  <span className="pointer-events-none absolute inset-x-2 -bottom-[11px] h-[2px] rounded-full bg-primary" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-[180px] p-1">
              {hidden.map((t) => {
                const active = t.match(pathname, scope, view);
                return (
                  <DropdownMenuItem key={t.key} asChild className="text-[13px]">
                    <Link
                      to={t.to as "/w/$workspace/p/$project/editor"}
                      params={{ workspace: wsSlug, project: projectSlug }}
                      search={t.search as never}
                      preload="intent"
                    >
                      <span className={`flex-1 ${active ? "font-medium text-foreground" : ""}`}>{t.label}</span>
                      {active && <Check className="h-3.5 w-3.5 text-primary" />}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
