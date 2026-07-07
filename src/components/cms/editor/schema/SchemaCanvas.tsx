/**
 * SchemaCanvas — thin dispatcher that renders the active view-mode surface.
 */
import type { Schema } from "@/lib/cms/types";
import { BuilderView } from "./views/BuilderView";
import { TableView } from "./views/TableView";
import { MetadataView } from "./views/MetadataView";
import { RelationshipsView } from "./views/RelationshipsView";

export type SchemaView = "builder" | "table" | "metadata" | "relationships";

interface Props {
  schema: Schema;
  view: SchemaView;
  ownerName: string;
  selectedFieldId: string | null;
  activeGroupId: string | null;
  onSelectField: (id: string) => void;
  onSetActiveGroup: (id: string | null) => void;
  onRequestAddField: () => void;
}

export function SchemaCanvas({
  schema,
  view,
  ownerName,
  selectedFieldId,
  activeGroupId,
  onSelectField,
  onSetActiveGroup,
  onRequestAddField,
}: Props) {
  return (
    <div className="h-full min-h-0 overflow-auto bg-[color:var(--canvas)]">
      {view === "builder" && (
        <BuilderView
          schema={schema}
          selectedFieldId={selectedFieldId}
          activeGroupId={activeGroupId}
          onSelectField={onSelectField}
          onSetActiveGroup={onSetActiveGroup}
          onRequestAddField={onRequestAddField}
        />
      )}
      {view === "table" && (
        <TableView
          schema={schema}
          selectedFieldId={selectedFieldId}
          onSelectField={onSelectField}
        />
      )}
      {view === "metadata" && (
        <MetadataView
          schema={schema}
          selectedFieldId={selectedFieldId}
          onSelectField={onSelectField}
        />
      )}
      {view === "relationships" && (
        <RelationshipsView
          schema={schema}
          ownerName={ownerName}
          onSelectField={onSelectField}
        />
      )}
    </div>
  );
}
