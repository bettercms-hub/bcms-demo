import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { PanelLeft, PanelRight } from "lucide-react";

import { PropertiesPanel } from "./PropertiesPanel";
import { WorkspacePreview } from "./Workspace";
import { CenterWorkspace } from "./CenterWorkspace";
import { ModeToggle, type EditorMode } from "./ModeToggle";
import { ViewMenu } from "./ViewMenu";
import { ContextLabel } from "./ContextLabel";
import { EditorShortcuts } from "./EditorShortcuts";
import { findNode } from "@/lib/cms/tree";
import { useProjectTree, useCMS, pageActions } from "@/lib/cms/store";
import { editorBus } from "@/lib/cms/editor-bus";
import { pushRecent } from "@/lib/cms/recent-nodes";
import { NODE_KIND_ICON, ICON_STROKE } from "@/lib/cms/icons";
import type { TreeNode, TreeNodeKind } from "@/lib/cms/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useWorkspaceRow } from "@/lib/workspace/queries";
import { useViewportTier } from "@/lib/device";
import { EntryWorkflowBar } from "./EntryWorkflowBar";
import {
  CommentModeProvider,
  CommentSidebar,
  CommentSurfaceWrapper,
  CommentsTopButton,
  SelectionToolbar,
} from "@/components/cms/comments";
import type { CommentSurface } from "@/lib/comments/types";

function KindIcon({ kind }: { kind?: TreeNodeKind }) {
  if (!kind) return null;
  const Icon = NODE_KIND_ICON[kind];
  if (!Icon) return null;
  return <Icon className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />;
}

type Scope = "pages" | "collections" | "components";

const DEFAULT_GROUP_INDEX: Record<Scope, number> = {
  pages: 0,
  collections: 1,
  components: 2,
};

// (membership now uses findNode against the group subtree — see effect below)

