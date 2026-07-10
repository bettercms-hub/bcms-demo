import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonCard, PageHeader } from "@/components/cms/SettingsSubNav";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/integrations")({
  component: () => (
    <>
      <PageHeader
        title="Integrations"
        description="Connect external services to this project. More connectors coming soon."
      />
      <ComingSoonCard />
    </>
  ),
});
