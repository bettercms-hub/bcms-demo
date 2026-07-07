/**
 * Section derivation helpers — Phase 1 (BetterCMS 5.0).
 * Pure read-only derivations over the existing Section model. No store changes.
 */
import type { Block, Section } from "@/lib/cms/types";
import { blockSummary } from "@/lib/cms/blocks/summary";

export interface SectionSummary {
  blockCount: number;
  ctaCount: number;
  /** First heading text, if any, otherwise first block summary. */
  preview: string;
}

export function summarizeSection(section: Section): SectionSummary {
  const blocks = section.blocks ?? [];
  return {
    blockCount: countBlocks(blocks),
    ctaCount: countCtas(blocks),
    preview: derivePreview(blocks),
  };
}

export function countBlocks(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    n += 1;
    if (b.children?.length) n += countBlocks(b.children);
  }
  return n;
}

export function countCtas(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    if (b.kind === "button" || b.kind === "cta-group") n += 1;
    if (b.children?.length) n += countCtas(b.children);
  }
  return n;
}

export function derivePreview(blocks: Block[]): string {
  const headings: Block[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      if (b.kind === "heading") headings.push(b);
      if (b.children?.length) walk(b.children);
    }
  };
  walk(blocks);
  if (headings.length > 0) {
    const t = typeof headings[0].props.text === "string" ? headings[0].props.text : "";
    if (t) return truncate(t, 80);
  }
  if (blocks.length > 0) {
    const s = blockSummary(blocks[0]);
    if (s) return s;
  }
  return "";
}

function truncate(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}
