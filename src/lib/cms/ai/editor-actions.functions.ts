/**
 * Phase 5 — AI editor actions.
 *
 * Two TanStack server functions backed by the Lovable AI Gateway:
 *
 *   - rewriteText   → text-level transformations (improve / shorten /
 *                     lengthen / tone / translate / fix grammar / continue).
 *   - generateSection → returns a small block tree from a prompt + section
 *                     kind, constrained to a safe subset of block kinds.
 *
 * The handlers call the gateway directly with fetch (OpenAI-compatible) to
 * avoid pulling in the AI SDK for what is effectively a single chat call.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const RewriteInput = z.object({
  text: z.string().min(1).max(8000),
  instruction: z.string().min(1).max(400),
  /** Optional secondary hint, e.g. tone or target language. */
  hint: z.string().max(120).optional(),
});

const GenerateSectionInput = z.object({
  prompt: z.string().min(1).max(600),
  sectionKind: z.string().max(40).optional(),
});

const ALLOWED_GEN_KINDS = [
  "heading",
  "paragraph",
  "list",
  "quote",
  "button",
  "image",
  "card",
  "card-group",
] as const;
type GenKind = (typeof ALLOWED_GEN_KINDS)[number];

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };
type GenBlock = { kind: GenKind; props: JsonObject; children?: GenBlock[] };

async function callGateway(messages: Array<{ role: "system" | "user"; content: string }>, opts: {
  json?: boolean;
} = {}) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    throw new Error("Missing LOVABLE_API_KEY");
  }
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (res.status === 429) {
    throw new Error("AI rate limit reached. Please wait a moment and try again.");
  }
  if (res.status === 402) {
    throw new Error("Out of AI credits. Top up in workspace billing to continue.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI gateway error ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

export const rewriteText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => RewriteInput.parse(data))
  .handler(async ({ data }) => {
    const system =
      "You rewrite short snippets of website copy. Return ONLY the rewritten " +
      "text — no preamble, no quotes, no markdown fences, no explanation. " +
      "Preserve line breaks if the input had them. Match the original " +
      "language unless the instruction asks for a translation.";
    const userMsg = [
      `Instruction: ${data.instruction}`,
      data.hint ? `Hint: ${data.hint}` : null,
      "",
      "Original text:",
      data.text,
    ]
      .filter(Boolean)
      .join("\n");
    const text = await callGateway([
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ]);
    // Strip wrapping quotes that some models add despite instruction.
    const cleaned = text
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/\n?```$/i, "")
      .replace(/^["“”'](.*)["“”']$/s, "$1")
      .trim();
    return { text: cleaned || data.text };
  });

export const generateSection = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => GenerateSectionInput.parse(data))
  .handler(async ({ data }) => {
    const system = [
      "You design website sections by emitting a JSON document.",
      "Schema:",
      '{ "blocks": [ { "kind": string, "props": object, "children"?: array } ] }',
      `Allowed kinds: ${ALLOWED_GEN_KINDS.join(", ")}.`,
      "Block prop shapes:",
      "- heading: { text, level: '1'|'2'|'3'|'4', align?: 'left'|'center' }",
      "- paragraph: { text, align?: 'left'|'center' }",
      "- list: { items: string (one per line), ordered?: boolean }",
      "- quote: { text, cite?: string }",
      "- button: { label, href: string, variant?: 'primary'|'secondary'|'ghost' }",
      "- image: { src: '', alt: string, caption?: string, ratio?: '16/9'|'1/1' }",
      "- card: { title, body, padded?: true }  (no children)",
      "- card-group: { gap?: 'md' }  (children: 2–4 cards)",
      "Rules:",
      "- Keep total blocks between 3 and 8.",
      "- Concise, marketing-quality copy. No lorem ipsum.",
      "- Leave image.src empty; only set alt.",
      "- Return JSON only. No prose, no code fences.",
    ].join("\n");

    const userMsg = [
      data.sectionKind ? `Section kind: ${data.sectionKind}` : "Section kind: content",
      `Brief: ${data.prompt}`,
    ].join("\n");

    const raw = await callGateway(
      [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
      { json: true },
    );

    let parsed: { blocks?: unknown } = {};
    try {
      parsed = JSON.parse(raw) as { blocks?: unknown };
    } catch {
      // Tolerate stray prose by extracting the first {...} balanced block.
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          parsed = JSON.parse(raw.slice(start, end + 1)) as { blocks?: unknown };
        } catch {
          /* fall through */
        }
      }
    }
    const blocks = sanitize(parsed.blocks);
    if (blocks.length === 0) {
      throw new Error("AI did not return any usable blocks. Try a more specific prompt.");
    }
    return { blocks };
  });

function sanitize(input: unknown): GenBlock[] {
  if (!Array.isArray(input)) return [];
  const out: GenBlock[] = [];
  for (const raw of input.slice(0, 12)) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as { kind?: unknown; props?: unknown; children?: unknown };
    const kind = typeof obj.kind === "string" ? (obj.kind as GenKind) : undefined;
    if (!kind || !ALLOWED_GEN_KINDS.includes(kind)) continue;
    const props: JsonObject =
      obj.props && typeof obj.props === "object" && !Array.isArray(obj.props)
        ? toJsonObject(obj.props as Record<string, unknown>)
        : {};
    const block: GenBlock = { kind, props };
    if (kind === "card-group") {
      const kids = sanitize(obj.children).filter((c) => c.kind === "card");
      block.children = kids.slice(0, 4);
    }
    out.push(block);
  }
  return out.slice(0, 8);
}

function toJsonValue(v: unknown): JsonValue {
  if (v === null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.map(toJsonValue);
  if (typeof v === "object") return toJsonObject(v as Record<string, unknown>);
  return null;
}

function toJsonObject(v: Record<string, unknown>): JsonObject {
  const out: JsonObject = {};
  for (const [k, val] of Object.entries(v)) out[k] = toJsonValue(val);
  return out;
}
