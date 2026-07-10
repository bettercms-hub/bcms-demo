import { useMemo, useState } from "react";
import { CheckCircle2, Eye, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { FormDetail, FormField } from "@/lib/forms/types";
import { COUNTRIES, countryByIso } from "@/lib/forms/countries";
import { validateBusinessEmail } from "@/lib/forms/business-email";
import { TurnstileWidget } from "./TurnstileWidget";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: FormDetail;
  /** Records a test submission so it shows up under the Submissions tab. */
  onSubmit: (values: Record<string, string | boolean>) => void;
}

/**
 * A real, fillable render of the form exactly as a visitor would see it.
 * Honors required fields, business-email restrictions, the phone country
 * picker, and the Turnstile challenge; on success it either shows the
 * thank-you message or the redirect target, matching Form settings.
 */
export function FormPreviewDialog({ open, onOpenChange, form, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [phoneCountry, setPhoneCountry] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState(false);
  const [sent, setSent] = useState(false);

  const action = form.submitAction ?? { kind: "message" };
  const captchaOn = form.settings?.captcha?.provider === "turnstile";
  const successMessage = action.message || "Thanks! We'll be in touch soon.";
  const isRedirect = action.kind === "redirect";

  const orderedFields = useMemo(
    () => [...form.fields].sort((a, b) => a.position - b.position),
    [form.fields],
  );

  function reset() {
    setValues({});
    setPhoneCountry({});
    setErrors({});
    setCaptchaToken(null);
    setCaptchaError(false);
    setSent(false);
  }

  function set(name: string, v: string | boolean) {
    setValues((prev) => ({ ...prev, [name]: v }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    for (const f of orderedFields) {
      const v = values[f.name];
      const isEmpty =
        f.kind === "consent" || f.kind === "checkbox" ? !v : !v || String(v).trim() === "";
      if (f.required && isEmpty) {
        nextErrors[f.name] = "This field is required.";
        continue;
      }
      if (f.kind === "email" && f.options?.businessOnly && typeof v === "string" && v) {
        const msg = validateBusinessEmail(v);
        if (msg) nextErrors[f.name] = msg;
      }
    }
    setErrors(nextErrors);

    if (captchaOn && !captchaToken) {
      setCaptchaError(true);
      if (Object.keys(nextErrors).length) return;
      return;
    }
    if (Object.keys(nextErrors).length) return;

    // Fold the dial code into phone values so the submission reads cleanly.
    const out: Record<string, string | boolean> = { ...values };
    for (const f of orderedFields) {
      if (f.kind === "phone" && f.options?.countryPicker) {
        const excluded = new Set(f.options.excludeCountries ?? []);
        const chosen = phoneCountry[f.name] ?? f.options.defaultCountry;
        const iso = chosen && !excluded.has(chosen) ? chosen : COUNTRIES.find((c) => !excluded.has(c.iso))?.iso;
        const dial = countryByIso(iso).dial;
        const num = String(values[f.name] ?? "").trim();
        if (num) out[f.name] = `${dial} ${num}`;
      }
    }
    onSubmit(out);
    setSent(true);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" /> Preview
          </DialogTitle>
          <DialogDescription>
            Live render of {form.name}. Try it: a test submission lands in the Submissions tab.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          isRedirect ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-[color:var(--panel)] px-6 py-10 text-center">
              <ExternalLink className="h-7 w-7 text-primary" />
              <p className="text-[13px] text-foreground">Redirecting to your thank-you page…</p>
              <code className="max-w-full truncate rounded bg-muted px-2 py-1 text-[11.5px] text-muted-foreground">
                {action.url || "(no URL set)"}
              </code>
              <Button variant="secondary" size="sm" onClick={reset}>
                Run again
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-6 py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-[13px] text-foreground">{successMessage}</p>
              <Button variant="secondary" size="sm" onClick={reset}>
                Submit another
              </Button>
            </div>
          )
        ) : orderedFields.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-[color:var(--panel)] px-6 py-10 text-center text-[12.5px] text-muted-foreground">
            No fields yet. Drag fields onto the canvas, then preview.
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="max-h-[65vh] space-y-4 overflow-y-auto overflow-x-hidden px-0.5 py-0.5"
          >
            {orderedFields.map((f) => (
              <PreviewField
                key={f.id}
                field={f}
                value={values[f.name]}
                error={errors[f.name]}
                country={phoneCountry[f.name] ?? f.options?.defaultCountry ?? "US"}
                onCountry={(iso) => setPhoneCountry((prev) => ({ ...prev, [f.name]: iso }))}
                onChange={(v) => set(f.name, v)}
              />
            ))}

            {captchaOn && (
              <div className="space-y-1.5">
                <TurnstileWidget
                  interactive
                  verified={!!captchaToken}
                  onVerify={(t) => {
                    setCaptchaToken(t);
                    setCaptchaError(false);
                  }}
                />
                {captchaError && !captchaToken && (
                  <p className="text-[11px] text-destructive">Please complete the verification.</p>
                )}
              </div>
            )}

            <Button type="submit" className="w-full">
              {action.label || "Submit"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewField({
  field,
  value,
  error,
  country,
  onCountry,
  onChange,
}: {
  field: FormField;
  value: string | boolean | undefined;
  error?: string;
  country: string;
  onCountry: (iso: string) => void;
  onChange: (v: string | boolean) => void;
}) {
  const base =
    "w-full rounded-md border bg-transparent px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";
  const borderCls = error ? "border-destructive" : "border-border";
  const choices = field.options?.choices ?? [];

  if (field.kind === "consent") {
    return (
      <div className="space-y-1">
        <label className="flex items-start gap-2 text-[13px] text-foreground">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
          />
          <span>
            {field.label}
            {field.required && <span className="text-destructive"> *</span>}
          </span>
        </label>
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-foreground">
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </label>

      {field.kind === "textarea" ? (
        <textarea
          rows={3}
          placeholder={field.placeholder ?? ""}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} ${borderCls}`}
        />
      ) : field.kind === "select" ? (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} ${borderCls}`}
        >
          <option value="">Select…</option>
          {choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      ) : field.kind === "radio" ? (
        <div className="space-y-1.5">
          {choices.map((c) => (
            <label key={c.value} className="flex items-center gap-2 text-[13px] text-foreground">
              <input
                type="radio"
                name={field.name}
                checked={value === c.value}
                onChange={() => onChange(c.value)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              {c.label}
            </label>
          ))}
        </div>
      ) : field.kind === "checkbox" ? (
        <div className="space-y-1.5">
          {choices.map((c) => (
            <label key={c.value} className="flex items-center gap-2 text-[13px] text-foreground">
              <input
                type="checkbox"
                checked={typeof value === "string" && value.split(",").includes(c.value)}
                onChange={(e) => {
                  const set = new Set((typeof value === "string" ? value.split(",") : []).filter(Boolean));
                  if (e.target.checked) set.add(c.value);
                  else set.delete(c.value);
                  onChange(Array.from(set).join(","));
                }}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              {c.label}
            </label>
          ))}
        </div>
      ) : field.kind === "phone" && field.options?.countryPicker ? (
        (() => {
          const excluded = new Set(field.options?.excludeCountries ?? []);
          const available = COUNTRIES.filter((c) => !excluded.has(c.iso));
          const showFlag = field.options?.showFlag !== false;
          const current = available.some((c) => c.iso === country) ? country : available[0]?.iso ?? "US";
          return (
            <div className="flex items-center gap-2">
              <select
                value={current}
                onChange={(e) => onCountry(e.target.value)}
                className={`h-[38px] w-[104px] shrink-0 rounded-md border bg-transparent px-2 text-[13px] text-foreground outline-none focus:border-primary ${borderCls}`}
                aria-label="Country code"
              >
                {available.map((c) => (
                  <option key={c.iso} value={c.iso}>
                    {showFlag ? `${c.flag} ${c.dial}` : c.dial}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                placeholder={field.placeholder ?? ""}
                value={(value as string) ?? ""}
                onChange={(e) => onChange(e.target.value)}
                className={`${base} ${borderCls} min-w-0 flex-1`}
              />
            </div>
          );
        })()
      ) : (
        <input
          type={
            field.kind === "email"
              ? "email"
              : field.kind === "number"
              ? "number"
              : field.kind === "url"
              ? "url"
              : field.kind === "phone"
              ? "tel"
              : field.kind === "date"
              ? "date"
              : "text"
          }
          placeholder={field.placeholder ?? ""}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} ${borderCls}`}
        />
      )}

      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : field.helpText ? (
        <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
      ) : null}
    </div>
  );
}
