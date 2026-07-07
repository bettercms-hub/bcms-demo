import { useEffect } from "react";
import { commentsUi, useCommentsUi } from "@/lib/cms/comments-store";
import { CommentDebugOverlay } from "./CommentDebugOverlay";

/**
 * Owns global comment-mode side-effects: ESC exits mode, `C` hotkey toggles
 * mode, cursor styling on the document body when active.
 */
export function CommentModeProvider({ children }: { children: React.ReactNode }) {
  const modeOn = useCommentsUi((s) => s.modeOn);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (inField) return;
      if (e.key === "Escape" && commentsUi.get().modeOn) {
        commentsUi.setMode(false);
      } else if ((e.key === "c" || e.key === "C") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        commentsUi.toggleMode();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (modeOn) {
      document.body.dataset.commentMode = "on";
      document.body.style.cursor = "crosshair";
    } else {
      delete document.body.dataset.commentMode;
      document.body.style.cursor = "";
    }
    return () => {
      delete document.body.dataset.commentMode;
      document.body.style.cursor = "";
    };
  }, [modeOn]);

  return (
    <>
      {children}
      <CommentDebugOverlay />
    </>
  );
}
