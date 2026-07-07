import { createFileRoute } from "@tanstack/react-router";
import { FormsDashboard } from "@/components/cms/forms/FormsDashboard";

export const Route = createFileRoute("/w/$workspace/p/$project/forms/")({
  component: FormsDashboard,
});
