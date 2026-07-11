import { createFileRoute, redirect } from "@tanstack/react-router";

// Search moved under SEO. Keep the old path alive for bookmarks / deep links.
export const Route = createFileRoute("/w/$workspace/p/$project/search")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/w/$workspace/p/$project/seo/search", params });
  },
});
