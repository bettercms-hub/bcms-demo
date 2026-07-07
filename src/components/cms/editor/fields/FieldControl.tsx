import type { LucideIcon } from "lucide-react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
} from "lucide-react";

import type { SchemaField } from "@/lib/cms/types";
import { ReferencePicker, MultiReferencePicker } from "./ReferencePicker";
import { RichTextEditor } from "./RichTextEditor";
import { useCMS } from "@/lib/cms/store";
import { Switch } from "@/components/ui/switch";
import {
  ChipGroup,
  IconToggleGroup,
  SegmentedControl,
  Stepper,
} from "../controls";

interface Props {
  field: SchemaField;
  value: unknown;
  onChange: (v: unknown) => void;
}

const inputCls =
  "h-8 w-full rounded-[6px] border border-border bg-surface px-2 text-[13px] text-foreground transition-colors hover:border-border-strong focus:border-primary focus:outline-none";
const taCls =
  "w-full rounded-[6px] border border-border bg-surface px-2 py-1.5 text-[13px] text-foreground transition-colors hover:border-border-strong focus:border-primary focus:outline-none";

const ICON_MAP: Record<string, LucideIcon> = {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
};

/** Decide which UI primitive to use, honouring explicit `ui` hint first
 *  then falling back to type-based inference. */
function resolveUi(field: SchemaField): SchemaField["ui"] | undefined {
  if (field.ui) return field.ui;
  if (field.type === "boolean") return "switch";
  if (field.type === "select" && (field.options?.length ?? 0) > 0 && (field.options?.length ?? 0) <= 5) {
    return "segmented";
  }
  return undefined;
}

export function FieldControl({ field, value, onChange }: Props) {
  const ph = field.placeholder;

  const components = useCMS((s) => s.components);
  const media = useCMS((s) => s.media);

  // --- UI hint dispatch (takes precedence over type-based rendering) ---
  const ui = resolveUi(field);

  if (ui === "switch") {
    return (
      <div className="inline-flex items-center gap-2 text-[13px]">
        <Switch checked={!!value} onCheckedChange={(v) => onChange(v)} />
        <span className="text-muted-foreground">{value ? "On" : "Off"}</span>
      </div>
    );
  }

  if (ui === "stepper") {
    const v = typeof value === "number" ? value : value === undefined || value === null || value === "" ? undefined : Number(value);
    return (
      <Stepper
        value={v}
        onChange={(n) => onChange(n)}
        min={field.validation?.min}
        max={field.validation?.max}
      />
    );
  }

  if (ui === "icons" && field.options) {
    return (
      <IconToggleGroup
        value={String(value ?? field.defaultValue ?? "")}
        onChange={(v) => onChange(v)}
        options={field.options.map((opt) => {
          const iconName = field.icons?.[opt];
          const Icon = (iconName && ICON_MAP[iconName]) || AlignLeft;
          return { value: opt, icon: Icon, label: opt };
        })}
      />
    );
  }

  if (ui === "segmented" && field.options) {
    return (
      <SegmentedControl
        value={String(value ?? field.defaultValue ?? "")}
        onChange={(v) => onChange(v)}
        options={field.options}
        labels={field.optionLabels}
      />
    );
  }

  if (ui === "chips" && field.options) {
    return (
      <ChipGroup
        value={String(value ?? field.defaultValue ?? "")}
        onChange={(v) => onChange(v)}
        options={field.options}
        labels={field.optionLabels}
      />
    );
  }

  // --- Default per-type rendering ---
  switch (field.type) {
    case "richText":
      return (
        <RichTextEditor
          value={String(value ?? "")}
          placeholder={ph}
          onChange={(v) => onChange(v)}
        />
      );
    case "json":
    case "code":
      return (
        <textarea
          value={String(value ?? "")}
          rows={6}
          placeholder={ph}
          onChange={(e) => onChange(e.target.value)}
          className={`${taCls} font-mono text-[12px]`}
        />
      );
    case "boolean":
      return (
        <div className="inline-flex items-center gap-2 text-[13px]">
          <Switch checked={!!value} onCheckedChange={(v) => onChange(v)} />
          <span className="text-muted-foreground">{value ? "On" : "Off"}</span>
        </div>
      );
    case "number":
      return (
        <input
          type="number"
          value={value === undefined || value === null ? "" : String(value)}
          placeholder={ph}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          className={inputCls}
        />
      );
    case "date":
      return (
        <input
          type="date"
          value={String(value ?? "").slice(0, 10)}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
    case "color":
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={String(value ?? "#000000")}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-10 rounded-[6px] border border-border bg-surface"
          />
          <input
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputCls} font-mono text-[12px]`}
            placeholder="#000000"
          />
        </div>
      );
    case "select":
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        >
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    case "url":
      return (
        <input
          type="url"
          value={String(value ?? "")}
          placeholder={ph ?? "https://"}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} font-mono text-[12px]`}
        />
      );
    case "email":
      return (
        <input
          type="email"
          value={String(value ?? "")}
          placeholder={ph}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
    case "image":
    case "file": {
      const opts = media.filter((m) => field.type === "image" ? m.kind === "image" : true);
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={inputCls}
        >
          <option value="">— none —</option>
          {opts.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      );
    }
    case "reference":
      return (
        <ReferencePicker
          value={typeof value === "string" ? value : undefined}
          onChange={onChange}
          collectionId={field.refCollectionId}
        />
      );
    case "multiReference":
      return (
        <MultiReferencePicker
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          collectionId={field.refCollectionId}
        />
      );
    case "componentRef":
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={inputCls}
        >
          <option value="">— none —</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      );
    case "text":
    default:
      return (
        <input
          value={String(value ?? "")}
          placeholder={ph}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
  }
}

/** Synchronous validation against a field's rules. Returns an error string or null. */
export function validateField(field: SchemaField, value: unknown): string | null {
  if (field.required) {
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      return `${field.label} is required`;
    }
  }
  const v = field.validation;
  if (!v) return null;
  if (typeof value === "string") {
    if (v.minLength != null && value.length < v.minLength) return `Must be at least ${v.minLength} chars`;
    if (v.maxLength != null && value.length > v.maxLength) return `Must be at most ${v.maxLength} chars`;
    if (v.pattern) {
      try {
        if (!new RegExp(v.pattern).test(value)) return "Invalid format";
      } catch { /* ignore bad regex */ }
    }
  }
  if (typeof value === "number") {
    if (v.min != null && value < v.min) return `Must be ≥ ${v.min}`;
    if (v.max != null && value > v.max) return `Must be ≤ ${v.max}`;
  }
  return null;
}
