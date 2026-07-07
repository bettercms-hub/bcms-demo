import {
  Type,
  Mail,
  AlignLeft,
  Phone,
  Hash,
  Link as LinkIcon,
  ChevronDown,
  CircleDot,
  CheckSquare,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import type { FieldKind } from "@/lib/forms/types";

export interface FieldDef {
  kind: FieldKind;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "Basic" | "Choice" | "Advanced";
}

export const FIELD_CATALOG: FieldDef[] = [
  { kind: "text", label: "Short text", description: "Single line input", icon: Type, group: "Basic" },
  { kind: "email", label: "Email", description: "Validated email", icon: Mail, group: "Basic" },
  { kind: "textarea", label: "Long text", description: "Multi-line input", icon: AlignLeft, group: "Basic" },
  { kind: "phone", label: "Phone", description: "Phone number", icon: Phone, group: "Basic" },
  { kind: "number", label: "Number", description: "Numeric input", icon: Hash, group: "Basic" },
  { kind: "url", label: "URL", description: "Website link", icon: LinkIcon, group: "Basic" },
  { kind: "select", label: "Dropdown", description: "Pick one from list", icon: ChevronDown, group: "Choice" },
  { kind: "radio", label: "Radio", description: "Pick one option", icon: CircleDot, group: "Choice" },
  { kind: "checkbox", label: "Checkboxes", description: "Pick many", icon: CheckSquare, group: "Choice" },
  { kind: "consent", label: "Consent", description: "Single checkbox", icon: ShieldCheck, group: "Advanced" },
  { kind: "date", label: "Date", description: "Date picker", icon: Calendar, group: "Advanced" },
];

export function fieldDef(kind: FieldKind): FieldDef {
  return FIELD_CATALOG.find((f) => f.kind === kind) ?? FIELD_CATALOG[0];
}
