import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Logo } from "../Logo";

interface Props {
  wsSlug: string;
  wsName: string;
  projectName: string;
  projectSlug: string;
}

export function ProjectBreadcrumb({ wsSlug, wsName, projectName, projectSlug }: Props) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1 text-[12.5px] text-muted-foreground"
    >
      <Link
        to="/"
        aria-label="BetterCMS home"
        className="flex shrink-0 items-center rounded px-1 py-0.5 transition-colors hover:bg-[color:var(--color-row-hover)]"
      >
        <Logo className="h-[18px] w-auto" />
      </Link>
      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" strokeWidth={2} />
      <Link
        to="/w/$workspace"
        params={{ workspace: wsSlug }}
        className="shrink-0 rounded px-1 py-0.5 transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
      >
        {wsName}
      </Link>
      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" strokeWidth={2} />
      <Link
        to="/w/$workspace/p/$project"
        params={{ workspace: wsSlug, project: projectSlug }}
        className="min-w-0 truncate rounded px-1 py-0.5 font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
      >
        {projectName}
      </Link>
    </nav>
  );
}
