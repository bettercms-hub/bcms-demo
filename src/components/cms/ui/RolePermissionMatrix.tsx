import { Check, Minus } from "lucide-react";
import {
  PERMISSION_RESOURCES,
  SITE_PERMISSION_MATRIX,
  SITE_ROLES,
  SITE_ROLE_LABELS,
} from "@/lib/cms/permissions";
import type { PermissionLevel, PermissionResource, SiteRole } from "@/lib/cms/types";

const RESOURCE_LABELS: Record<PermissionResource, string> = {
  pages: "Pages",
  components: "Components",
  collections: "Collections",
  media: "Media",
  seo: "SEO",
  publishing: "Publishing",
  analytics: "Analytics",
  settings: "Settings",
};

function Cell({ perm }: { perm: PermissionLevel }) {
  if (perm.publish) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" /> Publish</span>;
  }
  if (perm.edit) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary"><Check className="h-3 w-3" /> Edit</span>;
  }
  if (perm.view) {
    return <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Check className="h-3 w-3" /> View</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50"><Minus className="h-3 w-3" /></span>;
}

interface Props {
  highlightRole?: SiteRole;
}

export function RolePermissionMatrix({ highlightRole }: Props) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="h-9 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Resource
            </th>
            {SITE_ROLES.map((r) => (
              <th
                key={r}
                className={`h-9 px-3 text-[11px] font-semibold uppercase tracking-wider ${
                  highlightRole === r ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {SITE_ROLE_LABELS[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_RESOURCES.map((res) => (
            <tr key={res} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2.5 text-[13px] font-medium text-foreground">
                {RESOURCE_LABELS[res]}
              </td>
              {SITE_ROLES.map((r) => (
                <td
                  key={r}
                  className={`px-3 py-2.5 ${highlightRole === r ? "bg-primary/5" : ""}`}
                >
                  <Cell perm={SITE_PERMISSION_MATRIX[r][res]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
