/**
 * Brand Kit — the single source of truth for a project's identity.
 *
 * Colors, typography, shape, logos, and voice live here as named tokens.
 * Components and the agent reference tokens, never raw values, so one
 * edit here restyles everything that points at it.
 *
 * Three ways in: edit by hand on the Brand page, import a design.md
 * (parsed, reviewed, then applied), or write the same JSON over the API.
 * Versioned: every save bumps the version so changes are traceable.
 */
import { useSyncExternalStore } from "react";

/* ------------------------------------------------------------- model */

export interface BrandColors {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
}

export interface BrandTypography {
  headingFont: string;
  bodyFont: string;
}

export type BrandRadius = "sharp" | "rounded" | "pill";

export interface BrandLogos {
  /** Wordmark text used until a real asset pipeline exists. */
  wordmark: string;
  /** One or two characters used as the mark. */
  mark: string;
}

export interface BrandVoice {
  tone: string;
  doWords: string[];
  dontWords: string[];
  protectedPhrases: string[];
}

export interface BrandKit {
  projectId: string;
  version: number;
  updatedAt: number;
  colors: BrandColors;
  typography: BrandTypography;
  radius: BrandRadius;
  logos: BrandLogos;
  voice: BrandVoice;
}

/** Curated font choices; each maps to a stack that renders in the demo. */
export const BRAND_FONTS: { id: string; label: string; stack: string }[] = [
  { id: "inter", label: "Inter", stack: "Inter, system-ui, sans-serif" },
  { id: "epilogue", label: "Epilogue", stack: "Epilogue, Avenir, system-ui, sans-serif" },
  { id: "georgia", label: "Georgia", stack: "Georgia, 'Times New Roman', serif" },
  { id: "trebuchet", label: "Trebuchet", stack: "'Trebuchet MS', Verdana, sans-serif" },
  { id: "courier", label: "Courier", stack: "'Courier New', monospace" },
];

export function fontStack(id: string): string {
  return BRAND_FONTS.find((f) => f.id === id)?.stack ?? BRAND_FONTS[0].stack;
}

export const RADIUS_VALUE: Record<BrandRadius, string> = {
  sharp: "2px",
  rounded: "10px",
  pill: "999px",
};

/* ------------------------------------------------------------- store */

const byProject = new Map<string, BrandKit>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function seed(projectId: string): BrandKit {
  return {
    projectId,
    version: 1,
    updatedAt: Date.now(),
    colors: {
      primary: "#D54646",
      accent: "#4F46E5",
      background: "#FFFFFF",
      surface: "#F7F7F8",
      text: "#111114",
      muted: "#6B6B76",
    },
    typography: { headingFont: "inter", bodyFont: "inter" },
    radius: "rounded",
    logos: { wordmark: "BetterCMS", mark: "B" },
    voice: {
      tone: "",
      doWords: [],
      dontWords: [],
      protectedPhrases: [],
    },
  };
}

function ensure(projectId: string): BrandKit {
  let kit = byProject.get(projectId);
  if (!kit) {
    kit = seed(projectId);
    byProject.set(projectId, kit);
  }
  return kit;
}

export function useBrandKit(projectId: string): BrandKit {
  return useSyncExternalStore(
    subscribe,
    () => ensure(projectId),
    () => ensure(projectId),
  );
}

export function getBrandKit(projectId: string): BrandKit {
  return ensure(projectId);
}

export const brandActions = {
  /** Every save is a new version, so a change is always traceable. */
  update(projectId: string, patch: Partial<Omit<BrandKit, "projectId" | "version" | "updatedAt">>) {
    const cur = ensure(projectId);
    byProject.set(projectId, {
      ...cur,
      ...patch,
      colors: { ...cur.colors, ...(patch.colors ?? {}) },
      typography: { ...cur.typography, ...(patch.typography ?? {}) },
      logos: { ...cur.logos, ...(patch.logos ?? {}) },
      voice: { ...cur.voice, ...(patch.voice ?? {}) },
      version: cur.version + 1,
      updatedAt: Date.now(),
    });
    emit();
  },
};

/** True when the project's voice carries real guidance for the agent. */
export function hasBrandVoice(projectId: string): boolean {
  const v = ensure(projectId).voice;
  return v.tone.trim().length > 0 || v.doWords.length > 0 || v.dontWords.length > 0;
}

/* ------------------------------------------------- design.md importer */

