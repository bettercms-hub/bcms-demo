/**
 * AskAIPanel — popover invoked from the BlockToolbar's AI button.
 *
 * Shows preset rewrite actions, tone shifts, and a free-form prompt input.
 * Calls the `rewriteText` server function and writes the result back to
 * the block's primary text field via `blockActions.update`.
 */
import { useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { blockActions } from "@/lib/cms/store";
import type { Block, Section } from "@/lib/cms/types";
import { rewriteText } from "@/lib/cms/ai/editor-actions.functions";
import {
  getAiTextField,
  REWRITE_PRESETS,
  TONE_PRESETS,
  type RewritePreset,
} from "@/lib/cms/ai/preset-actions";

interface Props {
  section: Section;
  block: Block;
  path: number[];
  children: React.ReactNode;
  /** Controlled open from the toolbar pill. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AskAIPanel({ section, block, path, children, open, onOpenChange }: Props) {
  const field = getAiTextField(block.kind);
  const currentText = field ? String(block.props[field] ?? "") : "";
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState<string | null>(null);

  if (!field) {
    return <>{children}</>;
  }

  const run = async (preset: RewritePreset | { instruction: string; hint?: string; id: string }) => {
    if (!currentText.trim()) {
      toast.error("Add some text first, then ask AI to rewrite it.");
      return;
    }
    setRunning(preset.id);
    try {
      const { text } = await rewriteText({
        data: { text: currentText, instruction: preset.instruction, hint: preset.hint },
      });
      blockActions.update(section.id, path, { [field]: text });
      toast.success("Updated with AI");
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI request failed.";
      toast.error(msg);
    } finally {
      setRunning(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[280px] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Ask AI
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!prompt.trim()) return;
            void run({ id: "custom", instruction: prompt.trim() });
          }}
          className="border-b border-border p-2"
        >
          <div className="relative">
            <input
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Tell AI what to change…"
              className="h-8 w-full rounded-md border border-border bg-background px-2 pr-8 text-[12.5px] outline-none focus:border-foreground/40"
            />
            <button
              type="submit"
              disabled={!prompt.trim() || running !== null}
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              aria-label="Run prompt"
            >
              {running === "custom" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </form>

        <Group label="Edit">
          {REWRITE_PRESETS.map((p) => (
            <Row
              key={p.id}
              label={p.label}
              loading={running === p.id}
              disabled={running !== null}
              onSelect={() => void run(p)}
            />
          ))}
        </Group>
        <Group label="Change tone">
          {TONE_PRESETS.map((p) => (
            <Row
              key={p.id}
              label={p.label}
              loading={running === p.id}
              disabled={running !== null}
              onSelect={() => void run(p)}
            />
          ))}
        </Group>
      </PopoverContent>
    </Popover>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border last:border-b-0 p-1">
      <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Row({
  label,
  loading,
  disabled,
  onSelect,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-foreground hover:bg-muted disabled:opacity-50"
    >
      <span>{label}</span>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </button>
  );
}
