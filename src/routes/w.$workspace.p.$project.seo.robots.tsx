import { createFileRoute } from "@tanstack/react-router";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSaveSeoSettings, useSeoSettings } from "@/lib/seo/queries";

const DEFAULT_ROBOTS = `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: https://example.com/sitemap.xml
`;

export const Route = createFileRoute("/w/$workspace/p/$project/seo/robots")({
  component: RobotsPage,
});

function RobotsPage() {
  const { workspace, project } = Route.useParams();
  const scope = { workspace, project };
  const { data } = useSeoSettings(scope);
  const save = useSaveSeoSettings(scope);
  const [text, setText] = useState(DEFAULT_ROBOTS);

  useEffect(() => {
    if (data?.robots_txt != null) setText(data.robots_txt);
  }, [data?.robots_txt]);

  return (
    <>
      <header className="mb-6">
        <h1 className="text-[20px] font-semibold tracking-tight">Robots</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Control which crawlers can access your site. Includes AI crawlers (GPTBot, ClaudeBot, PerplexityBot).
        </p>
      </header>
      <div className="rounded-xl border border-border bg-card p-6">
        <Textarea
          rows={16}
          className="font-mono text-[12px] bg-[var(--surface-focused)]"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setText(DEFAULT_ROBOTS)} className="h-8 rounded-md border border-border bg-background px-3 text-[12px]">
            Reset
          </button>
          <button
            onClick={async () => {
              await save.mutateAsync({ robots_txt: text });
              toast.success("Robots.txt saved");
            }}
            disabled={save.isPending}
            className="inline-flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </>
  );
}

