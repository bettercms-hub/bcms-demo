import { Component, type ReactNode, type ErrorInfo } from "react";
import { reportLovableError } from "../lib/lovable-error-reporting";

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk \d+ failed/i,
  /Loading CSS chunk/i,
  /error loading dynamically imported module/i,
];

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (!message) return false;
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(message));
}

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportLovableError(error, {
      boundary: "app_error_boundary",
      componentStack: info.componentStack ?? undefined,
    });
  }

  private reset = () => this.setState({ error: null });

  private reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <ErrorFallback
        error={error}
        onReset={this.reset}
        onReload={this.reload}
      />
    );
  }
}

export function ErrorFallback({
  error,
  onReset,
  onReload,
}: {
  error: Error;
  onReset?: () => void;
  onReload?: () => void;
}) {
  const isChunk = isChunkLoadError(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {isChunk ? "Update available" : "Error"}
        </div>
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
          {isChunk ? "A new version is available" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isChunk
            ? "We couldn't load part of the app. Reload to get the latest version."
            : "An unexpected error occurred. Try again, or reload the page."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {onReset && !isChunk && (
            <button
              onClick={onReset}
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              Try again
            </button>
          )}
          {onReload && (
            <button
              onClick={onReload}
              className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Reload
            </button>
          )}
        </div>
        {error.message && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Technical details
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-surface p-2 text-left text-[11px] leading-snug text-muted-foreground">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
