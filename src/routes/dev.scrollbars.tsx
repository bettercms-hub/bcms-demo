import { createFileRoute } from "@tanstack/react-router";
import { useAppearance } from "@/lib/cms/appearance";

export const Route = createFileRoute("/dev/scrollbars")({
  component: ScrollbarsTest,
});

function FillerLines({ count = 60, prefix = "Row" }: { count?: number; prefix?: string }) {
  return (
    <ul className="space-y-2 text-sm">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="rounded-md border border-border px-3 py-2 text-foreground/80">
          {prefix} {i + 1} — the quick brown fox jumps over the lazy dog.
        </li>
      ))}
    </ul>
  );
}

function Panel({
  title,
  surface,
  className = "",
}: {
  title: string;
  surface: string;
  className?: string;
}) {
  return (
    <section className={`flex h-80 flex-col overflow-hidden rounded-lg border border-border ${surface} ${className}`}>
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          scroll me
        </span>
      </header>
      <div className="flex-1 overflow-auto p-3">
        <FillerLines />
      </div>
    </section>
  );
}

function ScrollbarsTest() {
  const [mode, setMode] = useAppearance();
  return (
    <div className="min-h-dvh bg-background p-6 text-foreground">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Scrollbar visual test</h1>
          <p className="text-sm text-muted-foreground">
            Verify track, thumb, hover, and corner colors across surfaces and themes.
          </p>
        </div>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md border border-border px-3 py-1.5 text-xs font-medium capitalize ${
                mode === m ? "bg-primary text-primary-foreground" : "bg-surface text-foreground hover:bg-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="App background" surface="bg-background" />
        <Panel title="Sidebar surface" surface="bg-sidebar" />
        <Panel title="Panel surface" surface="bg-panel" />
        <Panel title="Surface" surface="bg-surface" />
        <Panel title="Card" surface="bg-card" />
        <Panel title="Muted" surface="bg-muted" />
      </div>

      <section className="mt-6 rounded-lg border border-border bg-surface">
        <header className="border-b border-border px-3 py-2 text-sm font-semibold">
          Horizontal scroll
        </header>
        <div className="overflow-x-auto p-3">
          <div className="flex gap-3">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="flex h-24 w-40 shrink-0 items-center justify-center rounded-md border border-border bg-panel text-sm text-foreground/80"
              >
                Card {i + 1}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="overflow-auto rounded-lg border border-border bg-panel p-3" style={{ height: 240 }}>
          <h3 className="mb-2 text-sm font-semibold">Both axes</h3>
          <div style={{ width: 1200 }}>
            <FillerLines count={30} prefix="Wide row" />
          </div>
        </div>
        <textarea
          className="h-60 w-full resize-none rounded-lg border border-border bg-input-bg p-3 text-sm"
          defaultValue={Array.from({ length: 40 }, (_, i) => `Line ${i + 1}`).join("\n")}
        />
      </section>
    </div>
  );
}
