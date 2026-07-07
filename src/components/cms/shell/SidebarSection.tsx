import type { ReactNode } from "react";

interface Props {
  label: string;
  children: ReactNode;
}

export function SidebarSection({ label, children }: Props) {
  return (
    <div className="mt-5 first:mt-1">
      <div className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
        {label}
      </div>
      <ul className="flex flex-col gap-px">{children}</ul>
    </div>
  );
}
