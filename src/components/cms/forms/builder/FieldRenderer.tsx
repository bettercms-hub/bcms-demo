import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormField } from "@/lib/forms/types";
import { countryByIso } from "@/lib/forms/countries";

export function FieldRenderer({ field }: { field: FormField }) {
  const choices = field.options?.choices ?? [];
  const inputProps = {
    placeholder: field.placeholder ?? "",
    disabled: true,
    className: "pointer-events-none",
  } as const;

  return (
    <div className="space-y-1.5">
      {field.kind !== "consent" && (
        <Label className="text-xs font-medium text-foreground">
          {field.label}
          {field.required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {(() => {
        switch (field.kind) {
          case "textarea":
            return <Textarea rows={3} {...inputProps} />;
          case "select":
            return (
              <Select disabled>
                <SelectTrigger className="pointer-events-none">
                  <SelectValue placeholder={field.placeholder ?? "Select…"} />
                </SelectTrigger>
                <SelectContent>
                  {choices.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          case "radio":
            return (
              <RadioGroup disabled className="space-y-1.5 pointer-events-none">
                {choices.map((c) => (
                  <div key={c.value} className="flex items-center gap-2">
                    <RadioGroupItem value={c.value} id={`${field.id}-${c.value}`} />
                    <Label htmlFor={`${field.id}-${c.value}`} className="text-sm font-normal">
                      {c.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            );
          case "checkbox":
            return (
              <div className="space-y-1.5">
                {choices.map((c) => (
                  <div key={c.value} className="flex items-center gap-2">
                    <Checkbox id={`${field.id}-${c.value}`} disabled />
                    <Label htmlFor={`${field.id}-${c.value}`} className="text-sm font-normal">
                      {c.label}
                    </Label>
                  </div>
                ))}
              </div>
            );
          case "consent":
            return (
              <div className="flex items-start gap-2">
                <Checkbox id={field.id} disabled className="mt-0.5" />
                <Label htmlFor={field.id} className="text-sm font-normal">
                  {field.label}
                  {field.required && <span className="ml-0.5 text-destructive">*</span>}
                </Label>
              </div>
            );
          case "number":
            return <Input type="number" {...inputProps} />;
          case "email":
            return <Input type="email" {...inputProps} />;
          case "url":
            return <Input type="url" {...inputProps} />;
          case "phone":
            if (field.options?.countryPicker) {
              const c = countryByIso(field.options.defaultCountry);
              const showFlag = field.options.showFlag !== false;
              return (
                <div className="pointer-events-none flex items-center gap-2">
                  <div className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input bg-transparent px-2.5 text-sm">
                    {showFlag && <span className="text-base leading-none">{c.flag}</span>}
                    <span className="tabular-nums text-muted-foreground">{c.dial}</span>
                  </div>
                  <Input type="tel" {...inputProps} className="pointer-events-none flex-1" />
                </div>
              );
            }
            return <Input type="tel" {...inputProps} />;
          case "date":
            return <Input type="date" {...inputProps} />;
          default:
            return <Input type="text" {...inputProps} />;
        }
      })()}
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
    </div>
  );
}
