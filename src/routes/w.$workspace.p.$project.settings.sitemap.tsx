import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/sitemap")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/w/$workspace/p/$project/seo/sitemap", params });
  },
});