export interface ParsedDesignMd {
  colors: { hex: string; hint?: string }[];
  headingFont?: string;
  bodyFont?: string;
  tone?: string;
  doWords: string[];
  dontWords: string[];
  protectedPhrases: string[];
}

/**
 * Pull brand facts out of a pasted design.md. Deliberately forgiving:
 * hex codes with a nearby label, known font names, and voice lines under
 * Do / Do not / Tone / Protected headings. The result is reviewed by a
 * person before anything is applied.
 */
export function parseDesignMd(text: string): ParsedDesignMd {
  const out: ParsedDesignMd = { colors: [], doWords: [], dontWords: [], protectedPhrases: [] };

  // Colors: every hex, with the closest preceding word as a hint.
  const hexRe = /(?:([A-Za-z][\w-]{2,24})\s*[:=-]?\s*)?#([0-9a-fA-F]{6})\b/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = hexRe.exec(text)) !== null) {
    const hex = `#${m[2].toUpperCase()}`;
    if (seen.has(hex)) continue;
    seen.add(hex);
    out.colors.push({ hex, hint: m[1]?.toLowerCase() });
    if (out.colors.length >= 8) break;
  }

  // Fonts: labeled lines win ("Headings: Epilogue", "Body: Inter"),
  // otherwise the first two known names in document order.
  const fontIdIn = (s: string) => BRAND_FONTS.find((f) => new RegExp(`\\b${f.label}\\b`, "i").test(s))?.id;
  const headingLine = text.match(/^.*(headings?|display)\s*[:=].*$/im)?.[0];
  const bodyLine = text.match(/^.*\bbody\s*[:=].*$/im)?.[0];
  out.headingFont = headingLine ? fontIdIn(headingLine) : undefined;
  out.bodyFont = bodyLine ? fontIdIn(bodyLine) : undefined;
  if (!out.headingFont || !out.bodyFont) {
    const byPosition = BRAND_FONTS.map((f) => ({ id: f.id, at: text.search(new RegExp(`\\b${f.label}\\b`, "i")) }))
      .filter((x) => x.at >= 0)
      .sort((a, b) => a.at - b.at)
      .map((x) => x.id);
    out.headingFont = out.headingFont ?? byPosition[0];
    out.bodyFont = out.bodyFont ?? byPosition[1] ?? byPosition[0];
  }

  // Voice: line-based, forgiving about markdown syntax.
  const lines = text.split("\n").map((l) => l.replace(/^[#*\s>-]+/, "").trim());
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("tone:")) out.tone = line.slice(5).trim();
    else if (lower.startsWith("do:")) out.doWords.push(...splitList(line.slice(3)));
    else if (lower.startsWith("do not:") || lower.startsWith("don't:") || lower.startsWith("dont:")) {
      out.dontWords.push(...splitList(line.replace(/^[^:]*:/, "")));
    } else if (lower.startsWith("protected:") || lower.startsWith("protected phrases:")) {
      out.protectedPhrases.push(...splitList(line.replace(/^[^:]*:/, "")));
    }
  }

  return out;
}

function splitList(s: string): string[] {
  return s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/**
 * Map parsed colors onto slots. Hints win; leftovers fill by position
 * and by lightness (near-white goes to background, near-black to text).
 */
export function mapParsedColors(parsed: ParsedDesignMd): Partial<BrandColors> {
  const result: Partial<BrandColors> = {};
  const rest: string[] = [];

  const hintMap: [RegExp, keyof BrandColors][] = [
    [/primary|brand|main|accent-primary/, "primary"],
    [/accent|secondary/, "accent"],
    [/background|bg/, "background"],
    [/surface|card|panel/, "surface"],
    [/text|foreground|ink/, "text"],
    [/muted|subtle|gray|grey/, "muted"],
  ];

  for (const c of parsed.colors) {
    const slot = c.hint ? hintMap.find(([re]) => re.test(c.hint!))?.[1] : undefined;
    if (slot && !result[slot]) result[slot] = c.hex;
    else rest.push(c.hex);
  }

  for (const hex of rest) {
    const l = lightness(hex);
    if (l > 0.92 && !result.background) result.background = hex;
    else if (l < 0.16 && !result.text) result.text = hex;
    else if (!result.primary) result.primary = hex;
    else if (!result.accent) result.accent = hex;
    else if (!result.surface && l > 0.8) result.surface = hex;
    else if (!result.muted) result.muted = hex;
  }

  return result;
}

function lightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
