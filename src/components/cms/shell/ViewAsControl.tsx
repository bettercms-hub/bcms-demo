/**
 * ViewAsControl — the global "view as role" lens, lives in the top bar.
 *
 * Roles cascade down: preview the whole app as any role below your own. The
 * shell (project nav, workspace nav, editors, publish actions) already reads
 * the effective role from the same global store, so switching here re-renders
 * everything at once. Renders nothing outside a workspace, or when you have no
 * roles below you (a reviewer has nothing to preview).
 *
 * Responsive: a full pill (icon + role + caret) on sm and up, an icon-only
 * button on phones. When you are previewing a role that is not your own the
 * button turns indigo, so the lens is obvious everywhere in the app.
 */
import { useParams } from "@tanstack/react-router";
import { Check, ChevronDown, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ROLE_INFO,
  ROLE_ORDER,
  canViewAs,
  setViewAs,
  useEffectiveRole,
} from "@/lib/workspace/my-role";

export function ViewAsControl() {
  const { workspace } = useParams({ strict: false }) as { workspace?: string };
  const { actual, effective } = useEffectiveRole(workspace ?? "");

  if (!workspace) return null;
  const options = ROLE_ORDER.filter((r) => canViewAs(actual, r));
  if (options.length <= 1) return null; // reviewer, or nothing below you

  const previewing = effective !== actual;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={`Preview the app as a role below yours. You are ${ROLE_INFO[actual].label}.`}
          aria-label={`View as role, currently ${ROLE_INFO[effective].label}`}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2.5",
            previewing
              ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300"
              : "border-[color:var(--color-border)] bg-[color:var(--card)] text-muted-foreground hover:text-foreground",
          )}
        >
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden max-w-[120px] truncate sm:inline">{ROLE_INFO[effective].label}</span>
          <ChevronDown className="hidden h-3 w-3 shrink-0 opacity-60 sm:inline" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[264px]">
        <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          View as
        </div>
        {options.map((r) => {
          const m = ROLE_INFO[r];
          const Icon = m.icon;
          return (
            <DropdownMenuItem
              key={r}
              className="items-start gap-2 text-[13px]"
              onSelect={() => setViewAs(r === actual ? null : r)}
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1">
                <span className="block font-medium">
                  {m.label}
                  {r === actual && (
                    <span className="ml-1 text-[10.5px] font-normal text-muted-foreground">(you)</span>
                  )}
                </span>
                <span className="block text-[11px] text-muted-foreground">{m.blurb}</span>
              </span>
              {effective === r && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
