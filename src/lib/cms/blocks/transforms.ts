/**
 * Block transforms — preset "turn into" actions applied to an existing
 * block. Each entry produces a new `kind` (often the same) plus a `patch`
 * merged on top of the new kind's defaults.
 *
 * Used by the preview slash menu when a block is selected so users can
 * change heading level, swap button variants, retune layout density, etc.
 * without leaving the preview.
 */
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownUp,
  ArrowLeftRight,
  Columns2,
  Columns3,
  Columns4,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Image as ImageIcon,
  List as ListIcon,
  ListOrdered,
  MousePointerClick,
  Quote as QuoteIcon,
  Square,
  Type as TypeIcon,
  type LucideIcon,
} from "lucide-react";
import type { Block } from "../types";
import type { BlockKind } from "./registry";

export interface BlockTransform {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  icon: LucideIcon;
  /** Same kind = a props-only patch. Different kind = full transform. */
  nextKind: BlockKind;
  patch?: Record<string, unknown>;
  /** Optional predicate — hide when it returns false (e.g. already that level). */
  available?: (block: Block) => boolean;
}

const headingLevels: BlockTransform[] = [
  { id: "h1", label: "Heading 1", icon: Heading1, nextKind: "heading", patch: { level: "1" } },
  { id: "h2", label: "Heading 2", icon: Heading2, nextKind: "heading", patch: { level: "2" } },
  { id: "h3", label: "Heading 3", icon: Heading3, nextKind: "heading", patch: { level: "3" } },
  { id: "h4", label: "Heading 4", icon: Heading4, nextKind: "heading", patch: { level: "4" } },
];

const alignActions = (kind: BlockKind): BlockTransform[] => [
  { id: "align-left", label: "Align left", icon: AlignLeft, nextKind: kind, patch: { align: "left" }, keywords: "alignment" },
  { id: "align-center", label: "Align center", icon: AlignCenter, nextKind: kind, patch: { align: "center" }, keywords: "alignment" },
  { id: "align-right", label: "Align right", icon: AlignRight, nextKind: kind, patch: { align: "right" }, keywords: "alignment" },
];

const buttonVariants: BlockTransform[] = [
  { id: "btn-primary", label: "Primary button", icon: MousePointerClick, nextKind: "button", patch: { variant: "primary" } },
  { id: "btn-secondary", label: "Secondary button", icon: MousePointerClick, nextKind: "button", patch: { variant: "secondary" } },
  { id: "btn-outline", label: "Outline button", icon: Square, nextKind: "button", patch: { variant: "outline" } },
  { id: "btn-ghost", label: "Ghost button", icon: MousePointerClick, nextKind: "button", patch: { variant: "ghost" } },
];

const imageRatios: BlockTransform[] = [
  { id: "ratio-16-9", label: "Aspect 16:9", icon: ImageIcon, nextKind: "image", patch: { ratio: "16/9" } },
  { id: "ratio-4-3", label: "Aspect 4:3", icon: ImageIcon, nextKind: "image", patch: { ratio: "4/3" } },
  { id: "ratio-1-1", label: "Aspect 1:1", icon: ImageIcon, nextKind: "image", patch: { ratio: "1/1" } },
  { id: "ratio-3-4", label: "Aspect 3:4", icon: ImageIcon, nextKind: "image", patch: { ratio: "3/4" } },
];

const columnsPresets = (kind: BlockKind): BlockTransform[] => [
  { id: "cols-2", label: "2 columns", icon: Columns2, nextKind: kind, patch: { columns: 2, count: 2 } },
  { id: "cols-3", label: "3 columns", icon: Columns3, nextKind: kind, patch: { columns: 3, count: 3 } },
  { id: "cols-4", label: "4 columns", icon: Columns4, nextKind: kind, patch: { columns: 4, count: 4 } },
];

const gapPresets = (kind: BlockKind): BlockTransform[] => [
  { id: "gap-sm", label: "Tight gap", icon: Square, nextKind: kind, patch: { gap: "sm" }, keywords: "spacing" },
  { id: "gap-md", label: "Medium gap", icon: Square, nextKind: kind, patch: { gap: "md" }, keywords: "spacing" },
  { id: "gap-lg", label: "Loose gap", icon: Square, nextKind: kind, patch: { gap: "lg" }, keywords: "spacing" },
];

export function getTransformsFor(block: Block): BlockTransform[] {
  switch (block.kind) {
    case "heading":
      return [
        ...headingLevels.filter((t) => String(block.props.level) !== String(t.patch?.level)),
        ...alignActions("heading"),
        { id: "to-paragraph", label: "Turn into Paragraph", icon: TypeIcon, nextKind: "paragraph", patch: { text: String(block.props.text ?? "") } },
        { id: "to-quote", label: "Turn into Quote", icon: QuoteIcon, nextKind: "quote", patch: { text: String(block.props.text ?? "") } },
      ];
    case "paragraph":
      return [
        { id: "to-h2", label: "Turn into Heading 2", icon: Heading2, nextKind: "heading", patch: { level: "2", text: String(block.props.text ?? "") } },
        { id: "to-h3", label: "Turn into Heading 3", icon: Heading3, nextKind: "heading", patch: { level: "3", text: String(block.props.text ?? "") } },
        { id: "to-quote", label: "Turn into Quote", icon: QuoteIcon, nextKind: "quote", patch: { text: String(block.props.text ?? "") } },
        { id: "to-list", label: "Turn into List", icon: ListIcon, nextKind: "list", patch: { items: String(block.props.text ?? "") } },
        ...alignActions("paragraph"),
      ];
    case "quote":
      return [
        { id: "to-paragraph", label: "Turn into Paragraph", icon: TypeIcon, nextKind: "paragraph", patch: { text: String(block.props.text ?? "") } },
        { id: "to-h3", label: "Turn into Heading 3", icon: Heading3, nextKind: "heading", patch: { level: "3", text: String(block.props.text ?? "") } },
      ];
    case "list":
      return [
        { id: "list-unordered", label: "Bulleted list", icon: ListIcon, nextKind: "list", patch: { items: block.props.items, ordered: false } },
        { id: "list-ordered", label: "Numbered list", icon: ListOrdered, nextKind: "list", patch: { items: block.props.items, ordered: true } },
        { id: "to-paragraph", label: "Turn into Paragraph", icon: TypeIcon, nextKind: "paragraph", patch: { text: String(block.props.items ?? "") } },
      ];
    case "button":
      return buttonVariants.filter((t) => String(block.props.variant) !== String(t.patch?.variant));
    case "image":
      return imageRatios.filter((t) => String(block.props.ratio) !== String(t.patch?.ratio));
    case "grid":
      return [...columnsPresets("grid"), ...gapPresets("grid")];
    case "columns":
      return [...columnsPresets("columns"), ...gapPresets("columns")];
    case "stack": {
      const dir = String(block.props.direction ?? "row");
      return [
        ...(dir !== "row" ? [{ id: "stack-row", label: "Make horizontal", icon: ArrowLeftRight, nextKind: "stack" as BlockKind, patch: { direction: "row" } }] : []),
        ...(dir !== "column" ? [{ id: "stack-col", label: "Make vertical", icon: ArrowDownUp, nextKind: "stack" as BlockKind, patch: { direction: "column" } }] : []),
        ...gapPresets("stack"),
      ];
    }
    case "card-group":
    case "cta-group":
      return gapPresets(block.kind);
    default:
      return [];
  }
}
