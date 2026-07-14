import { Link, useRouterState } from "@tanstack/react-router";

interface Tab {
  key: string;
  label: string;
  to: string;
}

interface Props {
  wsSlug: string;
  projectSlug: string;
}

const TABS: Tab[] = [
  { key: "pages", label: "Pages", to: "/w/$workspace/p/$project/seo/pages" },
  { key: "search", label: "Search", to: "/w/$workspace/p/$project/seo/search" },
  { key: "schema", label: "Schema markup", to: "/w/$workspace/p/$project/seo/schema" },
  { key: "sitemap", label: "Sitemap", to: "/w/$workspace/p/$project/seo/sitemap" },
  { key: "rss", label: "RSS feed", to: "/w/$workspace/p/$project/seo/rss" },
  { key: "delivery", label: "AI delivery", to: "/w/$workspace/p/$project/seo/delivery" },
  { key: "robots", label: "Robots", to: "/w/$workspace/p/$project/seo/robots" },
  { key: "redirects", label: "Redirects", to: "/w/$workspace/p/$project/seo/redirects" },
  { key: "issues", label: "Issues", to: "/w/$workspace/p/$project/seo/issues" },
];

export function SeoSubNav({ wsSlug, projectSlug }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="w-[200px] shrink-0 border-r border-border bg-background">
      <div className="px-4 pb-3 pt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        SEO
      </div>
      <nav className="px-2 pb-6">
        {TABS.map((t) => {
          const href = t.to
            .replace("$workspace", wsSlug)
            .replace("$project", projectSlug);
          const active = pathname.startsWith(href);
          return (
            <Link
              key={t.key}
              to={t.to as "/w/$workspace/p/$project/seo"}
              params={{ workspace: wsSlug, project: projectSlug }}
              className={`relative my-px flex h-8 items-center rounded-md px-3 text-[13px] transition-colors ${
                active
                  ? "bg-[color:var(--color-row-selected)] text-foreground"
                  : "text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
              }`}
            >
              {active && (
                <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-primary" />
              )}
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
