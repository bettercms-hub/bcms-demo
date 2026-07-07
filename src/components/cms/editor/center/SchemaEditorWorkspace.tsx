/**
 * Compatibility shim — Phase 4F replaced this with `SchemaWorkspace`.
 * The old `openSchemaEditor` helper is preserved so existing callers
 * continue to work; both helpers emit the new `schema-workspace` mode.
 */
import { centerBus, type SchemaOwnerKind } from "@/lib/cms/center-bus";
export { SchemaWorkspace as SchemaEditorWorkspace } from "../schema/SchemaWorkspace";

export function openSchemaEditor(
  ownerKind: SchemaOwnerKind,
  ownerId: string,
  schemaId: string,
) {
  centerBus.emit({
    type: "center:open",
    mode: "schema-workspace",
    schemaId,
    ownerKind,
    ownerId,
  });
}
