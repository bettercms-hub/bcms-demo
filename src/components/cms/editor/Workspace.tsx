import {
  Component as ComponentIcon,
  Database,
  FileText,
  FileType2,
  ImageIcon,
  LayoutTemplate,
  Settings as SettingsIcon,
} from "lucide-react";
import type { TreeNode } from "@/lib/cms/types";
import { EmptyState } from "@/components/cms/EmptyState";
import { PageView } from "./views/PageView";
import { CollectionView } from "./views/CollectionView";
import { EntryView } from "./views/EntryView";
import { ComponentView } from "./views/ComponentView";
import { MediaView } from "./views/MediaView";
import { getSection } from "@/lib/cms/use-cms";

interface Props {
  node?: TreeNode;
  onSelect?: (id: string) => void;
  focusedSectionId?: string;
  onFocusSection?: (sectionId: string | undefined) => void;
}

const KIND_ICON = {
  page: FileText,
  section: LayoutTemplate,
  collection: Database,
  entry: FileType2,
  component: ComponentIcon,
  media: ImageIcon,
  settings: SettingsIcon,
} as const;

const KIND_LABEL = {
  page: "Page",
  section: "Section",
  collection: "Collection",
  entry: "Entry",
  component: "Component",
  media: "Media asset",
  settings: "Settings",
} as const;

export function WorkspaceContent({ node, onSelect, focusedSectionId, onFocusSection }: Props) {
  if (!node) {
    return (
      <CenteredEmpty
        icon={FileText}
        title="Nothing here yet"
        description="Pick a page, collection or component from the tree on the left to start editing."
      />
    );
  }

  switch (node.kind) {
    case "page":
      return node.refId ? (
        <PageView
          pageId={node.refId}
          onSelectNode={onSelect}
          selectedSectionId={undefined}
          focusedSectionId={focusedSectionId}
          onFocusSection={onFocusSection}
        />
      ) : (
        <MissingRef node={node} />
      );
    case "section": {
      if (!node.refId) return <MissingRef node={node} />;
      const s = getSection(node.refId);
      return s ? (
        <PageView
          pageId={s.pageId}
          onSelectNode={onSelect}
          selectedSectionId={node.id}
          focusedSectionId={focusedSectionId ?? s.id}
          onFocusSection={onFocusSection}
          onExitSectionFocus={() => onSelect?.(`page:${s.pageId}`)}
        />
      ) : (
        <MissingRef node={node} />
      );
    }
    case "block": {
      // id format: block:<sectionId>:<pathKey>
      const parts = node.id.split(":");
      const sectionId = parts[1];
      const blockPathKey = parts[2] ?? "";
      const s = sectionId ? getSection(sectionId) : undefined;
      if (!s) return <MissingRef node={node} />;
      return (
        <PageView
          pageId={s.pageId}
          onSelectNode={onSelect}
          selectedSectionId={`section:${s.id}`}
          selectedBlockPathKey={blockPathKey}
          focusedSectionId={focusedSectionId ?? s.id}
          onFocusSection={onFocusSection}
          onExitSectionFocus={() => onSelect?.(`page:${s.pageId}`)}
        />
      );
    }
    case "collection":
      return node.refId ? (
        <CollectionView collectionId={node.refId} onSelectEntry={onSelect} />
      ) : (
        <MissingRef node={node} />
      );
    case "entry":
      return node.refId ? <EntryView entryId={node.refId} /> : <MissingRef node={node} />;
    case "component":
      return node.refId ? <ComponentView componentId={node.refId} /> : <MissingRef node={node} />;
    case "media":
      return node.refId ? <MediaView mediaId={node.refId} /> : <MissingRef node={node} />;
    case "settings":
      return (
        <CenteredEmpty
          icon={SettingsIcon}
          title={`${node.label} settings`}
          description="Open the Settings tab to configure this area."
        />
      );
    case "group":
      return (
        <CenteredEmpty
          icon={KIND_ICON.page}
          title={node.label}
          description={
            node.children?.length
              ? `${node.children.length} item${node.children.length === 1 ? "" : "s"} in this group. Pick one to open.`
              : "This group is empty."
          }
        />
      );
    default:
      return (
        <CenteredEmpty
          icon={FileText}
          title={node.label}
          description="No editor is registered for this kind yet."
        />
      );
  }
}

function MissingRef({ node }: { node: TreeNode }) {
  const Icon = KIND_ICON[node.kind as keyof typeof KIND_ICON] ?? FileText;
  const label = KIND_LABEL[node.kind as keyof typeof KIND_LABEL] ?? "Item";
  return (
    <CenteredEmpty
      icon={Icon}
      title={`${label} not found`}
      description={`“${node.label}” could not be loaded. It may have been deleted. Pick another item from the tree.`}
    />
  );
}

function CenteredEmpty(props: { icon: typeof FileText; title: string; description?: string }) {
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="w-full max-w-md">
        <EmptyState icon={props.icon} title={props.title} description={props.description} />
      </div>
    </div>
  );
}

export { PreviewRoot as WorkspacePreview } from "./preview/Renderer";
