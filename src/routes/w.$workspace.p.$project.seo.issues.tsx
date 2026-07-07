import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { pages as allPages } from "@/lib/cms/mock-data";
import { scanIssues, severityColor, type Severity } from "@/lib/seo/issues";

export const Route = createFileRoute("/w/$workspace/p/$project/seo/issues")({
  component: IssuesPage,
});

function IssuesPage() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project)!;
  const projectPages = allPages.filter((p) => p.projectId === pr.id);
  const issues = scanIssues(projectPages);
  const [expanded, setExpanded] = useState<string | null>(issues[0]?.id ?? null);

  const groups: { sev: Severity; items: typeof issues }[] = (
    ["critical", "high", "medium", "low"] as Severity[]
  ).map((sev) => ({ sev, items: issues.filter((i) => i.severity === sev) }));

  return (
    <>
      <header className="mb-6">
        <h1 className="text-[20px] font-semibold tracking-tight">Issues</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {issues.length} issue{issues.length === 1 ? "" : "s"} across {projectPages.length} page
          {projectPages.length === 1 ? "" : "s"}.
        </p>
      </header>

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.sev}>
            <h2 className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className={`rounded border px-1.5 py-0.5 text-[10px] ${severityColor(g.sev)}`}>
                {g.sev}
              </span>
              {g.items.length}
            </h2>
            {g.items.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-3 text-[13px] text-muted-foreground">
                None.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                {g.items.map((i, idx) => {
                  const open = expanded === i.id;
                  return (
                    <div key={i.id} className={idx > 0 ? "border-t border-border" : ""}>
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : i.id)}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[color:var(--color-row-hover)]"
                      >
                        {open ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium">{i.title}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {i.code}
                          </div>
                        </div>
                        <span className="text-[12px] text-muted-foreground">
                          {i.pageIds.length} page{i.pageIds.length === 1 ? "" : "s"}
                        </span>
                      </button>
                      {open && (
                        <div className="border-t border-border bg-muted/20 px-5 py-4">
                          <dl className="grid gap-3 text-[13px] md:grid-cols-3">
                            <Detail label="Problem">{i.problem}</Detail>
                            <Detail label="Impact">{i.impact}</Detail>
                            <Detail label="Recommended fix">{i.fix}</Detail>
                          </dl>
                          <div className="mt-4 flex items-start gap-3">
                            <div className="text-[12px] font-semibold text-muted-foreground">
                              Affected pages
                            </div>
                            <ul className="flex flex-wrap gap-1.5">
                              {i.pageIds.map((id) => {
                                const p = projectPages.find((x) => x.id === id);
                                if (!p) return null;
                                return (
                                  <li key={id}>
                                    <Link
                                      to="/w/$workspace/p/$project/pages/$pageId/seo"
                                      params={{
                                        workspace,
                                        project,
                                        pageId: p.id,
                                      }}
                                      className="inline-flex items-center rounded border border-border bg-card px-2 py-0.5 text-[11px] hover:bg-[color:var(--color-row-hover)]"
                                    >
                                      {p.title}
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <button
                              type="button"
                              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-[var(--primary-hover)]"
                            >
                              <Wrench className="h-3.5 w-3.5" />
                              Fix now
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-[12px] leading-relaxed text-foreground">{children}</dd>
    </div>
  );
}
