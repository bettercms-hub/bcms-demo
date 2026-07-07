/**
 * Phase-1 single source of truth for the editor's publish status pill.
 *
 * Resolves the page that the editor is currently working with by walking
 * the URL `?node=` value (page / section / block) back to its owning page
 * via the in-memory CMS store. Used by both the global Publish button in
 * `ProjectHeader` and the page header strip inside `PageView`.
 */
import { useSearch } from "@tanstack/react-router";
import { useCMS } from "@/lib/cms/store";
import type { Page } from "@/lib/cms/types";

export interface CurrentPageStatus {
  page: Page | undefined;
  pageId: string | undefined;
  state: NonNullable<Page["publishState"]>;
  lastEditedAt: string | undefined;
}

export function useCurrentPageStatus(): CurrentPageStatus {
  const { node } = useSearch({ strict: false }) as { node?: string };

  const pageId = useCMS((s) => {
    if (!node) {
      // Fall back to first page so the pill always has something to show.
      return s.pages[0]?.id;
    }
    if (node.startsWith("page:")) {
      const refId = node.slice("page:".length);
      return s.pages.find((p) => p.id === refId)?.id ?? s.pages[0]?.id;
    }
    if (node.startsWith("section:")) {
      const refId = node.slice("section:".length);
      return s.sections.find((x) => x.id === refId)?.pageId;
    }
    if (node.startsWith("block:")) {
      const parts = node.split(":");
      const sectionId = parts[1];
      return sectionId ? s.sections.find((x) => x.id === sectionId)?.pageId : undefined;
    }
    // Bare ID (no kind prefix) — try page then section.
    const directPage = s.pages.find((p) => p.id === node);
    if (directPage) return directPage.id;
    const sec = s.sections.find((x) => x.id === node);
    if (sec) return sec.pageId;
    return s.pages[0]?.id;
  });

  const page = useCMS((s) => (pageId ? s.pages.find((p) => p.id === pageId) : undefined));

  return {
    page,
    pageId,
    state: page?.publishState ?? "draft",
    lastEditedAt:
      page?.lastPublishedAt ?? page?.publishedAt ?? page?.scheduledAt ?? undefined,
  };
}
