import { useEffect, useMemo, useState } from "react";
import type { Entry, Page, Section, TreeNode } from "@/lib/cms/types";
import { useCMS, pageActions } from "@/lib/cms/store";
import { SectionPreview } from "./sections";
import { EntryPreview } from "./EntryPreview";
import { ComponentPreview } from "./ComponentPreview";
import { BoundSectionPreview } from "./BoundSectionPreview";

import { PreviewToolbar, type PreviewDevice, type PreviewZoom } from "./PreviewToolbar";
import { SourceToggle, type PreviewSource } from "./SourceToggle";
import { PreviewFrame } from "./PreviewFrame";
import { LiveIndicator } from "./LiveIndicator";
import { editorBus } from "@/lib/cms/editor-bus";

const SOURCE_LS_KEY = "bettercms.preview.source";

function loadSource(): PreviewSource {
  if (typeof window === "undefined") return "draft";
  const v = window.localStorage.getItem(SOURCE_LS_KEY) as PreviewSource | null;
  // "compare" no longer exists as a view; old stored values fall back to draft.
  return v === "draft" || v === "published" ? v : "draft";
}

export function PreviewRoot({ node }: { node?: TreeNode }) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [zoom, setZoom] = useState<PreviewZoom>("fit");
  const [source, setSourceState] = useState<PreviewSource>(loadSource);
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const setSource = (raw: PreviewSource) => {
    // Compare view is retired; anything still emitting it lands on Published.
    const s: PreviewSource = raw === "compare" ? "published" : raw;
    setSourceState(s);
    if (typeof window !== "undefined") window.localStorage.setItem(SOURCE_LS_KEY, s);
  };

  const liveStamp = useLiveStamp(node);

  // Only pages and sections offer a draft/published version switch. Entries
  // preview the working draft — their publish status lives in the toolbar
  // publish control, so a second "Published" switch here only duplicates it.
  const showSourceToggle = node?.kind === "page" || node?.kind === "section";
  useEffect(() => {
    if (!showSourceToggle && source !== "draft") setSource("draft");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSourceToggle]);

  const doRefresh = () => {
    setRefreshing(true);
    setTick((t) => t + 1);
    window.setTimeout(() => setRefreshing(false), 280);
  };

  // Subscribe to palette/shortcut events.
  useEffect(() => {
    const off = editorBus.on((e) => {
      if (e.type === "editor:set-preview-source") setSource(e.source);
      else if (e.type === "editor:set-preview-device") setDevice(e.device);
      else if (e.type === "editor:refresh-preview") doRefresh();
    });
    return () => { off(); };
  }, []);

  if (!node) {
    return (
      <div className="grid h-full place-items-center bg-surface p-6 text-[13px] text-muted-foreground">
        Select something to preview.
      </div>
    );
  }

  const inner = (
    <PreviewBody node={node} source={source} setSource={setSource} device={device} zoom={zoom} tick={tick}
      onPublish={() => {
        if (node.kind === "page" && node.refId) pageActions.publish(node.refId);
      }}
    />
  );

  return (
    <div className="flex h-full flex-col bg-surface">
      <PreviewToolbar
        device={device}
        onDevice={setDevice}
        zoom={zoom}
        onZoom={setZoom}
        onRefresh={doRefresh}
        leftSlot={
          showSourceToggle ? (
            <SourceToggle value={source} onChange={setSource} />
          ) : null
        }
        chip={source === "draft" ? <LiveIndicator stamp={liveStamp} /> : null}
      />
      <div
        className={`relative flex-1 min-h-0 overflow-hidden transition-opacity duration-200 ${
          refreshing ? "opacity-40" : "opacity-100"
        }`}
      >
        {inner}
      </div>
    </div>
  );
}

