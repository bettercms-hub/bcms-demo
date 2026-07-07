import { Columns2, FileText, MonitorPlay } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";

export type EditorMode = "content" | "split" | "preview";

interface Props {
  value: EditorMode;
  onChange: (mode: EditorMode) => void;
}

export function ModeToggle({ value, onChange }: Props) {
  return (
    <Segmented<EditorMode>
      value={value}
      onChange={onChange}
      size="sm"
      options={[
        { value: "content", label: "Content", icon: FileText },
        { value: "split", label: "Split", icon: Columns2 },
        { value: "preview", label: "Preview", icon: MonitorPlay },
      ]}
    />
  );
}
