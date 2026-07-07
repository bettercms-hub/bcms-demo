import { useEffect, useState } from "react";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ErrorFallback, isChunkLoadError } from "./AppErrorBoundary";

export function ChunkErrorListener() {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (isChunkLoadError(reason)) {
        const err =
          reason instanceof Error ? reason : new Error(String(reason));
        reportLovableError(err, { boundary: "chunk_error_listener" });
        setError(err);
      }
    };

    const handleError = (event: ErrorEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "SCRIPT" || target.tagName === "LINK")
      ) {
        const err = new Error(
          `Failed to load asset: ${(target as HTMLScriptElement).src || (target as HTMLLinkElement).href}`,
        );
        reportLovableError(err, { boundary: "chunk_error_listener_asset" });
        setError(err);
      } else if (isChunkLoadError(event.error ?? event.message)) {
        const err =
          event.error instanceof Error
            ? event.error
            : new Error(event.message);
        reportLovableError(err, { boundary: "chunk_error_listener" });
        setError(err);
      }
    };

    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleError, true);
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleError, true);
    };
  }, []);

  if (!error) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background">
      <ErrorFallback
        error={error}
        onReload={() => window.location.reload()}
        onReset={() => setError(null)}
      />
    </div>
  );
}
