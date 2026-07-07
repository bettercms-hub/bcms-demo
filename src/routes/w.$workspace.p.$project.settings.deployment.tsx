import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/deployment")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/w/$workspace/p/$project/settings/publishing", params });
  },
});
