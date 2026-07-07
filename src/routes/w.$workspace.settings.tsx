import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { SettingsDashboard } from "@/components/cms/shell/SettingsDashboard";
import { WorkspaceSubNav } from "@/components/cms/workspace/WorkspaceSubNav";

export const Route = createFileRoute("/w/$workspace/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const { workspace } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/w/${workspace}/settings`;
  const onIndex = pathname === base || pathname === base + "/";

  if (onIndex) {
    return <SettingsDashboard wsSlug={workspace} />;
  }

  return (
    <div className="flex min-h-0 flex-1">
      <WorkspaceSubNav wsSlug={workspace} />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-5xl px-8 py-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
