import {
  getCollection,
  getComponent,
  getEntriesForCollection,
  getMedia,
  getPage,
  getProjectBySlug,
  getSectionsForPage,
  getWebsiteForProject,
} from "./use-cms";
import { BLOCK_REGISTRY } from "./blocks/registry";
import { pathKey } from "./blocks/operations";
import type { Block, TreeNode } from "./types";

function blocksToTreeNodes(
  sectionId: string,
  blocks: Block[] | undefined,
  parentPath: number[] = [],
): TreeNode[] {
  if (!blocks || blocks.length === 0) return [];
  return blocks.map((b, i) => {
    const path = [...parentPath, i];
    const def = BLOCK_REGISTRY[b.kind];
    const previewText =
      (typeof b.props.text === "string" && b.props.text) ||
      (typeof b.props.title === "string" && b.props.title) ||
      (typeof b.props.label === "string" && b.props.label) ||
      "";
    const label = previewText
      ? `${def?.label ?? b.kind} · ${previewText}`
      : def?.label ?? b.kind;
    const kids = blocksToTreeNodes(sectionId, b.children, path);
    return {
      id: `block:${sectionId}:${pathKey(path)}`,
      label,
      kind: "block" as const,
      refId: b.id,
      children: kids.length ? kids : undefined,
    };
  });
}

/**
 * Build the Content Tree for a project. This is the single source of truth
 * for project navigation — both the left-rail tree and any future surfaces
 * (palette, search, breadcrumbs) should derive from this shape.
 */
export function buildProjectTree(workspaceSlug: string, projectSlug: string): TreeNode[] {
  const project = getProjectBySlug(workspaceSlug, projectSlug);
  if (!project) return [];
  const website = getWebsiteForProject(project.id);

  const websiteNode: TreeNode = {
    id: "grp:website",
    label: "Pages",
    kind: "group",
    children: (website?.pageIds ?? []).map((pid) => {
      const page = getPage(pid)!;
      return {
        id: `page:${page.id}`,
        label: page.title,
        kind: "page",
        refId: page.id,
        children: getSectionsForPage(page.id).map((s) => {
          const blockKids = s.componentId ? [] : blocksToTreeNodes(s.id, s.blocks);
          return {
            id: `section:${s.id}`,
            label: s.componentId ? `${s.name} · bound` : s.name,
            kind: "section",
            refId: s.id,
            children: blockKids.length ? blockKids : undefined,
          };
        }),

      };
    }),
  };

  const contentNode: TreeNode = {
    id: "grp:content",
    label: "Collections",
    kind: "group",
    children: project.collectionIds.map((cid) => {
      const col = getCollection(cid)!;
      return {
        id: `collection:${col.id}`,
        label: col.name,
        kind: "collection",
        refId: col.id,
        children: getEntriesForCollection(col.id).map((e) => ({
          id: `entry:${e.id}`,
          label: e.title,
          kind: "entry",
          refId: e.id,
        })),
      };
    }),
  };

  const componentsNode: TreeNode = {
    id: "grp:components",
    label: "Components",
    kind: "group",
    children: project.componentIds.map((cid) => {
      const c = getComponent(cid)!;
      return {
        id: `component:${c.id}`,
        label: c.name,
        kind: "component",
        refId: c.id,
      };
    }),
  };

  const mediaNode: TreeNode = {
    id: "grp:media",
    label: "Media",
    kind: "group",
    children: project.mediaIds.map((mid) => {
      const m = getMedia(mid)!;
      return {
        id: `media:${m.id}`,
        label: m.name,
        kind: "media",
        refId: m.id,
      };
    }),
  };

  return [websiteNode, contentNode, componentsNode, mediaNode];
}

export function findNode(nodes: TreeNode[], id: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const f = findNode(n.children, id);
      if (f) return f;
    }
  }
  return undefined;
}
