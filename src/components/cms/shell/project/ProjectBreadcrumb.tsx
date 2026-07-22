import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Logo } from "../Logo";

interface Props {
  wsSlug: string;
  wsName: string;
  projectName: string;
  projectSlug: string;
}

/**
 * V2 breadcrumb — logo chip, hairline divider, then "Projects > name". The
 * workspace hop lives behind "Projects" (its name still shows in the link
 * title for multi-workspace users).
 */
export function ProjectBreadcrumb({ wsSlug, wsName, projectName, projectSlug }: Props) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1 text-[13px] text-muted-foreground"
    >
      <Link
        to="/"
        aria-label="BetterCMS home"
        className="flex shrink-0 items-center rounded px-1 py-0.5 transition-colors hover:bg-[color:var(--color-row-hover)]"
      >
        <Logo className="h-[18px] w-auto" />
      </Link>
      <span aria-hidden className="mx-1 hidden h-4 w-px shrink-0 bg-border sm:block" />
      <Link
        to="/w/$workspace"
        params={{ workspace: wsSlug }}
        title={`${wsName} projects`}
        className="hidden shrink-0 rounded px-1 py-0.5 transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground sm:block"
      >
        Projects
      </Link>
      <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/60 sm:block" strokeWidth={1.75} />
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
