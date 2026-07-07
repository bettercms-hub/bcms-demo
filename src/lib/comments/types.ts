export type CommentSurface =
  | "editor"
  | "preview"
  | "split"
  | "page"
  | "component"
  | "collection"
  | "media"
  | "seo"
  | "analytics"
  | "forms"
  | "settings"
  | "schema"
  | "navigation"
  | "template";

export const COMMENT_SURFACES: CommentSurface[] = [
  "editor",
  "preview",
  "split",
  "page",
  "component",
  "collection",
  "media",
  "seo",
  "analytics",
  "forms",
  "settings",
  "schema",
  "navigation",
  "template",
];

export type AnchorKind = "page" | "block" | "field" | "selection" | "element";
export type ThreadStatus = "open" | "resolved";
export type Priority = "none" | "low" | "medium" | "high" | "urgent";
export type AuthorKind = "user" | "ai" | "system";

export interface AnchorRef {
  blockId?: string;
  fieldPath?: string;
  selector?: string;
  text?: string;
  rangeStart?: number;
  rangeEnd?: number;
}

export interface Viewport {
  xPct?: number;
  yPct?: number;
  view?: string;
}

export interface SuggestedEdit {
  before: string;
  after: string;
  applied?: boolean;
  appliedAt?: string;
}

export interface Mention {
  kind: "user" | "agent";
  ref: string;
  label: string;
}

export interface Attachment {
  url: string;
  name: string;
  mime?: string;
}

export interface CommentMessage {
  id: string;
  thread_id: string;
  author_kind: AuthorKind;
  author_user_id: string | null;
  body: string;
  mentions: Mention[];
  attachments: Attachment[];
  suggested_edit: SuggestedEdit | null;
  parent_message_id: string | null;
  created_at: string;
}

export interface CommentThread {
  id: string;
  workspace_id: string;
  project_id: string | null;
  surface: CommentSurface;
  page_id: string | null;
  anchor_kind: AnchorKind;
  anchor_ref: AnchorRef;
  viewport: Viewport;
  version_label: string | null;
  status: ThreadStatus;
  priority: Priority;
  assignee_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  last_activity_at: string;
  messages: CommentMessage[];
}

export const AI_QUICK_ACTIONS = [
  { id: "improve", label: "Improve", prompt: "Rewrite this content to be clearer, more concise, and more engaging while preserving its meaning. Return only the rewritten content.", suggestion: true },
  { id: "rewrite", label: "Rewrite", prompt: "Rewrite this content with a fresh tone, keeping the core message. Return only the rewritten content.", suggestion: true },
  { id: "expand", label: "Expand", prompt: "Expand this content with more detail and supporting context. Return only the expanded content.", suggestion: true },
  { id: "shorten", label: "Shorten", prompt: "Make this content significantly shorter while keeping the core message. Return only the shortened content.", suggestion: true },
  { id: "translate", label: "Translate to Spanish", prompt: "Translate this content into Spanish. Return only the translation.", suggestion: true },
  { id: "explain", label: "Explain", prompt: "Explain what this content means in plain language for a non-expert reader.", suggestion: false },
  { id: "variations", label: "Generate variations", prompt: "Generate 3 distinct variations of this content as a numbered list.", suggestion: false },
  { id: "grammar", label: "Fix grammar", prompt: "Fix grammar and spelling without changing meaning. Return only the corrected content.", suggestion: true },
  { id: "seo", label: "Improve SEO", prompt: "Rewrite this content to be more SEO-friendly while keeping it natural. Return only the rewritten content.", suggestion: true },
  { id: "metadata", label: "Generate metadata", prompt: "Generate an SEO title (max 60 chars) and meta description (max 160 chars) for this content. Format as `Title: ...` then `Description: ...`.", suggestion: false },
  { id: "alt", label: "Generate alt text", prompt: "Generate concise descriptive alt text for the described image.", suggestion: false },
] as const;

export type AiActionId = (typeof AI_QUICK_ACTIONS)[number]["id"];

export const AI_SYSTEM_PROMPT =
  "You are an embedded AI collaborator inside a CMS comment thread. Be concise, friendly, and aware of the discussion history. When asked to rewrite, return only the rewritten content with no preamble.";
