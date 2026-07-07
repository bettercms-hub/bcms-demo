/** Shared form atoms for the Layout / Style / SEO tabs. Local-only. */
import * as React from "react";
import { Segmented } from "@/components/ui/segmented";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[12px] font-medium text-foreground">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-surface/40 p-4">
      <div className="mb-3">
        <div className="text-[12.5px] font-semibold text-foreground">{title}</div>
        {description && (
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">{description}</div>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function SegmentedField<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <Field label={label} hint={hint}>
      <Segmented size="sm" value={value} onChange={onChange} options={options} />
    </Field>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
      />
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-foreground">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`h-8 w-full rounded-md border bg-background px-2.5 text-[12.5px] outline-none focus:ring-2 focus:ring-primary/30 ${
        invalid ? "border-destructive" : "border-border"
      }`}
    />
  );
}

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-8 w-full rounded-md border border-border bg-background px-2 text-[12.5px] outline-none focus:ring-2 focus:ring-primary/30"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
