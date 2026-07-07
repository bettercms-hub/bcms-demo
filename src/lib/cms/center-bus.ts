/**
 * Center workspace bus — controls which sub-mode the center pane shows.
 * Sub-modes replace the old BlockLibrary / SectionTemplatePicker modals and
 * the in-view Schema/Design/Entries tabs on Collections and Components.
 */
import type { BlockPath } from "./blocks/operations";

export type CenterMode =
  | "editor"
  | "block-library"
  | "template-picker"
  | "schema-editor"
  | "schema-workspace";

export type SchemaOwnerKind = "collection" | "component";

export type CenterEvent =
  | {
      type: "center:open";
      mode: "block-library";
      targetSectionId: string;
      parentPath?: BlockPath;
      atIndex?: number;
    }
  | {
      type: "center:open";
      mode: "template-picker";
      targetSectionId: string;
    }
  | {
      type: "center:open";
      mode: "schema-editor" | "schema-workspace";
      schemaId: string;
      ownerKind: SchemaOwnerKind;
      ownerId: string;
    }
  | { type: "center:close" };


type Listener = (e: CenterEvent) => void;
const listeners = new Set<Listener>();

export const centerBus = {
  on(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  emit(e: CenterEvent) {
    listeners.forEach((l) => l(e));
  },
};
