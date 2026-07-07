/**
 * GenerateMenu — the quiet entry point for the page generators. One button
 * next to "New page"; the generators themselves live in focused dialogs so
 * the Pages hub stays clean.
 */
import { useState } from "react";
import { ScanSearch, Sparkles, Users } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { SitePlanId } from "@/lib/cms/types";
import { AbmPageDialog } from "./AbmPageDialog";
import { SeoPagesDialog } from "./SeoPagesDialog";

export function GenerateMenu({
  projectId,
  workspace,
  project,
  sitePlan,
}: {
  projectId: string;
  workspace: string;
  project: string;
  sitePlan: SitePlanId;
}) {
  const [open, setOpen] = useState<"seo" | "abm" | null>(null);
  const dialogProps = { projectId, workspace, project, sitePlan, onClose: () => setOpen(null) };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Sparkles className="mr-1 h-3.5 w-3.5 text-primary" />
            Generate
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[280px]">
          <DropdownMenuItem className="items-start py-2 text-[13px]" onSelect={() => setOpen("seo")}>
            <ScanSearch className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="block font-medium">SEO pages from keywords</span>
              <span className="block text-[11px] text-muted-foreground">Paste a list or a CSV, get one draft page per keyword</span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem className="items-start py-2 text-[13px]" onSelect={() => setOpen("abm")}>
            <Users className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="block font-medium">ABM page for an account</span>
              <span className="block text-[11px] text-muted-foreground">One page personalized for one target account</span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {open === "seo" && <SeoPagesDialog {...dialogProps} />}
      {open === "abm" && <AbmPageDialog {...dialogProps} />}
    </>
  );
}
