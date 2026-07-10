/**
 * pages-store — the source of truth for visual-editor pages, per project.
 *
 * A page is an ordered list of section instances (see SectionSystem). Every
 * project is lazily seeded with a small marketing site so marketers, content
 * editors and reviewers always have real content to work with. Both the visual
 * editor and the Content tab read/write this store, so a page created in one
 * shows up in the other.
 *
 * In-memory for the demo; production persists per project in the backend.
 */
import { useSyncExternalStore } from "react";
import { createSection, type SectionInstance } from "@/components/cms/editor/sections/SectionSystem";

export type PageState = "draft" | "published" | "modified" | "scheduled" | "archived";

/** What the page looked like the last time it was published. Drives Compare. */
export interface PageDocSnapshot {
  capturedAt: number;
  title: string;
  sections: SectionInstance[];
  seoTitle?: string;
  seoDescription?: string;
}

export interface PageDoc {
  id: string;
  path: string;
  title: string;
  state: PageState;
  sections: SectionInstance[];
  scheduledAt?: string;
  updatedAt: number;
  /** Snapshot from the last publish, so a draft can be compared against it. */
  publishedSnapshot?: PageDocSnapshot;
  /** SEO / page meta, editable in Page settings. */
  seoTitle?: string;
  seoDescription?: string;
  /** Social preview image URL (og:image / twitter:image). */
  ogImage?: string;
  indexing?: "index" | "noindex";
  /** Structured data (JSON-LD), emitted in the page head when valid. */
  jsonLd?: string;
  /** Organizing folder id, or undefined for the root of the pages tree. */
  folderId?: string | null;
  /** Pushed to the private staging environment. */
  staged?: boolean;
  /** Set when a generator created this page; groups a batch for review. */
  batchId?: string;
  /** The keyword or account the page was generated for. */
  generatedFor?: string;
}

/* --------------------------------------------------------------- store */

const byProject = new Map<string, PageDoc[]>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function ensure(projectId: string): PageDoc[] {
  let arr = byProject.get(projectId);
  if (!arr) {
    arr = seed(projectId);
    byProject.set(projectId, arr);
  }
  return arr;
}

export function usePages(projectId: string): PageDoc[] {
  return useSyncExternalStore(
    subscribe,
    () => ensure(projectId),
    () => ensure(projectId),
  );
}
export function getPages(projectId: string): PageDoc[] {
  return ensure(projectId);
}

let seq = 0;
export function newPageId() {
  return `pg_${Date.now().toString(36)}${(seq++).toString(36)}`;
}

export const pagesActions = {
  update(projectId: string, path: string, patch: (p: PageDoc) => PageDoc) {
    byProject.set(
      projectId,
      ensure(projectId).map((p) => (p.path === path ? { ...patch(p), updatedAt: Date.now() } : p)),
    );
    emit();
  },
  replace(projectId: string, next: PageDoc[]) {
    byProject.set(projectId, next);
    emit();
  },
  add(projectId: string, page: PageDoc, at?: number) {
    const arr = ensure(projectId);
    const i = at == null ? arr.length : Math.min(Math.max(at, 0), arr.length);
    byProject.set(projectId, [...arr.slice(0, i), page, ...arr.slice(i)]);
    emit();
  },
  remove(projectId: string, path: string) {
    byProject.set(
      projectId,
      ensure(projectId).filter((p) => p.path !== path),
    );
    emit();
  },
  /** Move a page into a folder (or to root with null). Path is unchanged. */
  setFolder(projectId: string, path: string, folderId: string | null) {
    byProject.set(
      projectId,
      ensure(projectId).map((p) => (p.path === path ? { ...p, folderId, updatedAt: Date.now() } : p)),
    );
    emit();
  },
  /** Clear a folder from any pages that referenced it (after folder delete). */
  clearFolders(projectId: string, folderIds: string[]) {
    const gone = new Set(folderIds);
    byProject.set(
      projectId,
      ensure(projectId).map((p) => (p.folderId && gone.has(p.folderId) ? { ...p, folderId: null } : p)),
    );
    emit();
  },
  /** Publish a page and capture a snapshot of what went live (drives Compare). */
  publish(projectId: string, path: string, opts?: { scheduledAt?: string }) {
    this.update(projectId, path, (p) => ({
      ...p,
      state: opts?.scheduledAt ? "scheduled" : "published",
      scheduledAt: opts?.scheduledAt,
      publishedSnapshot: opts?.scheduledAt
        ? p.publishedSnapshot
        : { capturedAt: Date.now(), title: p.title, sections: structuredClone(p.sections), seoTitle: p.seoTitle, seoDescription: p.seoDescription },
    }));
  },
};

/**
 * Copy a project's pages into a target project (used when cloning a project
 * from a shared template link). Fresh page + section ids so the two projects
 * never alias. Must run before anything reads the target — otherwise ensure()
 * would seed it with the default marketing pages instead.
 */
