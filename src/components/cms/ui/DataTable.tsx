import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
  className?: string;
}

interface Props<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  dense?: boolean;
  /** Deprecated — kept for API compat, ignored. Operating-UI rules forbid zebra. */
  zebra?: boolean;
  className?: string;
  isSelected?: (row: T) => boolean;
}

/**
 * Operating-UI data table.
 *
 * Rules:
 *  - no outer card / no enclosing background
 *  - transparent rows; hairline separators only
 *  - sticky transparent header, stronger typography
 *  - hover = subtle brighten + shadow-1 (never another gray fill)
 *  - selected = 2px accent left-rail + tinted row
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  dense = false,
  className = "",
  isSelected,
}: Props<T>) {
  if (rows.length === 0) {
    return (
      <div
        className={`rounded-md border border-dashed border-[color:var(--border)] p-8 text-center text-[13px] text-muted-foreground ${className}`}
      >
        {empty ?? "No rows yet."}
      </div>
    );
  }

  const rowPad = dense ? "py-2" : "py-3";

  return (
    <div className={`w-full ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 z-[1] bg-[color:var(--canvas)]/85 backdrop-blur">
          <tr className="border-b border-[color:var(--border-hairline)]">
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className={`h-9 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground ${
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""
                }`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const sel = isSelected?.(row) ?? false;
            return (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                data-selected={sel || undefined}
                className={[
                  "group/row relative border-b border-[color:var(--border-hairline)] last:border-b-0",
                  "transition-[background-color,box-shadow] duration-[120ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                  onRowClick ? "cursor-pointer" : "",
                  "hover:bg-[color:var(--row-hover)]",
                  sel ? "bg-[color:var(--row-selected)]" : "",
                ].join(" ")}
              >
                {sel && (
                  <td
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-[2px] bg-primary p-0"
                  />
                )}
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`${rowPad} px-3 align-middle text-[13px] text-foreground ${
                      c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""
                    } ${c.className ?? ""}`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
