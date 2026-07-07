import { Maximize2, Minimize2, Rows3 } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { useEditorDensity, type EditorDensity } from "@/lib/cms/use-editor-density";

export function DensityToggle() {
  const { density, setDensity } = useEditorDensity();
  return (
    <Segmented<EditorDensity>
      value={density}
      onChange={setDensity}
      size="sm"
      options={[
        { value: "compact", label: "Compact", icon: Minimize2 },
        { value: "comfortable", label: "Cozy", icon: Rows3 },
        { value: "expanded", label: "Expanded", icon: Maximize2 },
      ]}
    />
  );
}
