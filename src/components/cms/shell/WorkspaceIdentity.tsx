import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, ChevronsUpDown, LogOut, Plus, Search, Settings2, UserPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCMS } from "@/lib/cms/store";
import { WorkspacePlanBadge } from "@/components/cms/billing/PlanBadge";
import { WORKSPACE_PLANS } from "@/lib/billing/pricing";
import { ROLE_INFO, myRole } from "@/lib/workspace/my-role";
import { supabase } from "@/integrations/supabase/client";
import { disableGuest } from "@/lib/guest";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function WorkspaceIdentity({ wsSlug }: { wsSlug: string }) {
  const workspaces = useCMS((s) => s.workspaces);
  const current = workspaces.find((w) => w.slug === wsSlug);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    disableGuest();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpen(false);
    navigate({ to: "/auth", replace: true });
  }

  const others = useMemo(
    () => workspaces.filter((w) => w.slug !== wsSlug),
    [workspaces, wsSlug],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return others;
    return others.filter(
      (w) => w.name.toLowerCase().includes(q) || w.slug.toLowerCase().includes(q),
    );
  }, [others, query]);

  if (!current) return null;
  const initial = current.name[0]?.toUpperCase() ?? "?";
  const showSearch = workspaces.length > 5;
  const planName = WORKSPACE_PLANS[current.workspacePlan ?? "free"].name;
  const planBase = planName.toLowerCase().includes("workspace") ? planName : `${planName} workspace`;
  const planSubtitle = `${planBase} · ${ROLE_INFO[myRole(current.slug)].label}`;

  const goTo = (slug: string) => {
    setOpen(false);
    navigate({ to: "/w/$workspace", params: { workspace: slug } });
  };

  return (
    <div>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="group flex w-full items-center gap-2 rounded-lg bg-[color:var(--s4)] p-1.5 pr-2 text-left transition-colors hover:bg-[color:var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Switch workspace"
          >
            <div
              className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border border-[color:var(--border-strong)] text-[13px] font-bold uppercase text-white"
              style={{
                background: current.logoUrl
                  ? undefined
                  : "linear-gradient(135deg, var(--brand-plum), var(--brand-burgundy))",
              }}
            >
              {current.logoUrl ? (
                <img src={current.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--plum-text)]">
                {current.name}
              </div>
              <div className="truncate text-[11px] font-medium text-[color:var(--plum-muted)]">{planSubtitle}</div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[color:var(--plum-muted)] transition-colors duration-150 group-hover:text-[color:var(--plum-text)] group-data-[state=open]:text-[color:var(--plum-text)]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="w-[260px] p-1">
          <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Current workspace
          </DropdownMenuLabel>
          <div className="flex items-center gap-2 px-2 pb-2 pt-0.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-[color:var(--s3)] text-[11px] font-semibold uppercase text-foreground">
              {current.logoUrl ? (
                <img src={current.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{current.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">{current.slug}</div>
            </div>
            <Check className="h-3.5 w-3.5 text-primary" />
          </div>

          {showSearch && (
            <div className="mx-1 mb-1 flex items-center gap-1.5 rounded-md border border-border bg-[color:var(--color-panel)] px-2">
              <Search className="h-3 w-3 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find workspace…"
                className="h-7 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {query ? "Results" : "Switch to"}
          </DropdownMenuLabel>
          <div className="max-h-[264px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-[12px] text-muted-foreground">
                No workspaces match.
              </div>
            ) : (
              filtered.map((w) => (
                <DropdownMenuItem
                  key={w.id}
                  onSelect={() => goTo(w.slug)}
                  className="flex items-center gap-2"
                >
                  <div className="grid h-5 w-5 place-items-center rounded bg-[color:var(--color-elevated)] text-[10px] font-semibold">
                    {w.name[0]}
                  </div>
                  <span className="flex-1 truncate text-[13px]">{w.name}</span>
                  <span className="ml-auto rounded border border-border px-1 py-px text-[9.5px] font-medium text-muted-foreground">
                    {ROLE_INFO[myRole(w.slug)].label}
                  </span>
                  <WorkspacePlanBadge plan={w.workspacePlan ?? "free"} />
                </DropdownMenuItem>
              ))
            )}
          </div>

          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="text-[13px]">
            <Link to="/workspace/new">
              <Plus className="mr-2 h-3.5 w-3.5" /> Create workspace
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="text-[13px]">
            <Link to="/w/$workspace/settings" params={{ workspace: wsSlug }}>
              <Settings2 className="mr-2 h-3.5 w-3.5" /> Workspace settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="text-[13px]">
            <Link to="/w/$workspace/members" params={{ workspace: wsSlug }}>
              <UserPlus className="mr-2 h-3.5 w-3.5" /> Invite members
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleSignOut} className="text-[13px] text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
