/**
 * rich-blocks — the catalog behind the content editor's slash menu:
 * AI commands, reusable component instances, embed providers, and callout
 * tones. Kept data-only so the editor and its renderers can share it.
 *
 * Everything AI here is SIMULATED locally (no backend) so the demo runs
 * offline, mirroring how Sanity AI Assist / BaseHub agents / Contentful AI
 * Actions surface AI right in the editor.
 */
import type { DocTone } from "./doc";

/* --------------------------------------------------------------- tones */

export const CALLOUT_TONES: {
  id: DocTone;
  label: string;
  emoji: string;
  ring: string;
  bg: string;
  icon: string;
}[] = [
  { id: "info", label: "Info", emoji: "💡", ring: "border-sky-400/40", bg: "bg-sky-500/10", icon: "text-sky-500" },
  { id: "success", label: "Success", emoji: "✅", ring: "border-emerald-400/40", bg: "bg-emerald-500/10", icon: "text-emerald-500" },
  { id: "warning", label: "Warning", emoji: "⚠️", ring: "border-amber-400/40", bg: "bg-amber-500/10", icon: "text-amber-500" },
  { id: "danger", label: "Danger", emoji: "🛑", ring: "border-rose-400/40", bg: "bg-rose-500/10", icon: "text-rose-500" },
  { id: "neutral", label: "Note", emoji: "📌", ring: "border-border", bg: "bg-muted/50", icon: "text-muted-foreground" },
];

export function toneOf(id?: DocTone) {
  return CALLOUT_TONES.find((t) => t.id === id) ?? CALLOUT_TONES[0];
}

/* -------------------------------------------------------------- embeds */

export type EmbedInfo = { provider: string; label: string; embedUrl: string; aspect: string };

