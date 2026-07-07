/**
 * Most-recently-used block/section kinds for Quick Insert popovers.
 * Stored in localStorage and capped to a small list.
 */
import type { BlockKind, SectionKind } from "@/lib/cms/types";

const BLOCK_KEY = "bettercms.blocks.recent";
const SECTION_KEY = "bettercms.sections.recent";
const CAP = 12;

function read(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, next: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(next.slice(0, CAP)));
}

function record(key: string, value: string) {
  const list = read(key).filter((v) => v !== value);
  list.unshift(value);
  write(key, list);
}

export function getRecentBlocks(): BlockKind[] {
  return read(BLOCK_KEY) as BlockKind[];
}
export function recordRecentBlock(kind: BlockKind) {
  record(BLOCK_KEY, kind);
}
export function getRecentSections(): SectionKind[] {
  return read(SECTION_KEY) as SectionKind[];
}
export function recordRecentSection(kind: SectionKind) {
  record(SECTION_KEY, kind);
}
