import type { BlockKind } from "@/lib/cms/blocks/registry";
import type { BlockPath } from "@/lib/cms/blocks/operations";

// ---------- Active payloads ----------

export type DragBlockData = {
  kind: "block";
  sectionId: string;
  path: BlockPath;
  label: string;
};

export type DragLibraryData = {
  kind: "library";
  blockKind: BlockKind;
  label: string;
};

export type DragSectionData = {
  kind: "section";
  pageId: string;
  sectionId: string;
  index: number;
  label: string;
};

export type ActiveData = DragBlockData | DragLibraryData | DragSectionData;

// ---------- Over (drop target) payloads ----------

export type DropBlockSlot = {
  kind: "block-slot";
  sectionId: string;
  parentPath: BlockPath;
  index: number;
};

export type DropSectionSlot = {
  kind: "section-slot";
  pageId: string;
  index: number;
};

export type OverData = DropBlockSlot | DropSectionSlot;

// ---------- Stable id helpers ----------

export const idForBlock = (sectionId: string, path: BlockPath) =>
  `block:${sectionId}:${path.join(".")}`;

export const idForBlockSlot = (
  sectionId: string,
  parentPath: BlockPath,
  index: number,
) => `slot:${sectionId}:${parentPath.join(".") || "_"}:${index}`;

export const idForSection = (sectionId: string) => `section:${sectionId}`;

export const idForSectionSlot = (pageId: string, index: number) =>
  `section-slot:${pageId}:${index}`;
