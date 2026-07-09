/**
 * cloneProject — one call that duplicates a whole project into a workspace:
 * the project shell + collections/schemas/entries (CMS store) and the pages
 * (pages store). Used by the "Clone" button on a shared template link and by
 * the dashboard's Duplicate action.
 */
import { projectActions } from "./store";
import { clonePagesTo } from "./pages-store";
import type { Project } from "./types";

export function cloneProject(
  sourceProjectId: string,
  targetWorkspaceId: string,
  name?: string,
): Project | undefined {
  const project = projectActions.clone(sourceProjectId, targetWorkspaceId, name);
  if (!project) return undefined;
  // Pages must be copied before the new project is rendered, or the pages
  // store would lazily seed it with the default marketing site.
  clonePagesTo(sourceProjectId, project.id);
  return project;
}
