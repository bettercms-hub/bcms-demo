import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/w/$workspace/p/$project/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/w/$workspace/p/$project/editor",
      params,
      replace: true,
    });
  },
});
