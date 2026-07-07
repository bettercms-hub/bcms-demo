/**
 * InlineText — minimal contentEditable for inline editing inside the live
 * preview. Used for plain-text block fields (heading.text, paragraph.text,
 * button.label). Rich-text still uses the dedicated inspector.
 *
 * Behaviour:
 *  - Always renders the value visually identical to the read-only form.
 *  - Becomes editable when `editable` is true (typically: block is selected).
 *  - Commits on blur and on Enter (Shift+Enter inserts newline only when
 *    `multiline` is true).
 *  - Escape reverts to the original value and blurs.
 */
import { useEffect, useRef, type ElementType, type ReactElement } from "react";

interface Props {
  value: string;
  onCommit: (next: string) => void;
  as?: ElementType;
  className?: string;
  placeholder?: string;
  editable?: boolean;
  multiline?: boolean;
}

export function InlineText({
  value,
  onCommit,
  as,
  className = "",
  placeholder = "",
  editable = false,
  multiline = false,
}: Props): ReactElement {
  const ref = useRef<HTMLElement | null>(null);
  const initialRef = useRef<string>(value);

  // Sync external value into the DOM when it changes from outside.
  useEffect(() => {
    if (ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
    initialRef.current = value;
  }, [value]);

  const Tag = (as ?? "span") as ElementType;
  const isEmpty = !value;

  return (
    <Tag
      ref={ref as never}
      contentEditable={editable || undefined}
      suppressContentEditableWarning
      data-placeholder={placeholder || undefined}
      spellCheck={editable || undefined}
      onMouseDown={(e: React.MouseEvent) => {
        if (editable) e.stopPropagation();
      }}
      onClick={(e: React.MouseEvent) => {
        if (editable) e.stopPropagation();
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (!editable) return;
        if (e.key === "Enter" && !(multiline && e.shiftKey)) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          if (ref.current) ref.current.textContent = initialRef.current;
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      onBlur={(e: React.FocusEvent) => {
        if (!editable) return;
        const next = (e.currentTarget.textContent ?? "").trim();
        if (next !== initialRef.current) onCommit(next);
      }}
      className={
        className +
        (editable
          ? " outline-none focus:bg-[color:var(--color-row-hover)]/40 rounded-[3px] -mx-1 px-1 "
          : "") +
        (isEmpty && placeholder
          ? " before:content-[attr(data-placeholder)] before:text-muted-foreground/60 before:pointer-events-none"
          : "")
      }
    >
      {value}
    </Tag>
  );
}
