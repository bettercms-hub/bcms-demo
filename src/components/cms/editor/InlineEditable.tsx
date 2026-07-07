import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
} from "react";

type Size = "sm" | "md" | "lg" | "xl";

interface Props
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "size" | "onChange" | "value" | "prefix"
  > {
  value: string;
  onChange: (v: string) => void;
  /** Visual scale — drives padding + type size. */
  size?: Size;
  /** Render the input monospaced (slugs, URLs). */
  mono?: boolean;
  /** Optional inline-content adornment to the left of the field. */
  prefix?: React.ReactNode;
  /** Optional inline-content adornment to the right of the field. */
  suffix?: React.ReactNode;
  /** When true, the container expands to fill its parent's width. */
  fullWidth?: boolean;
  /** Override container className for one-off layouts (e.g. flex sizing). */
  containerClassName?: string;
  /** Inline style passthrough on the wrapping container. */
  containerStyle?: CSSProperties;
}

const SIZE_MAP: Record<Size, { wrap: string; input: string }> = {
  sm: { wrap: "h-7 px-1.5", input: "text-[13px]" },
  md: { wrap: "h-8 px-2", input: "text-[14px]" },
  lg: { wrap: "h-9 px-2", input: "text-[15px] font-medium" },
  xl: { wrap: "h-11 px-2", input: "text-[22px] font-semibold tracking-tight" },
};

/**
 * Notion / Linear style inline editable text field.
 *
 * Borderless at rest; the container softly outlines on hover and shows a
 * full focus ring while editing. Designed to drop into any header where a
 * heavy bordered <input> would feel like a form.
 */
export const InlineEditable = forwardRef<HTMLInputElement, Props>(function InlineEditable(
  {
    value,
    onChange,
    size = "md",
    mono = false,
    prefix,
    suffix,
    fullWidth = true,
    containerClassName = "",
    containerStyle,
    className = "",
    onBlur,
    onKeyDown,
    placeholder,
    ...rest
  },
  ref,
) {
  const innerRef = useRef<HTMLInputElement | null>(null);
  const setRef = (el: HTMLInputElement | null) => {
    innerRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
  };

  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  // Coalesce upstream onChange to one call per animation frame. The local
  // <input> stays controlled by `draft` so keystrokes feel instant, but the
  // store-side cascade (which can re-render the full section tree) batches.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<string | null>(null);
  const flush = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pendingRef.current != null) {
      const v = pendingRef.current;
      pendingRef.current = null;
      onChangeRef.current(v);
    }
  };
  useEffect(() => () => flush(), []);
  const scheduleChange = (v: string) => {
    pendingRef.current = v;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next != null) onChangeRef.current(next);
    });
  };

  const { wrap, input } = SIZE_MAP[size];

  return (
    <div
      data-focused={focused ? "" : undefined}
      style={containerStyle}
      className={[
        "group/inline relative inline-flex items-center gap-1.5 rounded-md transition-colors",
        wrap,
        fullWidth ? "w-full" : "",
        // Hover affordance (visible only when not editing)
        "hover:bg-[color:var(--color-row-hover)]/60",
        // Focused state: panel surface + ring
        "data-[focused]:bg-[color:var(--color-panel)] data-[focused]:ring-1 data-[focused]:ring-ring/40",
        containerClassName,
      ].join(" ")}
    >
      {prefix && (
        <span className="shrink-0 text-muted-foreground/80">{prefix}</span>
      )}
      <input
        ref={setRef}
        value={draft}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setDraft(e.target.value);
          scheduleChange(e.target.value);
        }}
        onBlur={(e) => {
          setFocused(false);
          flush();
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            flush();
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            pendingRef.current = null;
            if (rafRef.current != null) {
              cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
            }
            setDraft(value);
            (e.currentTarget as HTMLInputElement).blur();
          }
          onKeyDown?.(e);
        }}
        className={[
          "min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/60",
          mono ? "font-mono" : "",
          input,
          className,
        ].join(" ")}
        {...rest}
      />
      {suffix && (
        <span className="shrink-0 text-muted-foreground/80">{suffix}</span>
      )}
    </div>
  );
});
