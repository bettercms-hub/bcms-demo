/**
 * Phase 5 — AI text actions.
 *
 * Maps a block kind to the prop name that holds its primary user-visible
 * copy, plus a list of preset "rewrite" instructions used by the toolbar
 * AI popover.
 */
import type { BlockKind } from "@/lib/cms/blocks/registry";

/** The prop on a block that the AI rewriter targets. */
export const PRIMARY_TEXT_FIELD: Partial<Record<BlockKind, string>> = {
  heading: "text",
  paragraph: "text",
  quote: "text",
  list: "items",
  button: "label",
  card: "body",
};

export function getAiTextField(kind: BlockKind): string | undefined {
  return PRIMARY_TEXT_FIELD[kind];
}

export interface RewritePreset {
  id: string;
  label: string;
  instruction: string;
  hint?: string;
}

export const REWRITE_PRESETS: RewritePreset[] = [
  { id: "improve", label: "Improve writing", instruction: "Improve clarity, flow, and impact without changing the meaning." },
  { id: "shorter", label: "Make shorter", instruction: "Rewrite to be roughly half as long while keeping the key points." },
  { id: "longer", label: "Make longer", instruction: "Expand with one or two extra concrete details. Keep it tight." },
  { id: "grammar", label: "Fix grammar & spelling", instruction: "Fix grammar, spelling and punctuation. Do not change the wording otherwise." },
  { id: "continue", label: "Continue writing", instruction: "Continue the text naturally with one or two additional sentences." },
];

export const TONE_PRESETS: RewritePreset[] = [
  { id: "tone-friendly", label: "Friendly", instruction: "Rewrite in a warm, friendly tone.", hint: "friendly" },
  { id: "tone-professional", label: "Professional", instruction: "Rewrite in a confident, professional tone.", hint: "professional" },
  { id: "tone-casual", label: "Casual", instruction: "Rewrite in a casual, conversational tone.", hint: "casual" },
  { id: "tone-bold", label: "Bold", instruction: "Rewrite in a bold, punchy marketing tone.", hint: "bold" },
];
