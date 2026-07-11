import { createFileRoute } from "@tanstack/react-router";
import { SearchHub } from "@/components/cms/search/SearchHub";

// Site search lives under SEO now — it's a "how the site is found" concern,
// not a top-level nav item people reach for daily.
export const Route = createFileRoute("/w/$workspace/p/$project/seo/search")({
  component: SearchHub,
});
