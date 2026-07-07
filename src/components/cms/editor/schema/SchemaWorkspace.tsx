/**
 * SchemaWorkspace — BetterCMS Schema Builder V3 (v5.4).
 *
 * Three regions only:
 *   ┌─── Schema Toolbar ─────────────────────────────────────┐
 *   │ Field Library │      Schema Canvas      │ Field Config │
 *   │  (permanent)  │       (resizable)       │ (contextual) │
 *   └────────────────────────────────────────────────────────┘
 *
 * Library is always visible. Selecting a field opens the contextual
 * config panel on the right; the legacy FieldEditorSheet is reachable
 * as an "expand" affordance for users who want the full-width form.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { schemaActions, useCMS } from "@/lib/cms/store";
import { centerBus, type SchemaOwnerKind } from "@/lib/cms/center-bus";
import { useSchemaHotkeys } from "@/lib/cms/schema/use-schema-hotkeys";
import { useSchemaHistory } from "@/lib/cms/schema/use-schema-history";
import { SchemaToolbar, type SchemaStatus } from "./SchemaToolbar";
import { FieldLibrary } from "./FieldLibrary";
import { SchemaCanvas, type SchemaView } from "./SchemaCanvas";
import { FieldConfigPanel } from "./FieldConfigPanel";
import { FieldEditorSheet } from "./FieldEditorSheet";
import { FieldCommandPalette } from "./FieldCommandPalette";
import { CollectionSettingsSheet } from "./CollectionSettingsSheet";
import { ApiPreviewPanel } from "./ApiPreviewPanel";
import { SchemaJsonPanel } from "./SchemaJsonPanel";
import { SchemaShortcutsOverlay } from "./SchemaShortcutsOverlay";
import { SchemaUnsavedBar } from "./SchemaUnsavedBar";

interface Props {
  schemaId: string;
  ownerKind: SchemaOwnerKind;
  ownerId: string;
  onClose: () => void;
}

export type InspectorSelection =
  | { kind: "field"; id: string }
  | { kind: "group"; id: string | null }
  | { kind: "schema" };

const VIEW_KEY = "bcms.schema.view";
const CONFIG_OPEN_KEY = "bcms.schema.config-open";

export function SchemaWorkspace({ schemaId, ownerKind, ownerId, onClose }: Props) {
  const schema = useCMS((s) => s.schemas.find((sc) => sc.id === schemaId));
  const owner = useCMS((s) =>
    ownerKind === "collection"
      ? s.collections.find((c) => c.id === ownerId)
      : s.components.find((c) => c.id === ownerId),
  );

  const [view, setView] = useState<SchemaView>(() => {
    if (typeof window === "undefined") return "builder";
    const stored = localStorage.getItem(VIEW_KEY) as SchemaView | null;
    return stored ?? "builder";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(CONFIG_OPEN_KEY) !== "0";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(CONFIG_OPEN_KEY, configOpen ? "1" : "0");
    }
  }, [configOpen]);

  const history = useSchemaHistory(schemaId);

  const ownerName = useMemo(() => {
    if (!owner) return "Schema";
    return (owner as { name: string }).name;
  }, [owner]);

  const status: SchemaStatus = history.isDirty ? "unsaved" : "saved";

  const openFieldEditor = useCallback((fieldId: string) => {
    setSelectedFieldId(fieldId);
    setConfigOpen(true);
  }, []);

  const openPalette = useCallback((_mode: "insert" | "search") => {
    setPaletteOpen(true);
  }, []);

  const onDeleteSelected = useCallback(() => {
    if (!selectedFieldId || !schema) return;
    schemaActions.removeField(schema.id, selectedFieldId);
    setSelectedFieldId(null);
  }, [schema, selectedFieldId]);

  const onAddGroup = useCallback(() => {
    if (!schema) return;
    const id = schemaActions.addGroup(schema.id, "New group");
    setActiveGroupId(id);
  }, [schema]);

  const onEscape = useCallback(() => {
    if (shortcutsOpen) { setShortcutsOpen(false); return; }
    if (jsonOpen) { setJsonOpen(false); return; }
    if (paletteOpen) { setPaletteOpen(false); return; }
    if (editorOpen) { setEditorOpen(false); return; }
    if (settingsOpen) { setSettingsOpen(false); return; }
    if (apiOpen) { setApiOpen(false); return; }
    setSelectedFieldId(null);
  }, [paletteOpen, editorOpen, settingsOpen, apiOpen, jsonOpen, shortcutsOpen]);

  useSchemaHotkeys({
    openPalette,
    setView: (n) =>
      setView((["builder", "table", "metadata", "relationships"] as SchemaView[])[n - 1]),
    onEscape,
    onDeleteSelected,
    onUndo: history.undo,
    onRedo: history.redo,
    onToggleJson: () => setJsonOpen((v) => !v),
    onToggleShortcuts: () => setShortcutsOpen((v) => !v),
  });

  if (!schema) {
    return (
      <div className="grid h-full place-items-center bg-[color:var(--canvas)] text-sm text-muted-foreground">
        Schema not found.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[color:var(--canvas)]">
      <SchemaToolbar
        ownerName={ownerName}
        ownerKind={ownerKind}
        schemaTitle="Schema"
        status={status}
        view={view}
        onViewChange={setView}
        onBack={onClose}
        onAddGroup={onAddGroup}
        onOpenApi={() => setApiOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenJson={() => setJsonOpen(true)}
        onOpenMetadata={() => setView("metadata" as SchemaView)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onUndo={history.undo}
        onRedo={history.redo}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
      />

      <div className="min-h-0 flex-1">
        <PanelGroup orientation="horizontal" className="h-full">
          {/* Field library — permanent left */}
          <Panel defaultSize="20%" minSize="220px" maxSize="320px">
            <FieldLibrary
              schemaId={schema.id}
              activeGroupId={activeGroupId}
              onCreated={(fid) => openFieldEditor(fid)}
            />
          </Panel>
          <PanelResizeHandle className="w-px bg-border/30 transition-colors hover:bg-border" />

          {/* Canvas — resizable center */}
          <Panel minSize="40%">
            <SchemaCanvas
              schema={schema}
              view={view}
              ownerName={ownerName}
              selectedFieldId={selectedFieldId}
              activeGroupId={activeGroupId}
              onSelectField={openFieldEditor}
              onSetActiveGroup={setActiveGroupId}
              onRequestAddField={() => openPalette("insert")}
            />
          </Panel>

          {/* Field configuration — contextual right */}
          {configOpen && (
            <>
              <PanelResizeHandle className="w-px bg-border/30 transition-colors hover:bg-border" />
              <Panel defaultSize="24%" minSize="280px" maxSize="420px">
                <FieldConfigPanel
                  schema={schema}
                  ownerKind={ownerKind}
                  ownerId={ownerId}
                  selectedFieldId={selectedFieldId}
                  onClose={() => setConfigOpen(false)}
                  onExpand={() => setEditorOpen(true)}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      <FieldEditorSheet
        open={editorOpen}
        onOpenChange={(v) => {
          setEditorOpen(v);
        }}
        schema={schema}
        ownerKind={ownerKind}
        ownerId={ownerId}
        fieldId={selectedFieldId}
      />

      <FieldCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        schemaId={schema.id}
        activeGroupId={activeGroupId}
        onCreated={(fid) => openFieldEditor(fid)}
      />

      <CollectionSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        schema={schema}
        ownerKind={ownerKind}
        ownerId={ownerId}
      />

      <ApiPreviewPanel
        open={apiOpen}
        onOpenChange={setApiOpen}
        schema={schema}
        ownerName={ownerName}
      />

      <SchemaJsonPanel open={jsonOpen} onOpenChange={setJsonOpen} schema={schema} />
      <SchemaShortcutsOverlay open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {history.isDirty && (
        <SchemaUnsavedBar
          diff={history.dirty}
          onDiscard={history.discard}
          onMarkSaved={history.markSaved}
        />
      )}
    </div>
  );
}

/** Public helper — used everywhere the old `openSchemaEditor` was called. */
export function openSchemaWorkspace(
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
