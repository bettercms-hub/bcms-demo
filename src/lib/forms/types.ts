export type FormStatus = "draft" | "published" | "archived";

export interface FormSummary {
  id: string;
  projectSlug: string;
  name: string;
  slug: string;
  description: string | null;
  status: FormStatus;
  submissionCount: number;
  pagesUsing: number;
  updatedAt: string;
}

export interface DashboardStats {
  totalForms: number;
  activeForms: number;
  totalSubmissions: number;
  submissionsToday: number;
}

export interface RecentSubmission {
  id: string;
  formId: string;
  formName: string;
  sourceUrl: string | null;
  submittedAt: string;
  preview: string;
}

export interface PageUsingForm {
  formId: string;
  formName: string;
  pageId: string;
  blockId: string;
}

export interface FormsDashboardData {
  stats: DashboardStats;
  recentActivity: RecentSubmission[];
  pagesUsing: PageUsingForm[];
  recentForms: FormSummary[];
  allForms: FormSummary[];
}

export interface CreateFormInput {
  projectSlug: string;
  name: string;
  description?: string;
  template?: "blank" | "contact" | "newsletter" | "lead";
}

export type FieldKind =
  | "text"
  | "email"
  | "textarea"
  | "phone"
  | "number"
  | "url"
  | "select"
  | "radio"
  | "checkbox"
  | "consent"
  | "date";

export interface FieldOptions {
  choices?: Array<{ label: string; value: string }>;
  width?: "half" | "full";
  /** Email: reject free/consumer domains (gmail, outlook, …) — business only. */
  businessOnly?: boolean;
  /** Phone: show a country dropdown (flag + dial code) before the number. */
  countryPicker?: boolean;
  /** Phone: default ISO country for the picker, e.g. "US". */
  defaultCountry?: string;
  /** Phone: show flag emoji in the country dropdown. Defaults to true. */
  showFlag?: boolean;
  /** Phone: ISO codes to hide from the country dropdown. */
  excludeCountries?: string[];
}

export interface FormField {
  id: string;
  formId: string;
  groupId: string | null;
  kind: FieldKind;
  name: string;
  label: string;
  placeholder: string | null;
  helpText: string | null;
  required: boolean;
  options: FieldOptions;
  validation: { min?: number; max?: number; pattern?: string; message?: string };
  position: number;
}

/** What happens after a successful submission. */
export interface SubmitAction {
  /** "message" shows a thank-you; "redirect" sends the visitor to a URL. */
  kind: "message" | "redirect" | string;
  message?: string;
  /** Redirect target when kind === "redirect". */
  url?: string;
  /** Submit button label. */
  label?: string;
  /** Shown if the submission fails. */
  errorMessage?: string;
}

/** Spam / bot protection config. */
export interface FormCaptcha {
  provider: "none" | "turnstile";
  siteKey?: string;
}

export interface FormSettings {
  captcha?: FormCaptcha;
  [k: string]: unknown;
}

export interface FormDetail {
  id: string;
  projectSlug: string;
  name: string;
  slug: string;
  description: string | null;
  status: FormStatus;
  settings: FormSettings;
  submitAction: SubmitAction;
  fields: FormField[];
}