export function EditorShell() {
  const { workspace, project } = useParams({ strict: false }) as {
    workspace: string;
    project: string;
  };
  const navigate = useNavigate();
  const { node: nodeId, scope, section: focusedSectionId } = useSearch({ strict: false }) as {
    node?: string;
    scope?: Scope;
    section?: string;
  };
  const tree = useProjectTree(workspace, project);
  const activeScope: Scope = scope ?? "pages";

  // Hard guard against any auto-navigate loop. Three layers:
  //   1) Per-(scope,node) attempt set — never auto-nav to a pair already tried.
  //   2) Rolling-window rate limit — max 4 auto-navs / 1500ms; after that the
  //      effect is disabled for the lifetime of this mount.
  //   3) Same-target short-circuit — identical consecutive targets are no-ops.
  // Any of these tripping renders the synchronous `effectiveNode` fallback
  // instead, so the editor still shows content even if the URL is stale.
  const lastAutoNavRef = useRef<string | null>(null);
  const attemptedRef = useRef<Set<string>>(new Set());
  const navTimestampsRef = useRef<number[]>([]);
  const disabledRef = useRef(false);
  useEffect(() => {
    if (disabledRef.current) return;
    const groupIdx = DEFAULT_GROUP_INDEX[activeScope];
    const group = tree[groupIdx];
    const first = group?.children?.[0];
    if (!first) return;
    // Authoritative membership: search the whole group subtree.
    const inGroup = nodeId
      ? Boolean(group && findNode(group.children ?? [], nodeId))
      : false;
    if (nodeId && inGroup) return;
    const target = `${activeScope}:${first.id}`;
    if (lastAutoNavRef.current === target) return;
    if (attemptedRef.current.has(target)) return;

    // Rolling rate limit
    const now = Date.now();
    const recent = navTimestampsRef.current.filter((t) => now - t < 1500);
    if (recent.length >= 4) {
      disabledRef.current = true;
      if (typeof console !== "undefined") {
        console.warn(
          "[EditorShell] auto-navigate disabled — too many redirects in a short window",
        );
      }
      return;
    }
    recent.push(now);
    navTimestampsRef.current = recent;

    lastAutoNavRef.current = target;
    attemptedRef.current.add(target);
    navigate({
      to: "/w/$workspace/p/$project/editor",
      params: { workspace, project },
      search: { scope: activeScope, node: first.id },
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScope, nodeId, tree, workspace, project]);

  // Reset the attempted-set whenever the user actively changes scope or the
  // project changes — those are legitimate transitions, not loops.
  useEffect(() => {
    attemptedRef.current = new Set();
    navTimestampsRef.current = [];
    disabledRef.current = false;
    lastAutoNavRef.current = null;
  }, [activeScope, workspace, project]);

  const setNode = useCallback(
    (id: string) =>
      navigate({
        to: "/w/$workspace/p/$project/editor",
        params: { workspace, project },
        // Changing node drops any focused-section context.
        search: { scope: activeScope, node: id },
        replace: true,
      }),
    [navigate, workspace, project, activeScope],
  );

  const setFocusedSection = useCallback(
    (sectionId: string | undefined) =>
      navigate({
        to: "/w/$workspace/p/$project/editor",
        params: { workspace, project },
        search: {
          scope: activeScope,
          node: nodeId,
          section: sectionId,
        },
        replace: true,
      }),
    [navigate, workspace, project, activeScope, nodeId],
  );

  const node = nodeId ? findNode(tree, nodeId) : undefined;
  // Synchronous fallback so the workspace never flashes the empty state while
  // the URL catches up.
  const effectiveNode = useMemo<TreeNode | undefined>(() => {
    if (node) return node;
    return tree[DEFAULT_GROUP_INDEX[activeScope]]?.children?.[0];
  }, [node, tree, activeScope]);

  const [storedMode, setMode] = useState<EditorMode>(() => {
    if (typeof window === "undefined") return "content";
    return (localStorage.getItem("bettercms.editor.mode") as EditorMode) ?? "content";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("bettercms.editor.mode", storedMode);
  }, [storedMode]);

  // Collections are a data workspace: no page preview exists, so the
  // Content/Split/Preview switch only confuses. Force content mode there.
  const isCollection = effectiveNode?.kind === "collection";
  // Entries edit all fields in the document itself, so the right inspector
  // would only duplicate them; publishing lives in the toolbar menu instead.
  const isEntry = effectiveNode?.kind === "entry";
  // Phones always edit content directly; split/preview need side-by-side room.
  const tier = useViewportTier();
  const mode: EditorMode = isCollection || tier === "mobile" ? "content" : storedMode;

  // Track recently opened nodes for the command palette.
  useEffect(() => {
    if (!effectiveNode || !workspace || !project) return;
    if (effectiveNode.kind === "group" || effectiveNode.kind === "settings") return;
    pushRecent({
      workspace, project, scope: activeScope,
      nodeId: effectiveNode.id, label: effectiveNode.label, at: Date.now(),
    });
  }, [effectiveNode?.id, effectiveNode?.kind, effectiveNode?.label, workspace, project, activeScope]);

  const [rightVisible, setRightVisible] = useState(true);

  // When a Section Workspace is focused (?section=<id>) we treat editing as
  // contextual to that section and hide the persistent right inspector.
  const isSectionWorkspace =
    !!focusedSectionId &&
    (effectiveNode?.kind === "page" ||
      effectiveNode?.kind === "section" ||
      effectiveNode?.kind === "block");

  // Resolve the current page (works for page/section/block selection) so
  // the top-bar Publish action can target it.
  const currentPageId = useCMS((s) => {
    const n = effectiveNode;
    if (!n) return undefined;
    if (n.kind === "page" && n.refId) return n.refId;
    if (n.kind === "section" && n.refId) {
      return s.sections.find((x) => x.id === n.refId)?.pageId;
    }
    if (n.kind === "block") {
      const sectionId = n.id.split(":")[1];
      return sectionId ? s.sections.find((x) => x.id === sectionId)?.pageId : undefined;
    }
    return undefined;
  });
  const currentPage = useCMS((s) =>
    currentPageId ? s.pages.find((p) => p.id === currentPageId) : undefined,
  );
  const currentPageSectionCount = currentPage?.sectionIds.length ?? 0;
  const [publishOpen, setPublishOpen] = useState(false);
  const canPublish = !!currentPageId;

  // Split-mode scroll sync. When either pane scrolls, mirror proportionally.
  const SYNC_KEY = "bettercms.editor.sync-scroll";
  const [syncScroll, setSyncScroll] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(SYNC_KEY) !== "0";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SYNC_KEY, syncScroll ? "1" : "0");
    }
  }, [syncScroll]);
  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const syncFromRef = useRef<"left" | "right" | null>(null);
  const syncRafRef = useRef<number | null>(null);
  const handleSyncScroll = (from: "left" | "right") => {
    if (!syncScroll) return;
    if (syncFromRef.current && syncFromRef.current !== from) return;
    syncFromRef.current = from;
    if (syncRafRef.current != null) return;
    syncRafRef.current = requestAnimationFrame(() => {
      syncRafRef.current = null;
      const src = from === "left" ? leftScrollRef.current : rightScrollRef.current;
      const dst = from === "left" ? rightScrollRef.current : leftScrollRef.current;
      if (!src || !dst) {
        syncFromRef.current = null;
        return;
      }
      const srcMax = src.scrollHeight - src.clientHeight;
      const dstMax = dst.scrollHeight - dst.clientHeight;
      if (srcMax > 0 && dstMax > 0) {
        const ratio = src.scrollTop / srcMax;
        dst.scrollTop = ratio * dstMax;
      }
      // Release on next frame so the other pane's scroll event doesn't bounce.
      requestAnimationFrame(() => {
        syncFromRef.current = null;
      });
    });
  };

  // Bus listeners for shortcut/palette-driven changes.
  useEffect(() => {
    const off = editorBus.on((e) => {
      if (e.type === "editor:set-mode") setMode(e.mode);
      else if (e.type === "editor:toggle-panel" && e.side === "right") {
        setRightVisible((v) => !v);
      } else if (e.type === "editor:focus-tree") {
        setTimeout(() => document.getElementById("bcms-tree-filter")?.focus(), 0);
      } else if (e.type === "editor:request-publish") {
        if (canPublishRef.current) setPublishOpen(true);
      }
    });
    return () => { off(); };
  }, []);

  // Stable ref so the bus listener (mounted once) always sees fresh state.
  const canPublishRef = useRef(false);
  canPublishRef.current = canPublish;



  const wsRow = useWorkspaceRow(workspace);
  const workspaceId = wsRow.data?.id ?? "";
  const commentSurface: CommentSurface =
    mode === "preview" ? "preview" : mode === "split" ? "split" : "editor";
  const commentPageId =
    effectiveNode?.kind === "page" ? effectiveNode.refId ?? effectiveNode.id : currentPageId;

  return (
    <CommentModeProvider>
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[color:var(--surface-canvas)]">
      <EditorShortcuts />
      {/* Editor toolbar — context · mode · view. Publish and saved state live
          in the global ProjectHeader now (single source). */}
      <div className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-[color:var(--topbar)] px-3">
        {/* Left: sidebar toggle · context label */}
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => editorBus.emit({ type: "editor:toggle-panel", side: "left" })}
            title="Toggle sidebar"
            aria-label="Toggle sidebar"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <div className="inline-flex min-w-0 items-center rounded-md px-1.5 py-1 hover:bg-[color:var(--color-row-hover)]">
            <ContextLabel
              kind={effectiveNode?.kind}
              value={effectiveNode?.label}
              icon={<KindIcon kind={effectiveNode?.kind} />}
            />
          </div>
        </div>

        {/* Center: editor mode (pages only; collections have no preview) */}
        <div className="flex items-center justify-center">
          {!isCollection && tier !== "mobile" && <ModeToggle value={mode} onChange={setMode} />}
        </div>

        {/* Right: comments · view · publish · panel toggle */}
        <div className="flex items-center justify-end gap-1.5">
          <CommentsTopButton workspaceId={workspaceId} variant="inline" />
          {!isCollection && <ViewMenu />}
          {!isCollection && !isEntry && !isSectionWorkspace && (
            <>
              <div className="mx-0.5 h-5 w-px shrink-0 bg-border/70" aria-hidden />
              <button
                type="button"
                onClick={() => setRightVisible((v) => !v)}
                title={rightVisible ? "Hide properties" : "Show properties"}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-[color:var(--color-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  rightVisible ? "text-foreground" : "text-muted-foreground"
                }`}
                aria-label="Toggle properties"
                aria-pressed={rightVisible}
              >
                <PanelRight className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </>
          )}

        </div>
      </div>



      <div className="flex-1 min-h-0">
        <PanelGroup orientation="horizontal" className="h-full">
          <Panel defaultSize="76%" minSize="320px">
            <div className="h-full bg-[color:var(--surface-canvas)]">
              {mode === "content" && (
                <div className="h-full overflow-auto">
                  <CommentSurfaceWrapper
                    workspaceId={workspaceId}
                    surface={commentSurface}
                    pageId={commentPageId ?? undefined}
                    className="min-h-full"
                  >
                    <CenterWorkspace
                      node={effectiveNode}
                      onSelect={setNode}
                      focusedSectionId={focusedSectionId}
                      onFocusSection={setFocusedSection}
                    />

                  </CommentSurfaceWrapper>
                </div>
              )}
              {mode === "preview" && (
                <CommentSurfaceWrapper
                  workspaceId={workspaceId}
                  surface={commentSurface}
                  pageId={commentPageId ?? undefined}
                  className="h-full"
                >
                  <WorkspacePreview node={effectiveNode} />
                </CommentSurfaceWrapper>
              )}
              {mode === "split" && (
                <PanelGroup orientation="horizontal" className="h-full">
                  <Panel defaultSize="50%" minSize="30%">
                    <div
                      ref={leftScrollRef}
                      onScroll={() => handleSyncScroll("left")}
                      className="h-full overflow-auto"
                    >
                      <CommentSurfaceWrapper
                        workspaceId={workspaceId}
                        surface="split"
                        pageId={commentPageId ?? undefined}
                        className="min-h-full"
                      >
                        <CenterWorkspace
                          node={effectiveNode}
                          onSelect={setNode}
                          focusedSectionId={focusedSectionId}
                          onFocusSection={setFocusedSection}
                        />

                      </CommentSurfaceWrapper>
                    </div>
                  </Panel>
                  <PanelResizeHandle className="w-px bg-border hover:bg-border-strong" />
                  <Panel defaultSize="50%" minSize="30%">
                    <div
                      ref={rightScrollRef}
                      onScroll={() => handleSyncScroll("right")}
                      className="h-full overflow-auto"
                    >
                      <CommentSurfaceWrapper
                        workspaceId={workspaceId}
                        surface="split"
                        pageId={commentPageId ?? undefined}
                        className="min-h-full"
                      >
                        <WorkspacePreview node={effectiveNode} />
                      </CommentSurfaceWrapper>
                    </div>
                  </Panel>
                </PanelGroup>
              )}
            </div>
          </Panel>
          {rightVisible && tier !== "mobile" && !isCollection && !isEntry && !isSectionWorkspace && (
            <>
              <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-border-strong" />
              <Panel defaultSize="24%" minSize="240px" maxSize="36%">
                <div className="h-full overflow-hidden">
                  <PropertiesPanel node={effectiveNode} />
                </div>
              </Panel>
            </>
          )}

        </PanelGroup>
      </div>

      {isEntry && effectiveNode?.refId && (
        <EntryWorkflowBar entryId={effectiveNode.refId} wsSlug={workspace} />
      )}

      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish to production?</AlertDialogTitle>
            <AlertDialogDescription>
              {currentPage ? (
                <>
                  This will publish{" "}
                  <span className="font-medium text-foreground">{currentPage.title}</span>{" "}
                  ({currentPageSectionCount} section
                  {currentPageSectionCount === 1 ? "" : "s"}) to the live site. A
                  snapshot is saved as a revision.
                </>
              ) : (
                <>This will publish the current page to the live site.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!currentPageId) return;
                pageActions.publish(currentPageId);
                toast.success("Page published", {
                  description: currentPage?.title ?? undefined,
                });
              }}
            >
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CommentSidebar
        workspaceId={workspaceId}
        surface={commentSurface}
        pageId={commentPageId ?? undefined}
      />
      <SelectionToolbar surface={commentSurface} pageId={commentPageId ?? undefined} />
    </div>
    </CommentModeProvider>
  );
}