/** Returns a stamp that changes when the current node's content changes. */
function useLiveStamp(node?: TreeNode): string | undefined {
  return useCMS((s) => {
    if (!node) return undefined;
    const id = (o: unknown) => {
      // Object identity proxy: zustand replaces refs on update, so we can use
      // a counter derived from JSON length + a stable marker. JSON.stringify
      // is fine here — preview data volume is small.
      try { return o ? JSON.stringify(o).length + "-" + Math.random().toString(36).slice(2, 6) : ""; } catch { return ""; }
      // Note: we don't actually want randomness — use identity below instead.
    };
    void id;
    const refStamp = (o: unknown) => (o ? String((o as { __r?: number }).__r ?? Object.keys(o as object).length) : "");
    void refStamp;
    if (node.kind === "page" && node.refId) {
      const p = s.pages.find((x) => x.id === node.refId);
      if (!p) return undefined;
      const sectionRefs = p.sectionIds.map((sid) => s.sections.find((x) => x.id === sid));
      return [p, ...sectionRefs].map((o) => (o ? sigOf(o) : "0")).join("|");
    }
    if (node.kind === "section" && node.refId) {
      const sec = s.sections.find((x) => x.id === node.refId);
      return sec ? sigOf(sec) : undefined;
    }
    if (node.kind === "block") {
      const sectionId = node.id.split(":")[1];
      const sec = s.sections.find((x) => x.id === sectionId);
      return sec ? sigOf(sec) : undefined;
    }
    if (node.kind === "entry" && node.refId) {
      const e = s.entries.find((x) => x.id === node.refId);
      return e ? sigOf(e) : undefined;
    }
    if (node.kind === "component" && node.refId) {
      const c = s.components.find((x) => x.id === node.refId);
      return c ? sigOf(c) : undefined;
    }
    return undefined;
  });
}

/** Cheap content signature based on object identity tracked via a WeakMap. */
const _sigMap = new WeakMap<object, string>();
let _sigSeq = 0;
function sigOf(o: object): string {
  let s = _sigMap.get(o);
  if (!s) {
    s = `${++_sigSeq}`;
    _sigMap.set(o, s);
  }
  return s;
}


interface BodyProps {
  node: TreeNode;
  source: PreviewSource;
  setSource: (s: PreviewSource) => void;
  device: PreviewDevice;
  zoom: PreviewZoom;
  tick: number;
  onPublish: () => void;
}

function PreviewBody({ node, source, setSource, device, zoom, tick, onPublish }: BodyProps) {
  void tick;
  return (
    <div className="h-full overflow-auto p-6">
      <PreviewFrame device={device} zoom={zoom}>
        <NodeContent node={node} source={source === "published" ? "published" : "draft"} onPublish={onPublish} onSwitchToDraft={() => setSource("draft")} />
      </PreviewFrame>
    </div>
  );
}

// ----- node-specific renderers -----

function NodeContent({
  node, source, onPublish, onSwitchToDraft,
}: { node: TreeNode; source: "draft" | "published"; onPublish?: () => void; onSwitchToDraft?: () => void }) {
  switch (node.kind) {
    case "page": return node.refId ? <PagePreview pageId={node.refId} source={source} onPublish={onPublish} onSwitchToDraft={onSwitchToDraft} /> : null;
    case "section": return node.refId ? <OneSection sectionId={node.refId} source={source} onPublish={onPublish} onSwitchToDraft={onSwitchToDraft} /> : null;
    case "entry": return node.refId ? <EntryPreviewWrapper entryId={node.refId} source={source} onSwitchToDraft={onSwitchToDraft} /> : null;
    case "component": return node.refId ? <ComponentPreview componentId={node.refId} /> : null;
    case "media": return node.refId ? <MediaPreview mediaId={node.refId} /> : null;
    default:
      return (
        <div className="grid place-items-center p-12 text-[13px] text-muted-foreground">
          No preview for {node.kind}.
        </div>
      );
  }
}

