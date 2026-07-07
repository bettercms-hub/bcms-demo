import { Sparkles } from "lucide-react";

interface Props {
  engine: "ai-overview" | "chatgpt" | "perplexity" | "claude" | "gemini";
  title: string;
  description: string;
  url: string;
}

const ENGINE_META: Record<
  Props["engine"],
  { name: string; tint: string; intro: string }
> = {
  "ai-overview": {
    name: "Google AI Overview",
    tint: "from-blue-500/10 to-purple-500/10",
    intro: "Based on multiple sources, here's what we found:",
  },
  chatgpt: {
    name: "ChatGPT",
    tint: "from-emerald-500/10 to-teal-500/10",
    intro: "Here's a summary based on the page:",
  },
  perplexity: {
    name: "Perplexity",
    tint: "from-sky-500/10 to-indigo-500/10",
    intro: "Drawing from the indexed source:",
  },
  claude: {
    name: "Claude",
    tint: "from-orange-500/10 to-amber-500/10",
    intro: "From the page content:",
  },
  gemini: {
    name: "Gemini",
    tint: "from-violet-500/10 to-blue-500/10",
    intro: "Here's what I found on this page:",
  },
};

export function AiAnswerPreview({ engine, title, description, url }: Props) {
  const meta = ENGINE_META[engine];
  const display = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className={`rounded-lg border border-border bg-gradient-to-br ${meta.tint} p-5`}>
      <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-foreground">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
        <span>{meta.name}</span>
      </div>
      <p className="mb-3 text-[12px] text-muted-foreground">{meta.intro}</p>
      <p className="mb-3 text-[14px] leading-relaxed text-foreground">
        <strong className="font-semibold">{title || "This page"}</strong>{" "}
        {description ||
          "covers the topic at hand. Add a meta description so AI engines can summarize accurately."}
      </p>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="rounded bg-background/80 px-1.5 py-0.5 font-mono">cite</span>
        <span className="truncate">{display}</span>
      </div>
    </div>
  );
}
