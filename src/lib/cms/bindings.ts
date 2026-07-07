import type { Block, ComponentMaster, Schema } from "./types";

/**
 * Resolve override values into a block tree. Two mechanisms:
 *   1) prop value is the placeholder string "{{field:<name>}}" → replaced with overrides[name]
 *   2) prop name matches a schema field name → overridden when override exists
 */
export function resolveBoundProps(
  blocks: Block[] | undefined,
  overrides: Record<string, unknown> | undefined,
  schema: Schema | undefined,
): Block[] {
  if (!blocks || blocks.length === 0) return [];
  const ov = overrides ?? {};
  const fieldNames = new Set((schema?.fields ?? []).map((f) => f.name));

  const PLACEHOLDER = /^\{\{\s*field:([a-zA-Z0-9_]+)\s*\}\}$/;

  const transformProps = (props: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...props };
    for (const [k, v] of Object.entries(props)) {
      if (typeof v === "string") {
        const m = v.match(PLACEHOLDER);
        if (m && m[1] in ov) {
          out[k] = ov[m[1]];
          continue;
        }
      }
      if (fieldNames.has(k) && k in ov) out[k] = ov[k];
    }
    return out;
  };

  const walk = (list: Block[]): Block[] =>
    list.map((b) => ({
      ...b,
      props: transformProps(b.props),
      children: b.children ? walk(b.children) : undefined,
    }));

  return walk(blocks);
}

/** Build initial overrides for a freshly bound section by reading field defaults. */
export function seedOverridesFromSchema(schema: Schema | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!schema) return out;
  for (const f of schema.fields) {
    if (f.defaultValue !== undefined) out[f.name] = f.defaultValue;
  }
  return out;
}

/** Pull a representative default for a schema field's type (used by override forms). */
export function defaultForField(type: string): unknown {
  switch (type) {
    case "boolean": return false;
    case "number": return 0;
    case "json": return {};
    default: return "";
  }
}

export function getMasterRootBlocks(m: ComponentMaster | undefined): Block[] {
  return m?.rootBlocks ?? [];
}
