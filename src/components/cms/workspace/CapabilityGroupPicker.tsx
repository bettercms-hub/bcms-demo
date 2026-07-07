import { CAPABILITY_GROUPS, type Capabilities } from "@/lib/workspace/capabilities";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  value: Capabilities;
  onChange: (next: Capabilities) => void;
  disabled?: boolean;
}

export function CapabilityGroupPicker({ value, onChange, disabled }: Props) {
  const setFlag = (group: string, flag: string, on: boolean) => {
    onChange({
      ...value,
      [group]: { ...(value[group] ?? {}), [flag]: on },
    });
  };

  const setGroup = (group: string, on: boolean) => {
    const def = CAPABILITY_GROUPS.find((g) => g.key === group);
    if (!def) return;
    onChange({
      ...value,
      [group]: Object.fromEntries(def.flags.map((f) => [f.key, on])),
    });
  };

  return (
    <div className="grid gap-4">
      {CAPABILITY_GROUPS.map((g) => {
        const groupVal = value[g.key] ?? {};
        const enabled = g.flags.filter((f) => groupVal[f.key]).length;
        const all = enabled === g.flags.length;
        const some = enabled > 0 && !all;
        return (
          <div key={g.key} className="rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div>
                <div className="text-[13px] font-semibold text-foreground">{g.label}</div>
                <div className="text-[11.5px] text-muted-foreground">{g.description}</div>
              </div>
              <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground">
                <span className="tabular-nums">
                  {enabled}/{g.flags.length}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setGroup(g.key, !all)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-[11.5px] text-foreground hover:bg-[color:var(--color-row-hover)] disabled:opacity-50"
                >
                  {all ? "Clear" : some ? "Enable all" : "Enable all"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">
              {g.flags.map((f) => {
                const on = Boolean(groupVal[f.key]);
                return (
                  <label
                    key={f.key}
                    className={`flex items-start gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] transition-colors hover:bg-[color:var(--color-row-hover)] ${disabled ? "opacity-60" : "cursor-pointer"}`}
                  >
                    <Checkbox
                      checked={on}
                      disabled={disabled}
                      onCheckedChange={(v) => setFlag(g.key, f.key, Boolean(v))}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{f.label}</div>
                      {f.description && (
                        <div className="text-[11.5px] text-muted-foreground">{f.description}</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