export function clonePagesTo(sourceProjectId: string, targetProjectId: string) {
  const source = ensure(sourceProjectId);
  const cloned = source.map((p) => ({
    ...p,
    id: newPageId(),
    updatedAt: Date.now(),
    sections: p.sections.map((s) => ({ ...s, id: `s_${Date.now().toString(36)}${(seq++).toString(36)}` })),
  }));
  byProject.set(targetProjectId, cloned);
  emit();
}

/** Build a page from a section spec list, giving each section a fresh id. */
export function buildPage(
  meta: { path: string; title: string; state: PageState },
  specs: { type: string; variant?: string; content?: Record<string, string> }[],
): PageDoc {
  return {
    id: newPageId(),
    path: meta.path,
    title: meta.title,
    state: meta.state,
    updatedAt: Date.now(),
    sections: specs.map((s) => {
      const inst = createSection(s.type, s.variant);
      return { ...inst, content: { ...inst.content, ...(s.content ?? {}) } } as SectionInstance;
    }),
  };
}

/* --------------------------------------------------------------- seed */

function seed(_projectId: string): PageDoc[] {
  const home = buildPage({ path: "/", title: "Home", state: "published" }, [
    {
      type: "hero",
      variant: "centered",
      content: {
        badge: "New",
        headline: "The AI workspace for modern product teams",
        subheadline: "Model your content once, deliver it everywhere. A headless CMS built for developers and editors alike.",
        primaryCta: "Get started",
        secondaryCta: "Learn more",
      },
    },
    { type: "logos" },
    { type: "features", content: { heading: "Everything you need to ship", item1: "Composable content", item2: "Realtime preview", item3: "Ship anywhere" } },
    { type: "cta", variant: "banner", content: { heading: "Ready to ship faster?", subtext: "Start free and publish your first page today.", ctaLabel: "Start building" } },
  ]);
  // Keep the home hero id stable so the seeded comment thread anchors to it.
  home.sections[0] = { ...home.sections[0], id: "s_home_hero" };
  // Home carries unpublished changes vs. what's live, so Compare has something
  // to show out of the box: the live headline is the older wording.
  home.state = "modified";
  home.publishedSnapshot = {
    capturedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    title: home.title,
    seoTitle: home.seoTitle,
    seoDescription: home.seoDescription,
    sections: home.sections.map((s, i) =>
      i === 0
        ? { ...structuredClone(s), content: { ...s.content, headline: "The all-in-one workspace for product teams", subheadline: "Model your content once and ship it anywhere. A headless CMS for developers and editors." } }
        : structuredClone(s),
    ),
  };

  const about = buildPage({ path: "/about", title: "About", state: "published" }, [
    {
      type: "hero",
      variant: "split",
      content: {
        badge: "Company",
        headline: "We're building the future of content",
        subheadline: "A small team obsessed with giving developers and editors the same superpowers. Get to know us.",
        primaryCta: "Join the team",
        secondaryCta: "Open roles",
      },
    },
    { type: "features", content: { heading: "What drives us", item1: "Our mission", item2: "Our team", item3: "Our values" } },
    { type: "testimonial" },
  ]);

  const pricing = buildPage({ path: "/pricing", title: "Pricing", state: "draft" }, [
    {
      type: "hero",
      variant: "centered",
      content: {
        badge: "Plans",
        headline: "Simple, transparent pricing",
        subheadline: "Start free, scale as you grow. No seat taxes, no surprises, just content that ships.",
        primaryCta: "Start free",
        secondaryCta: "Talk to sales",
      },
    },
    { type: "pricing", content: { heading: "Pick the plan that fits", subtext: "Upgrade or downgrade at any time." } },
    {
      type: "faq",
      content: {
        heading: "Frequently asked questions",
        q1: "Can I change plans later?",
        a1: "Yes. Upgrades apply right away and downgrades take effect at the next billing cycle.",
        q2: "Is there a free trial?",
        a2: "Every site starts free. Paid plans add bandwidth, locales, and AI credits.",
      },
    },
  ]);

  const blog = buildPage({ path: "/blog", title: "Blog", state: "published" }, [
    {
      type: "hero",
      variant: "centered",
      content: {
        badge: "Writing",
        headline: "Latest from the team",
        subheadline: "Product updates, engineering deep-dives, and lessons from building a headless CMS.",
        primaryCta: "Read more",
        secondaryCta: "Subscribe",
      },
    },
    { type: "features", content: { heading: "Browse by topic", item1: "Product", item2: "Engineering", item3: "Company" } },
  ]);

  const contact = buildPage({ path: "/contact", title: "Contact", state: "scheduled" }, [
    { type: "hero", variant: "split", content: { badge: "Contact", headline: "Talk to our team", subheadline: "Tell us what you're building and we'll help you ship it.", primaryCta: "Book a call", secondaryCta: "Email us" } },
    { type: "contact" },
  ]);
  contact.scheduledAt = new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString();

  return [home, about, pricing, blog, contact];
}
