/**
 * Centered, low-key empty state used by the editor views when a node
 * resolves but has no content yet (page with 0 sections, component with
 * no fields, etc.). One icon, one line, one primary action.
 */
import type { LucideIcon } from "lucide-react";
import { ICON_STROKE } from "@/lib/cms/icons";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
}

export function EditorEmpty({ icon: Icon, title, description, action }: Props) {
  const ActionIcon = action?.icon;
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl border border-border bg-[color:var(--s-card)] text-muted-foreground">
          <Icon className="h-5 w-5" strokeWidth={ICON_STROKE} />
        </div>
        <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {ActionIcon && <ActionIcon className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />}
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
