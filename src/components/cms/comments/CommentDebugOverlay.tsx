import { useEffect, useState } from "react";
import { commentsUi, useCommentsUi } from "@/lib/cms/comments-store";

/**
 * Lightweight, dev-only overlay that surfaces the live comment UI store
 * (modeOn, sidebarOpen, activeThreadId, pending pin, filter, search) so we
 * can quickly diagnose why the inline composer didn't open in a given case.
 *
 * Toggle with Ctrl+Shift+, (or ?debugComments=1, or
 * localStorage.cmsDebugComments = "1"). Disabled in production unless one of
 * those flags is set.
 */
export function CommentDebugOverlay() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("debugComments") === "1") return true;
      if (window.localStorage.getItem("cmsDebugComments") === "1") return true;
    } catch {
      // ignore
    }
    return false;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ctrl/Cmd + Shift + ,  → toggle overlay
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === ",") {
        e.preventDefault();
        setVisible((v) => {
          const next = !v;
          try {
            window.localStorage.setItem("cmsDebugComments", next ? "1" : "0");
          } catch {
            // ignore
          }
          return next;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const modeOn = useCommentsUi((s) => s.modeOn);
  const sidebarOpen = useCommentsUi((s) => s.sidebarOpen);
  const activeThreadId = useCommentsUi((s) => s.activeThreadId);
  const hoverThreadId = useCommentsUi((s) => s.hoverThreadId);
  const pending = useCommentsUi((s) => s.pending);
  const filter = useCommentsUi((s) => s.filter);
  const search = useCommentsUi((s) => s.search);
  const surfaceFilter = useCommentsUi((s) => s.surfaceFilter);

  if (!visible) return null;

  return (
    <div
      data-no-comment
      onClickCapture={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        bottom: 12,
        right: 12,
        zIndex: 2147483646,
        maxWidth: 360,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 11,
        lineHeight: 1.4,
        color: "#e5e7eb",
        background: "rgba(15, 23, 42, 0.92)",
        border: "1px solid rgba(148, 163, 184, 0.35)",
        borderRadius: 8,
        padding: "8px 10px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        pointerEvents: "auto",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
          gap: 8,
        }}
      >
        <strong style={{ color: "#a5b4fc" }}>comments · debug</strong>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={() => commentsUi.setPending(null)}
            style={btn}
            title="Clear pending pin"
          >
            clear pending
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.setItem("cmsDebugComments", "0");
              } catch {
                // ignore
              }
              setVisible(false);
            }}
            style={btn}
            title="Hide (Ctrl+Shift+,)"
          >
            ×
          </button>
        </div>
      </div>
      <Row k="modeOn" v={String(modeOn)} accent={modeOn ? "#34d399" : "#9ca3af"} />
      <Row k="sidebarOpen" v={String(sidebarOpen)} />
      <Row k="activeThreadId" v={activeThreadId ?? "—"} />
      <Row k="hoverThreadId" v={hoverThreadId ?? "—"} />
      <Row k="filter" v={`${filter} · ${surfaceFilter}`} />
      <Row k="search" v={search ? JSON.stringify(search) : "—"} />
      <div
        style={{
          marginTop: 6,
          paddingTop: 6,
          borderTop: "1px solid rgba(148, 163, 184, 0.2)",
        }}
      >
        <div style={{ color: "#a5b4fc", marginBottom: 4 }}>pending</div>
        {pending ? (
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "#fde68a",
            }}
          >
            {JSON.stringify(pending, null, 2)}
          </pre>
        ) : (
          <div style={{ color: "#9ca3af" }}>null (no inline composer)</div>
        )}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  appearance: "none",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  background: "rgba(30, 41, 59, 0.8)",
  color: "#e5e7eb",
  borderRadius: 4,
  padding: "1px 6px",
  fontSize: 10,
  cursor: "pointer",
  fontFamily: "inherit",
};

function Row({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <span style={{ color: "#94a3b8", minWidth: 110 }}>{k}</span>
      <span style={{ color: accent ?? "#e5e7eb", wordBreak: "break-all" }}>{v}</span>
    </div>
  );
}
