import type { LucideIcon } from "lucide-react";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
      {Icon && (
        <div className="grid h-10 w-10 place-items-center rounded-md border border-border bg-background text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div>
        <div className="text-[14px] font-semibold text-foreground">{title}</div>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