function PagePreview({
  pageId, source, onPublish, onSwitchToDraft,
}: { pageId: string; source: "draft" | "published"; onPublish?: () => void; onSwitchToDraft?: () => void }) {
  const page = useCMS((s) => s.pages.find((p) => p.id === pageId));
  const draftSections = useCMS((s) => {
    if (!page) return [] as Section[];
    return page.sectionIds.map((id) => s.sections.find((x) => x.id === id)).filter(Boolean) as Section[];
  });
  if (!page) return null;

  const sections = source === "published" ? page.publishedSnapshot?.sections : draftSections;
  if (source === "published" && !page.publishedSnapshot) {
    return <NoSnapshot label="page" onPublish={onPublish} onSwitchToDraft={onSwitchToDraft} />;
  }
  if (!sections || sections.length === 0) {
    return (
      <div className="grid place-items-center p-16 text-[13px] text-muted-foreground">
        This {source === "published" ? "published page" : "page"} has no sections.
      </div>
    );
  }
  return <>{sections.map((s) => (s as Section).componentId
    ? <BoundSectionPreview key={s.id} section={s as Section} />
    : <SectionPreview key={s.id} section={s as Section} />
  )}</>;

}

function OneSection({
  sectionId, source, onPublish, onSwitchToDraft,
}: { sectionId: string; source: "draft" | "published"; onPublish?: () => void; onSwitchToDraft?: () => void }) {
  const draft = useCMS((s) => s.sections.find((x) => x.id === sectionId));
  const parentPage = useCMS((s) => (draft ? s.pages.find((p) => p.id === draft.pageId) : undefined));
  if (!draft) return null;
  if (source === "published") {
    const snap = parentPage?.publishedSnapshot?.sections.find((x) => x.id === sectionId);
    if (!snap) return <NoSnapshot label="section" onPublish={onPublish ?? (() => parentPage && pageActions.publish(parentPage.id))} onSwitchToDraft={onSwitchToDraft} />;
    if ((snap as Section).componentId) return <BoundSectionPreview section={snap as Section} />;
    return <SectionPreview section={snap as Section} />;
  }
  if (draft.componentId) return <BoundSectionPreview section={draft} />;
  return <SectionPreview section={draft} />;
}


function EntryPreviewWrapper({
  entryId, source, onSwitchToDraft,
}: { entryId: string; source: "draft" | "published"; onSwitchToDraft?: () => void }) {
  const entry = useCMS((s) => s.entries.find((e) => e.id === entryId));
  if (!entry) return null;
  if (source === "published") {
    if (!entry.publishedSnapshot) return <NoSnapshot label="entry" onSwitchToDraft={onSwitchToDraft} />;
    // EntryPreview reads from the live store; published snapshot rendering would
    // require refactoring EntryPreview. For mock data the snapshot mirrors live
    // entry fields, so the live renderer suffices.
  }
  return <EntryPreview entryId={entryId} />;
}

function NoSnapshot({
  label, onPublish, onSwitchToDraft,
}: { label: string; onPublish?: () => void; onSwitchToDraft?: () => void }) {
  return (
    <div className="grid place-items-center bg-surface p-12">
      <div className="w-full max-w-sm rounded-[10px] border border-dashed border-border bg-white p-6 text-center">
        <div className="text-[13px] font-semibold text-foreground">No published version yet</div>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Publish this {label} to create a snapshot you can compare against.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          {onPublish && (
            <button
              type="button"
              onClick={onPublish}
              className="h-8 rounded-[6px] bg-foreground px-3 text-[12px] font-medium text-background hover:opacity-90"
            >
              Publish now
            </button>
          )}
          {onSwitchToDraft && (
            <button
              type="button"
              onClick={onSwitchToDraft}
              className="h-8 rounded-[6px] border border-border bg-background px-3 text-[12px] font-medium text-foreground hover:bg-muted"
            >
              View draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaPreview({ mediaId }: { mediaId: string }) {
  const m = useCMS((s) => s.media.find((x) => x.id === mediaId));
  if (!m) return null;
  return (
    <div className="bg-surface p-6">
      <div className="overflow-hidden rounded-[8px] border border-border bg-white">
        {m.kind === "image" && m.url ? (
          <img src={m.url} alt={m.name} className="block w-full" />
        ) : (
          <div className="grid aspect-video place-items-center text-[12px] text-muted-foreground">
            {m.name}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{m.name}</span>
        <span className="font-mono">{m.size ?? ""}</span>
      </div>
    </div>
  );
}

// Keep these imports referenced even when unused locally so the type-only
// imports don't trigger TS6133 in strict mode.
export type { Page, Entry };
