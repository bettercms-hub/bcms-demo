import { FileEdit, Globe } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

// "compare" survives in the type for old localStorage values and bus events;
// the toggle itself only offers Draft and Published.
export type PreviewSource = "draft" | "published" | "compare";

interface Props {
  value: PreviewSource;
  onChange: (v: PreviewSource) => void;
}

const ITEMS: { v: PreviewSource; icon: typeof FileEdit; label: string }[] = [
  { v: "draft", icon: FileEdit, label: "Draft" },
  { v: "published", icon: Globe, label: "Published" },
];

export function SourceToggle({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({
    draft: null, published: null,
  });
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const btn = btnRefs.current[value];
    const wrap = containerRef.current;
    if (!btn || !wrap) return;
    const br = btn.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    setPill({ x: br.left - wr.left, w: br.width });
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-0.5 rounded-[6px] border border-border bg-surface p-0.5"
    >
      {pill && (
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 rounded-[4px] bg-foreground shadow-sm transition-all duration-200 ease-out"
          style={{ left: pill.x, width: pill.w }}
        />
      )}
      {ITEMS.map(({ v, icon: Icon, label }) => {
        const active = value === v;
        return (
          <button
            key={v}
            ref={(el) => { btnRefs.current[v] = el; }}
            type="button"
            onClick={() => onChange(v)}
            title={label}
            className={`relative z-[1] flex h-7 items-center gap-1.5 rounded-[4px] px-2.5 text-[11px] font-medium transition-colors ${
              active ? "text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
