/**
 * AiDraftDialog — prompts the user for a brief, then calls
 * `generateSection` and inserts the resulting blocks at the configured
 * parent path / index. Used from the InsertCommand "AI" group.
 */
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateSection } from "@/lib/cms/ai/editor-actions.functions";
import { blockActions } from "@/lib/cms/store";
import type { BlockPath } from "@/lib/cms/blocks/operations";
import type { SectionKind, BlockKind } from "@/lib/cms/types";
import { BLOCK_REGISTRY } from "@/lib/cms/blocks/registry";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: string;
  parentPath: BlockPath;
  atIndex: number;
  sectionKind?: SectionKind;
  onInserted?: (firstPath: BlockPath) => void;
}

const SUGGESTIONS = [
  "A short pricing teaser with three plans",
  "FAQ with five common questions about our API",
  "Hero section for a developer-focused launch",
  "Three-step onboarding flow with icons",
];

export function AiDraftDialog({
  open,
  onOpenChange,
  sectionId,
  parentPath,
  atIndex,
  sectionKind,
  onInserted,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { blocks } = await generateSection({
        data: { prompt: text.trim(), sectionKind },
      });
      const built = blocks.map(buildBlock);
      // Insert sequentially so we can track the first inserted path.
      let firstPath: BlockPath | null = null;
      built.forEach((b, i) => {
        const path = blockActions.add(
          sectionId,
          parentPath,
          b.kind,
          atIndex + i,
        );
        if (i === 0) firstPath = path;
        // Patch props/children after creation since `add` resets to defaults.
        blockActions.update(sectionId, path, b.props);
        if (b.children && b.children.length > 0) {
          b.children.forEach((child, ci) => {
            const cp = blockActions.add(sectionId, path, child.kind, ci);
            blockActions.update(sectionId, cp, child.props);
          });
        }
      });
      toast.success(`Generated ${built.length} block${built.length === 1 ? "" : "s"}`);
      onOpenChange(false);
      setPrompt("");
      if (firstPath) onInserted?.(firstPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI request failed.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Draft with AI
          </DialogTitle>
          <DialogDescription>
            Describe what you want to insert. AI will generate a small block
            tree you can edit.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(prompt);
          }}
          className="flex flex-col gap-3"
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Hero for a calm sleep tracker — emphasise privacy and battery life"
            rows={3}
            disabled={busy}
            autoFocus
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-foreground/40"
          />

          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => {
                  setPrompt(s);
                }}
                className="rounded-full border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !prompt.trim()}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- helpers ----

type ServerBlock = {
  kind: string;
  props: Record<string, unknown>;
  children?: ServerBlock[];
};

function buildBlock(b: ServerBlock): { kind: BlockKind; props: Record<string, unknown>; children?: { kind: BlockKind; props: Record<string, unknown> }[] } {
  // Merge against the registry defaults so we never end up with a block
  // that's missing required props.
  const def = BLOCK_REGISTRY[b.kind as BlockKind];
  const props = def ? { ...def.defaults(), ...b.props } : { ...b.props };
  const out: { kind: BlockKind; props: Record<string, unknown>; children?: { kind: BlockKind; props: Record<string, unknown> }[] } = {
    kind: b.kind as BlockKind,
    props,
  };
  if (b.children && b.children.length > 0) {
    out.children = b.children.map((c) => {
      const cdef = BLOCK_REGISTRY[c.kind as BlockKind];
      return {
        kind: c.kind as BlockKind,
        props: cdef ? { ...cdef.defaults(), ...c.props } : { ...c.props },
      };
    });
  }
  return out;
}
