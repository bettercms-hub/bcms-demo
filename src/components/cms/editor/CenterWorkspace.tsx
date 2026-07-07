/**
 * CenterWorkspace — the permanent center pane.
 * Owns a sub-mode switch between the regular editor, the Block Library,
 * the Template Picker, and the Schema Editor. Sub-mode is driven by `centerBus`.
 */
import { useEffect, useState } from "react";
import type { TreeNode } from "@/lib/cms/types";
import { WorkspaceContent } from "./Workspace";
import { BlockLibraryWorkspace } from "./center/BlockLibraryWorkspace";
import { TemplatePickerWorkspace } from "./center/TemplatePickerWorkspace";
import { SchemaWorkspace } from "./schema/SchemaWorkspace";
import { centerBus, type SchemaOwnerKind } from "@/lib/cms/center-bus";
import type { BlockPath } from "@/lib/cms/blocks/operations";

interface Props {
  node?: TreeNode;
  onSelect?: (id: string) => void;
  focusedSectionId?: string;
  onFocusSection?: (sectionId: string | undefined) => void;
}

type ModeState =
  | { mode: "editor" }
  | { mode: "block-library"; sectionId: string; parentPath: BlockPath; atIndex?: number }
  | { mode: "template-picker"; sectionId: string }
  | {
      mode: "schema-workspace";
      schemaId: string;
      ownerKind: SchemaOwnerKind;
      ownerId: string;
    };


export function CenterWorkspace({ node, onSelect, focusedSectionId, onFocusSection }: Props) {
  const [state, setState] = useState<ModeState>({ mode: "editor" });

  useEffect(() => {
    return centerBus.on((e) => {
      if (e.type === "center:close") {
        setState({ mode: "editor" });
        return;
      }
      if (e.mode === "block-library") {
        setState({
          mode: "block-library",
          sectionId: e.targetSectionId,
          parentPath: e.parentPath ?? [],
          atIndex: e.atIndex,
        });
      } else if (e.mode === "template-picker") {
        setState({ mode: "template-picker", sectionId: e.targetSectionId });
      } else if (e.mode === "schema-editor" || e.mode === "schema-workspace") {
        setState({
          mode: "schema-workspace",
          schemaId: e.schemaId,
          ownerKind: e.ownerKind,
          ownerId: e.ownerId,
        });
      }
    });
  }, []);

  // If selected node changes away from the sub-mode's target, exit sub-mode.
  // Note: schema-workspace is an explicit user action — it stays mounted until
  // the user closes it or another center event replaces it.
  useEffect(() => {
    if (state.mode === "editor") return;
    if (state.mode === "schema-workspace") return;
    if (state.mode === "block-library" || state.mode === "template-picker") {
      if (node?.kind === "page") return;
      if (node?.kind === "section" && node.refId === state.sectionId) return;
      if (node?.kind === "block" && node.id.split(":")[1] === state.sectionId) return;
      setState({ mode: "editor" });
      return;
    }
  }, [node, state]);

  const close = () => centerBus.emit({ type: "center:close" });

  if (state.mode === "block-library") {
    return (
      <BlockLibraryWorkspace
        sectionId={state.sectionId}
        parentPath={state.parentPath}
        atIndex={state.atIndex}
        onClose={close}
      />
    );
  }
  if (state.mode === "template-picker") {
    return <TemplatePickerWorkspace sectionId={state.sectionId} onClose={close} />;
  }
  if (state.mode === "schema-workspace") {
    return (
      <SchemaWorkspace
        schemaId={state.schemaId}
        ownerKind={state.ownerKind}
        ownerId={state.ownerId}
        onClose={close}
      />
    );
  }
  return (
    <WorkspaceContent
      node={node}
      onSelect={onSelect}
      focusedSectionId={focusedSectionId}
      onFocusSection={onFocusSection}
    />
  );
}

