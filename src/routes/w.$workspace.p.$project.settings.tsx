import { Link, Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { SettingsSubNav, type SettingsNavItem } from "@/components/cms/SettingsSubNav";
import { getDelivery } from "@/lib/cms/delivery";
import { useCMS } from "@/lib/cms/store";
import { canSeeDeveloper, useEffectiveRole } from "@/lib/workspace/my-role";

export const Route = createFileRoute("/w/$workspace/p/$project/settings")({
  beforeLoad: ({ params, location }) => {
    const base = `/w/${params.workspace}/p/${params.project}/settings`;
    if (location.pathname === base || location.pathname === base + "/") {
      throw redirect({ to: "/w/$workspace/p/$project/settings/general", params });
    }
  },
  component: ProjectSettingsLayout,
});

function ProjectSettingsLayout() {
  const { workspace, project } = Route.useParams();
  // Reactive: the sub-nav re-composes live when delivery mode changes.
  const pr = useCMS((s) =>
    s.projects.find((p) => p.slug === project && s.workspaces.some((w) => w.slug === workspace && w.id === p.workspaceId)),
  );
  const base = `/w/${workspace}/p/${project}/settings`;
  // Capability-driven nav: one content core, delivery decides which surfaces
  // exist. Hosted brings publishing/domains/hosting ops; the API capability
  // brings the developer surfaces. Hybrid gets both.
  const d = getDelivery(pr);
  // Marketers get the content/publishing surfaces; developer & operations
  // surfaces (Delivery, API, Webhooks, Custom Code, Environment, Backups) are
  // for developers and admins only.
  const { effective } = useEffectiveRole(workspace);
  const showDev = canSeeDeveloper(effective);
  const items: SettingsNavItem[] = [
    { label: "General", href: `${base}/general`, group: "Project" },
    { label: "Brand", href: `${base}/brand`, group: "Project" },
    { label: "Access", href: `${base}/access`, group: "Project" },
    { label: "Plan", href: `${base}/plan`, group: "Project" },
    { label: "Usage", href: `${base}/usage`, group: "Project" },
    ...(showDev ? [{ label: "Delivery", href: `${base}/delivery`, group: "Project" }] : []),
    ...(d.hosted
      ? [
          { label: "Publishing", href: `${base}/publishing`, group: "Publishing" },
          { label: "Domains", href: `${base}/domains`, group: "Publishing" },
          { label: "Redirects", href: `${base}/redirects`, group: "Publishing" },
        ]
      : []),
    ...(showDev && d.api
      ? [
          { label: "API", href: `${base}/api`, group: "Developer" },
          { label: "Webhooks", href: `${base}/webhooks`, group: "Developer" },
          { label: "External agents", href: `${base}/agents`, group: "Developer" },
          { label: "Integration guide", href: `${base}/setup`, group: "Developer" },
        ]
      : []),
    // Custom code applies to every delivery mode: managed hosting injects it
    // at the edge, headless frontends fetch it over the API and inject it.
    ...(showDev
      ? [
          { label: "Custom Code", href: `${base}/code`, group: "Developer" },
          { label: "Environment", href: `${base}/env`, group: "Developer" },
        ]
      : []),
    ...(showDev && d.hosted ? [{ label: "Backups", href: `${base}/backups`, group: "Operations" }] : []),
    { label: "Integrations", href: `${base}/integrations`, group: d.hosted ? "Operations" : "Publishing" },
  ];

  return (
    <div className="flex min-h-0 flex-1 max-md:flex-col">
      <SettingsSubNav items={items} title="Project settings" />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-12 lg:px-14">
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex items-center gap-1 text-[12px] text-muted-foreground"
          >
            <Link
              to="/w/$workspace"
              params={{ workspace }}
              className="transition-colors hover:text-foreground"
            >
              {workspace}
            </Link>
            <ChevronRight className="h-3 w-3 text-muted-foreground/60" aria-hidden />
            <Link
              to="/w/$workspace/p/$project"
              params={{ workspace, project }}
              className="transition-colors hover:text-foreground"
            >
              {pr?.name ?? project}
            </Link>
            <ChevronRight className="h-3 w-3 text-muted-foreground/60" aria-hidden />
            <span className="text-foreground">Settings</span>
          </nav>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
