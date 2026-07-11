import { createFileRoute } from "@tanstack/react-router";
import { SearchHub } from "@/components/cms/search/SearchHub";

export const Route = createFileRoute("/w/$workspace/p/$project/search")({
  component: SearchHub,
});
