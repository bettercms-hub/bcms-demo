import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings2, Trash2, Plus } from "lucide-react";
import type { FormDetail, FormField } from "@/lib/forms/types";
import { COUNTRIES, countryByIso } from "@/lib/forms/countries";
import { X } from "lucide-react";

interface Props {
  form: FormDetail;
  selectedField: FormField | null;
  onUpdateField: (id: string, patch: Record<string, unknown>) => void;
  onUpdateForm: (patch: Record<string, unknown>) => void;
}

export function FormInspector({ form, selectedField, onUpdateField, onUpdateForm }: Props) {
  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col overflow-auto border-l border-border/60 bg-[color:var(--panel)]">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5" />
          {selectedField ? "Field" : "Form settings"}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {selectedField ? (
          <FieldEditor
            key={selectedField.id}
            field={selectedField}
            onChange={(patch) => onUpdateField(selectedField.id, patch)}
          />
        ) : (
          <FormSettings form={form} onChange={onUpdateForm} />
        )}
      </div>
    </div>
  );
}

function FormSettings({
  form,
  onChange,
}: {
  form: FormDetail;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const action = form.submitAction ?? { kind: "message", message: "Thanks!" };
  const captcha = form.settings?.captcha ?? { provider: "none" as const };
  const isRedirect = action.kind === "redirect";

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <Field label="Name">
          <Input
            defaultValue={form.name}
            onBlur={(e) => {
              if (e.target.value !== form.name) onChange({ name: e.target.value });
            }}
          />
        </Field>
        <Field label="Description">
          <Textarea
            rows={2}
            defaultValue={form.description ?? ""}
            onBlur={(e) => onChange({ description: e.target.value || null })}
          />
        </Field>
      </div>

      <Divider />
      <SectionLabel>After submit</SectionLabel>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-[color:var(--surface-3)] p-1">
        <SegBtn active={!isRedirect} onClick={() => onChange({ submit_action: { ...action, kind: "message" } })}>
          Show message
        </SegBtn>
        <SegBtn active={isRedirect} onClick={() => onChange({ submit_action: { ...action, kind: "redirect" } })}>
          Redirect
        </SegBtn>
      </div>

      {isRedirect ? (
        <Field label="Redirect URL">
          <Input
            key="redirect-url"
            defaultValue={action.url ?? ""}
            placeholder="https://your-site.com/thank-you"
            onBlur={(e) => onChange({ submit_action: { ...action, kind: "redirect", url: e.target.value } })}
          />
          <Hint>Visitors land here after a successful submit: your thank-you page.</Hint>
        </Field>
      ) : (
        <Field label="Thank-you message">
          <Textarea
            key="thankyou-msg"
            rows={2}
            defaultValue={action.message ?? ""}
            onBlur={(e) => onChange({ submit_action: { ...action, kind: "message", message: e.target.value } })}
          />
        </Field>
      )}

      <Field label="Submit button label">
        <Input
          defaultValue={action.label ?? "Submit"}
          placeholder="Submit"
          onBlur={(e) => onChange({ submit_action: { ...action, label: e.target.value.trim() || "Submit" } })}
        />
      </Field>

      <Field label="Error message">
        <Input
          defaultValue={action.errorMessage ?? ""}
          placeholder="Something went wrong. Please try again."
          onBlur={(e) => onChange({ submit_action: { ...action, errorMessage: e.target.value || undefined } })}
        />
        <Hint>Shown if the submission fails to send.</Hint>
      </Field>

      <Divider />
      <SectionLabel>Spam protection</SectionLabel>
      <ToggleRow
        label="Cloudflare Turnstile"
        hint="Adds an invisible human check before the form can be submitted."
        checked={captcha.provider === "turnstile"}
        onChange={(v) =>
          onChange({
            settings: {
              ...form.settings,
              captcha: { ...captcha, provider: v ? "turnstile" : "none" },
            },
          })
        }
      />
      {captcha.provider === "turnstile" && (
        <Field label="Site key">
          <Input
            defaultValue={captcha.siteKey ?? ""}
            placeholder="0x4AAAAAAA…"
            onBlur={(e) =>
              onChange({
                settings: { ...form.settings, captcha: { provider: "turnstile", siteKey: e.target.value } },
              })
            }
          />
          <Hint>From your Cloudflare Turnstile dashboard. The demo accepts any value.</Hint>
        </Field>
      )}
    </div>
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-7 items-center justify-center rounded-md text-[12.5px] font-medium leading-none transition-colors ${
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">{children}</div>
  );
}

function Divider() {
  return <div className="h-px bg-[color:var(--border-hairline)]" />;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{children}</p>;
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md bg-[color:var(--card)] px-3 py-2.5">
      <div className="min-w-0">
        <Label className="text-xs font-medium">{label}</Label>
        {hint && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </div>
  );
}

function FieldEditor({
  field,
  onChange,
}: {
  field: FormField;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const [choices, setChoices] = useState(field.options?.choices ?? []);

  useEffect(() => {
    setChoices(field.options?.choices ?? []);
  }, [field.id]);

  const hasChoices = field.kind === "select" || field.kind === "radio" || field.kind === "checkbox";

  function pushChoices(next: typeof choices) {
    setChoices(next);
    onChange({ options: { ...field.options, choices: next } });
  }

  return (
    <div className="space-y-4">
      <Field label="Label">
        <Input
          defaultValue={field.label}
          onBlur={(e) => {
            if (e.target.value !== field.label) onChange({ label: e.target.value });
          }}
        />
      </Field>
      <Field label="Field key">
        <Input
          defaultValue={field.name}
          onBlur={(e) => {
            const v = e.target.value.trim().replace(/[^a-zA-Z0-9_]/g, "_");
            if (v && v !== field.name) onChange({ name: v });
          }}
        />
      </Field>
      {field.kind !== "consent" && (
        <Field label="Placeholder">
          <Input
            defaultValue={field.placeholder ?? ""}
            onBlur={(e) => onChange({ placeholder: e.target.value || null })}
          />
        </Field>
      )}
      <Field label="Help text">
        <Input
          defaultValue={field.helpText ?? ""}
          onBlur={(e) => onChange({ help_text: e.target.value || null })}
        />
      </Field>
      <div className="flex items-center justify-between rounded-md bg-[color:var(--card)] px-3 py-2">
        <Label className="text-xs font-medium">Required</Label>
        <Switch
          checked={field.required}
          onCheckedChange={(v) => onChange({ required: v })}
        />
      </div>

      {field.kind === "email" && (
        <ToggleRow
          label="Business email only"
          hint="Rejects Gmail, Outlook, iCloud and other personal inboxes."
          checked={!!field.options?.businessOnly}
          onChange={(v) => onChange({ options: { ...field.options, businessOnly: v } })}
        />
      )}

      {field.kind === "phone" && (
        <>
          <ToggleRow
            label="Country code picker"
            hint="Show a country dropdown with dial code before the number."
            checked={!!field.options?.countryPicker}
            onChange={(v) => onChange({ options: { ...field.options, countryPicker: v } })}
          />
          {field.options?.countryPicker && (
            <>
              <Field label="Default country">
                <select
                  value={field.options?.defaultCountry ?? "US"}
                  onChange={(e) =>
                    onChange({ options: { ...field.options, countryPicker: true, defaultCountry: e.target.value } })
                  }
                  className="h-9 w-full rounded-md border border-border bg-transparent px-2 text-[13px] text-foreground outline-none focus:border-primary"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.iso} value={c.iso}>
                      {c.flag} {c.name} ({c.dial})
                    </option>
                  ))}
                </select>
              </Field>
              <ToggleRow
                label="Show flags"
                hint="Display the country flag next to the dial code."
                checked={field.options?.showFlag !== false}
                onChange={(v) => onChange({ options: { ...field.options, showFlag: v } })}
              />
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Excluded countries</Label>
                <CountryExclude
                  value={field.options?.excludeCountries ?? []}
                  onChange={(next) => onChange({ options: { ...field.options, excludeCountries: next } })}
                />
                <Hint>Hidden from the dropdown. Everything else stays available.</Hint>
              </div>
            </>
          )}
        </>
      )}

      {hasChoices && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Choices</Label>
          <div className="space-y-1.5">
            {choices.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input
                  value={c.label}
                  onChange={(e) => {
                    const next = [...choices];
                    next[i] = {
                      label: e.target.value,
                      value: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
                    };
                    setChoices(next);
                  }}
                  onBlur={() => pushChoices(choices)}
                  className="h-8 text-xs"
                />
                <button
                  onClick={() => pushChoices(choices.filter((_, idx) => idx !== i))}
                  className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() =>
              pushChoices([
                ...choices,
                { label: `Option ${choices.length + 1}`, value: `option_${choices.length + 1}` },
              ])
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add choice
          </Button>
        </div>
      )}
    </div>
  );
}

function CountryExclude({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const remaining = COUNTRIES.filter((c) => !value.includes(c.iso));
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((iso) => {
            const c = countryByIso(iso);
            return (
              <span
                key={iso}
                className="inline-flex items-center gap-1 rounded-[4px] border border-border bg-[color:var(--card)] py-0.5 pl-2 pr-1 text-[11px] text-foreground"
              >
                {c.flag} {c.name}
                <button
                  onClick={() => onChange(value.filter((x) => x !== iso))}
                  aria-label={`Remove ${c.name}`}
                  className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) onChange([...value, e.target.value]);
        }}
        className="h-8 w-full rounded-md border border-border bg-transparent px-2 text-[12.5px] text-muted-foreground outline-none focus:border-primary"
      >
        <option value="">Add a country to exclude…</option>
        {remaining.map((c) => (
          <option key={c.iso} value={c.iso}>
            {c.flag} {c.name} ({c.dial})
          </option>
        ))}
      </select>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