/** Best-effort provider detection for a pasted URL. */
export function detectEmbed(raw: string): EmbedInfo {
  const url = raw.trim();
  const generic: EmbedInfo = { provider: "generic", label: "Embed", embedUrl: url, aspect: "16/9" };
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v");
      if (id) return { provider: "youtube", label: "YouTube", embedUrl: `https://www.youtube.com/embed/${id}`, aspect: "16/9" };
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return { provider: "youtube", label: "YouTube", embedUrl: `https://www.youtube.com/embed/${id}`, aspect: "16/9" };
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return { provider: "vimeo", label: "Vimeo", embedUrl: `https://player.vimeo.com/video/${id}`, aspect: "16/9" };
    }
    if (host === "loom.com") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return { provider: "loom", label: "Loom", embedUrl: `https://www.loom.com/embed/${id}`, aspect: "16/9" };
    }
    if (host.endsWith("figma.com")) {
      return { provider: "figma", label: "Figma", embedUrl: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`, aspect: "4/3" };
    }
    if (host === "codepen.io") {
      const embed = url.replace("/pen/", "/embed/");
      return { provider: "codepen", label: "CodePen", embedUrl: embed, aspect: "4/3" };
    }
    if (host === "codesandbox.io") {
      return { provider: "codesandbox", label: "CodeSandbox", embedUrl: url.replace("/s/", "/embed/"), aspect: "4/3" };
    }
    if (host === "twitter.com" || host === "x.com") {
      return { provider: "twitter", label: "Post", embedUrl: url, aspect: "auto" };
    }
    if (host.endsWith("spotify.com")) {
      return { provider: "spotify", label: "Spotify", embedUrl: url.replace("/open.", "/").replace("spotify.com/", "spotify.com/embed/"), aspect: "auto" };
    }
    return { ...generic, label: host };
  } catch {
    return generic;
  }
}

/** Simulated link-preview metadata for the bookmark block. */
export function fakeBookmarkMeta(raw: string): { title: string; desc: string; site: string } {
  try {
    const u = new URL(raw.trim());
    const site = u.hostname.replace(/^www\./, "");
    const slug = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const title = slug
      ? slug.replace(/[-_]+/g, " ").replace(/\.\w+$/, "").replace(/^\w/, (c) => c.toUpperCase())
      : site;
    return { title, desc: `A page on ${site}. Open the link to read the full article.`, site };
  } catch {
    return { title: raw, desc: "", site: "" };
  }
}

/* ---------------------------------------------------------- components */

export type ComponentDef = {
  key: string;
  label: string;
  desc: string;
  icon: string; // lucide icon name
  accent: string;
  defaults: () => { title?: string; desc?: string; props?: Record<string, string> };
};

/** Reusable, typed component instances you can drop into body copy, the
 *  way BaseHub instantiates components inside rich text. */
export const COMPONENT_CATALOG: ComponentDef[] = [
  {
    key: "cta-banner", label: "CTA banner", desc: "Headline, subtext, and a button",
    icon: "Megaphone", accent: "from-indigo-500 to-fuchsia-500",
    defaults: () => ({ title: "Ready to get started?", desc: "Spin up your first project in minutes.", props: { button: "Get started", href: "#" } }),
  },
  {
    key: "newsletter", label: "Newsletter signup", desc: "Email capture with a button",
    icon: "Mail", accent: "from-sky-500 to-cyan-500",
    defaults: () => ({ title: "Subscribe to the newsletter", desc: "Product updates, no spam.", props: { button: "Subscribe", placeholder: "you@company.com" } }),
  },
  {
    key: "pricing", label: "Pricing card", desc: "Plan, price, and features",
    icon: "CreditCard", accent: "from-emerald-500 to-teal-500",
    defaults: () => ({ title: "Pro", desc: "For growing teams", props: { price: "$29", period: "/mo", features: "Unlimited pages\nRoles and workflows\nPriority support", button: "Choose Pro" } }),
  },
  {
    key: "testimonial", label: "Testimonial", desc: "Quote with author and role",
    icon: "Quote", accent: "from-amber-500 to-orange-500",
    defaults: () => ({ title: "This changed how our team ships content.", props: { author: "Maya Chen", role: "Head of Content, Northwind" } }),
  },
  {
    key: "stat", label: "Stat highlight", desc: "A big number with a label",
    icon: "TrendingUp", accent: "from-violet-500 to-purple-500",
    defaults: () => ({ title: "98%", desc: "Faster time to publish", props: {} }),
  },
  {
    key: "profile", label: "Author card", desc: "Avatar, name, and bio",
    icon: "UserRound", accent: "from-pink-500 to-rose-500",
    defaults: () => ({ title: "Arnab Dhar", desc: "Writes about content operations and headless CMS.", props: { role: "Staff Writer" } }),
  },
  {
    key: "product-hunt", label: "Badge", desc: "A small promo badge",
    icon: "Award", accent: "from-orange-500 to-red-500",
    defaults: () => ({ title: "Featured on the front page", props: { tag: "New" } }),
  },
  {
    key: "faq", label: "FAQ item", desc: "A question and answer",
    icon: "MessagesSquare", accent: "from-slate-500 to-slate-600",
    defaults: () => ({ title: "Can I bring my own frontend?", desc: "Yes. Query content over the headless API and render it anywhere.", props: {} }),
  },
];

export function componentDef(key?: string): ComponentDef | undefined {
  return COMPONENT_CATALOG.find((c) => c.key === key);
}

/* ------------------------------------------------------------------ AI */

export type AiCommand = {
  id: string;
  label: string;
  desc: string;
  icon: string;
  /** How the result is applied. */
  mode: "append" | "replace" | "callout" | "image";
};

export const AI_COMMANDS: AiCommand[] = [
  { id: "continue", label: "Continue writing", desc: "Let AI extend from here", icon: "PenLine", mode: "append" },
  { id: "summary", label: "Summarize", desc: "Add a short summary callout", icon: "ListChecks", mode: "callout" },
  { id: "improve", label: "Improve writing", desc: "Rewrite this block more clearly", icon: "Wand2", mode: "replace" },
  { id: "longer", label: "Make longer", desc: "Expand this block with detail", icon: "StretchHorizontal", mode: "replace" },
  { id: "shorter", label: "Make shorter", desc: "Tighten this block", icon: "Minimize2", mode: "replace" },
  { id: "image", label: "Generate image", desc: "Create a placeholder image", icon: "ImagePlus", mode: "image" },
];

const LOREM = [
  "Structured content keeps your team fast: model once, and every channel reads the same source of truth.",
  "Editors work in a familiar document, while developers query clean, typed data over the API.",
  "Because layout lives in your frontend, a copy change never waits on a deploy.",
  "Reusable components mean a tweak in one place updates everywhere it appears.",
  "That separation is what lets a small team ship like a much larger one.",
];

/** Deterministic-enough local text generation for the demo. */
export function simulateAi(cmd: AiCommand, context: string): string {
  const base = context.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  switch (cmd.id) {
    case "continue":
      return LOREM[Math.floor((base.length || 1) % LOREM.length)];
    case "summary": {
      const first = base.split(/[.!?]/)[0]?.trim();
      return first ? `In short: ${first.toLowerCase()}.` : "In short: a clear, structured take on the topic above.";
    }
    case "improve":
      return base ? base.replace(/\s+/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "A clearer, more direct version of this idea.";
    case "longer":
      return `${base} ${LOREM[0]} ${LOREM[2]}`.trim();
    case "shorter": {
      const words = base.split(" ");
      return words.length > 16 ? words.slice(0, 16).join(" ") + "." : base;
    }
    default:
      return base;
  }
}
