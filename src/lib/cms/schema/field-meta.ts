/**
 * Shared metadata for schema field types.
 * Single source of truth for icons, category, and colour accent used by
 * the schema builder, field-type picker, and collection table headers.
 */
import {
  AlignLeft,
  Boxes,
  Calendar,
  Code as CodeIcon,
  Component as CompIcon,
  File as FileIcon,
  Hash,
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  Mail,
  Palette,
  Paperclip,
  ToggleLeft,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { SchemaFieldType } from "@/lib/cms/types";

export type FieldCategory = "Basic" | "Numeric" | "Media" | "Relations" | "Advanced";

export interface FieldTypeMeta {
  type: SchemaFieldType;
  label: string;
  desc: string;
  icon: LucideIcon;
  category: FieldCategory;
}

/** CSS variable for category accent — re-uses block accent palette. */
export const CATEGORY_ACCENT: Record<FieldCategory, string> = {
  Basic: "var(--accent-content)",
  Numeric: "var(--accent-content)",
  Media: "var(--accent-media)",
  Relations: "var(--accent-interactive)",
  Advanced: "var(--accent-advanced)",
};

export const FIELD_TYPES: FieldTypeMeta[] = [
  { type: "text",          label: "Text",           desc: "Single-line string.",       icon: Type,        category: "Basic" },
  { type: "richText",      label: "Rich text",      desc: "Long-form formatted content.", icon: AlignLeft, category: "Basic" },
  { type: "boolean",       label: "Boolean",        desc: "True / false toggle.",       icon: ToggleLeft,  category: "Basic" },
  { type: "select",        label: "Select",         desc: "One value from a list.",    icon: List,        category: "Basic" },
  { type: "url",           label: "URL",            desc: "Validated link.",           icon: LinkIcon,    category: "Basic" },
  { type: "email",         label: "Email",          desc: "Validated email address.",  icon: Mail,        category: "Basic" },

  { type: "number",        label: "Number",         desc: "Integer or decimal value.", icon: Hash,        category: "Numeric" },
  { type: "date",          label: "Date",           desc: "Calendar date.",            icon: Calendar,    category: "Numeric" },
  { type: "color",         label: "Color",          desc: "Hex color value.",          icon: Palette,     category: "Numeric" },

  { type: "image",         label: "Image",          desc: "From the media library.",   icon: ImageIcon,   category: "Media" },
  { type: "file",          label: "File",           desc: "Any uploaded asset.",       icon: Paperclip,   category: "Media" },

  { type: "reference",     label: "Reference",      desc: "Link to a single entry.",   icon: FileIcon,    category: "Relations" },
  { type: "multiReference",label: "Multi-reference",desc: "Link many entries.",        icon: Boxes,       category: "Relations" },
  { type: "componentRef",  label: "Component",      desc: "Embed a component.",        icon: CompIcon,    category: "Relations" },

  { type: "json",          label: "JSON",           desc: "Structured data blob.",     icon: CodeIcon,    category: "Advanced" },
  { type: "code",          label: "Code",           desc: "Raw code snippet.",         icon: CodeIcon,    category: "Advanced" },
];

export const FIELD_TYPE_META: Record<SchemaFieldType, FieldTypeMeta> = FIELD_TYPES.reduce(
  (acc, m) => ({ ...acc, [m.type]: m }),
  {} as Record<SchemaFieldType, FieldTypeMeta>,
);

export const FIELD_CATEGORIES: FieldCategory[] = ["Basic", "Numeric", "Media", "Relations", "Advanced"];
