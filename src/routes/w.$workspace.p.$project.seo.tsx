import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SeoSubNav } from "@/components/cms/seo/SeoSubNav";
import { LockedFeature } from "@/components/cms/billing/FeatureGate";
import { siteHas } from "@/lib/billing/pricing";
import { getProjectBySlug } from "@/lib/cms/use-cms";

export const Route = createFileRoute("/w/$workspace/p/$project/seo")({
  beforeLoad: ({ params, location }) => {
    const base = `/w/${params.workspace}/p/${params.project}/seo`;
    if (location.pathname === base || location.pathname === base + "/") {
      throw redirect({ to: "/w/$workspace/p/$project/seo/pages", params });
    }
  },
  component: SeoLayout,
});

function SeoLayout() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project);
  const plan = pr?.sitePlan ?? "free";

  if (!siteHas(plan, "seo")) {
    return (
      <div className="flex min-h-0 flex-1">
        <LockedFeature
          featureKey="seo"
          title="SEO and AEO"
          blurb="Meta, schema, sitemaps, redirects and robots for this site."
          wsSlug={workspace}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <SeoSubNav wsSlug={workspace} projectSlug={project} />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-5xl px-8 py-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
