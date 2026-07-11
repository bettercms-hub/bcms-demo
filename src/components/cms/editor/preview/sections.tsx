/** Brand-neutral preview renderers for each SectionKind. Reads section.props directly. */
import * as React from "react";
import { useMemo, useState } from "react";

import type { Page, Section, SectionKind } from "@/lib/cms/types";
import { useCMS, DEFAULT_SECTION_PROPS } from "@/lib/cms/store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search } from "lucide-react";
import { BlockTree } from "./blocks";
import { EmptySectionPlaceholder } from "./EmptySectionPlaceholder";
import { PreviewSectionContext, usePreviewSync } from "./preview-sync";



const str = (v: unknown, fallback = "") => (v == null ? fallback : String(v));
const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(12, Math.floor(n)) : fallback;
};

const BG_CLASS: Record<string, string> = {
  default: "bg-white text-foreground",
  muted: "bg-surface text-foreground",
  inverse: "bg-foreground text-background",
  accent: "bg-primary/10 text-foreground",
  transparent: "text-foreground",
  surface: "bg-surface text-foreground",
  custom: "text-foreground",
};
const SPACING_CLASS: Record<string, string> = {
  compact: "py-8 px-6",
  comfortable: "py-14 px-8",
  spacious: "py-24 px-10",
};
const ALIGN_CLASS: Record<string, string> = {
  left: "text-left items-start",
  center: "text-center items-center",
  right: "text-right items-end",
};

const PY_CLASS: Record<string, string> = {
  none: "py-0", sm: "py-6", md: "py-12", lg: "py-20", xl: "py-32",
};
const PX_CLASS: Record<string, string> = {
  none: "px-0", sm: "px-4", md: "px-6", lg: "px-10",
};
const WIDTH_CLASS: Record<string, string> = {
  full: "max-w-none",
  wide: "max-w-7xl",
  default: "max-w-5xl",
  narrow: "max-w-3xl",
};
const GAP_CLASS: Record<string, string> = {
  none: "gap-0", sm: "gap-2", md: "gap-4", lg: "gap-8",
};
const TONE_CLASS: Record<string, string> = {
  default: "", muted: "text-muted-foreground", inverse: "text-background",
};
const FONT_SCALE_CLASS: Record<string, string> = {
  sm: "text-[13px]", md: "", lg: "text-[15px]",
};
const RADIUS_CLASS: Record<string, string> = {
  none: "rounded-none", sm: "rounded-md", md: "rounded-lg", lg: "rounded-xl", xl: "rounded-2xl",
};
const SHADOW_CLASS: Record<string, string> = {
  none: "", sm: "shadow-sm", md: "shadow-md", lg: "shadow-lg",
};

const DEVICE_HIDE_CLASS: Record<string, string> = {
  all: "",
  mobile: "hidden sm:flex",      // visible only on >=sm
  tablet: "hidden md:flex lg:hidden",
  desktop: "hidden lg:flex",
};

function Frame({ section, children }: { section: Section; children: React.ReactNode }) {
  const layout = section.layout ?? {};
  const style = section.style ?? {};
  const seo = section.seo ?? {};
  const advanced = section.advanced ?? {};

  const bgKey = style.background ?? str(section.props.background, "default");
  let bg = BG_CLASS[bgKey] ?? BG_CLASS.default;
  // Section-scoped theme. Dark rides the app's `.dark` token remap so every
  // block inside flips with it; when no explicit surface is set we supply one.
  const theme = style.theme ?? "inherit";
  const themeCls =
    theme === "dark" ? "dark" : "";
  if (theme === "dark" && (bgKey === "default" || bgKey === "transparent") && !style.backgroundColor && !style.backgroundImage) {
    bg = "bg-neutral-950 text-neutral-100";
  } else if (theme === "light" && (bgKey === "default" || bgKey === "transparent") && !style.backgroundColor) {
    bg = "bg-white text-neutral-900";
  }
  const sp = layout.paddingY || layout.paddingX
    ? `${PY_CLASS[layout.paddingY ?? "md"]} ${PX_CLASS[layout.paddingX ?? "md"]}`
    : SPACING_CLASS[str(section.props.spacing, "comfortable")] ?? SPACING_CLASS.comfortable;
  const al = ALIGN_CLASS[layout.align ?? str(section.props.align, "center")] ?? ALIGN_CLASS.center;
  const widthCls = WIDTH_CLASS[layout.width ?? "default"];
  const gapCls = GAP_CLASS[layout.gap ?? "md"];
  const toneCls = TONE_CLASS[style.textTone ?? "default"];
  const fontCls = FONT_SCALE_CLASS[style.fontScale ?? "md"];
  const radiusCls = RADIUS_CLASS[style.radius ?? "none"];
  const shadowCls = SHADOW_CLASS[style.shadow ?? "none"];
  const borderCls = [
    style.borderTop ? "border-t border-border" : "",
    style.borderBottom ? "border-b border-border" : "",
  ].join(" ");

  const inlineStyle: React.CSSProperties = {};
  if (style.background === "custom" && style.backgroundColor) {
    inlineStyle.backgroundColor = style.backgroundColor;
  }
  if (style.backgroundImage) {
    inlineStyle.backgroundImage = `url(${style.backgroundImage})`;
    inlineStyle.backgroundSize = "cover";
    inlineStyle.backgroundPosition = "center";
  }
  if (typeof advanced.zIndex === "number") {
    inlineStyle.zIndex = advanced.zIndex;
    inlineStyle.position = inlineStyle.position ?? "relative";
  }
  // Full viewport height: stretch and center the content vertically.
  const fullHeight = !!layout.fullHeight;
  if (fullHeight) inlineStyle.minHeight = "100vh";
  // Legibility scrim over the background image (0-100).
  const overlay = style.backgroundImage ? Math.max(0, Math.min(100, style.overlayOpacity ?? 0)) / 100 : 0;

  const hidden = !!advanced.hidden || !!section.props.hidden;
  if (hidden) {
    return (
      <div className="border-y border-dashed border-border bg-surface px-6 py-3 text-center text-[11px] text-muted-foreground">
        {section.name} · hidden
      </div>
    );
  }

  const Tag = (advanced.htmlTag ?? "section") as React.ElementType;
  const domId = advanced.customId || seo.anchorId || undefined;
  const deviceCls = DEVICE_HIDE_CLASS[advanced.visibility?.device ?? "all"] ?? "";

  const extraAttrs: Record<string, string> = {};
  for (const a of advanced.customAttributes ?? []) {
    if (!a.name) continue;
    // Skip names that React handles specially via known props
    if (a.name === "id" || a.name === "class" || a.name === "className" || a.name === "style") continue;
    extraAttrs[a.name] = a.value ?? "";
  }

  // Chrome sections (navigation/header/footer) own their own width + padding
  // via their NavBar/FooterBar block. Skip the centered max-width wrapper and
  // outer spacing so they can sit edge-to-edge at the top of the page.
  const isChrome =
    section.kind === "navigation" || section.kind === "header" || section.kind === "footer";

  return (
    <PreviewSectionContext.Provider value={section.id}>
      {advanced.customCss && domId && (
        <style dangerouslySetInnerHTML={{ __html: scopeCss(advanced.customCss, domId) }} />
      )}
      <SectionSelectable section={section}>
        <Tag
          id={domId}
          aria-label={seo.ariaLabel || undefined}
          className={
            isChrome
              ? `${themeCls} ${bg} ${toneCls} ${fontCls} ${borderCls} ${deviceCls} ${advanced.customClassName ?? ""}`.trim()
              : `${themeCls} ${overlay > 0 ? "relative" : ""} ${fullHeight ? "flex flex-col justify-center" : ""} ${bg} ${sp} ${toneCls} ${fontCls} ${radiusCls} ${shadowCls} ${borderCls} ${deviceCls} ${advanced.customClassName ?? ""}`.trim()
          }
          style={inlineStyle}
          {...extraAttrs}
        >
          {overlay > 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundColor: `rgba(0,0,0,${overlay})`, borderRadius: "inherit" }}
            />
          )}
          {isChrome ? (
            children
          ) : (
            <div className={`${overlay > 0 ? "relative" : ""} mx-auto flex w-full flex-col ${widthCls} ${gapCls} ${al}`}>{children}</div>
          )}
        </Tag>
      </SectionSelectable>
    </PreviewSectionContext.Provider>
  );
}

/** Hover/select shell around every section in the live preview. */
function SectionSelectable({ section, children }: { section: Section; children: React.ReactNode }) {
  const sync = usePreviewSync();
  if (!sync.active) return <>{children}</>;
  const isSelected = sync.selectedSectionId === section.id;
  const isHover = !isSelected && sync.hoverSectionId === section.id;
  const ring = isSelected
    ? "ring-1 ring-[color:var(--ring,theme(colors.primary.DEFAULT))] ring-offset-0"
    : isHover
      ? "ring-1 ring-[color:color-mix(in_srgb,var(--ring,theme(colors.primary.DEFAULT))_35%,transparent)]"
      : "";
  return (
    <div
      data-preview-section-id={section.id}
      onMouseEnter={(e) => {
        e.stopPropagation();
        sync.setSectionHover(section.id);
      }}
      onMouseLeave={(e) => {
        e.stopPropagation();
        sync.setSectionHover(undefined);
      }}
      onClick={(e) => {
        // Only react if no inner block consumed the click.
        if ((e.target as HTMLElement).closest("[data-preview-block-path]")) return;
        e.stopPropagation();
        sync.selectSection(section.id, "preview");
      }}
      className={`relative isolate ${ring}`}
    >
      {(isHover || isSelected) && (
        <div className="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-[5px] bg-foreground/90 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-background shadow-sm">
          <span>{section.name || section.kind}</span>
          <span className="opacity-60">·</span>
          <span className="opacity-80">{(section.blocks?.length ?? 0)} blocks</span>
        </div>
      )}
      {children}
    </div>
  );
}


/** Naive scoper: prefixes each selector with `#<id>`. Skips @rules. */
function scopeCss(css: string, id: string): string {
  return css.replace(/(^|\})\s*([^{}@]+)\{/g, (_m, brace, sel) => {
    const scoped = sel
      .split(",")
      .map((s: string) => {
        const t = s.trim();
        if (!t) return "";
        if (t.startsWith("&")) return `#${id}${t.slice(1)}`;
        return `#${id} ${t}`;
      })
      .filter(Boolean)
      .join(", ");
    return `${brace} ${scoped} {`;
  });
}


function Rich({ html, className = "" }: { html: string; className?: string }) {
  if (!html) return null;
  return <div className={`bcms-prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

function CTA({ section }: { section: Section }) {
  const text = str(section.props.ctaText);
  const href = str(section.props.ctaHref, "#");
  if (!text) return null;
  return (
    <a href={href} className="mt-2 inline-flex h-10 items-center rounded-[6px] bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:opacity-90">
      {text}
    </a>
  );
}

function Hero({ section }: { section: Section }) {
  const eyebrow = str(section.props.eyebrow);
  const image = str(section.props.image);
  return (
    <Frame section={section}>
      {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</div>}
      <h1 className="text-4xl font-semibold tracking-tight">{str(section.props.heading, "Hero headline")}</h1>
      <Rich html={str(section.props.subheading)} className="max-w-2xl text-[15px] text-muted-foreground" />
      <CTA section={section} />
      {image && (
        <div className="mt-4 w-full overflow-hidden rounded-[8px] border border-border bg-surface">
          <div className="aspect-[16/9] bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} />
        </div>
      )}
    </Frame>
  );
}

function Features({ section }: { section: Section }) {
  const cols = num(section.props.columns, 3);
  return (
    <Frame section={section}>
      <h2 className="text-2xl font-semibold tracking-tight">{str(section.props.heading, "Features")}</h2>
      {Boolean(section.props.subheading) && <div className="text-[14px] text-muted-foreground">{str(section.props.subheading)}</div>}
      <Rich html={str(section.props.body)} className="max-w-3xl text-[14px] text-muted-foreground" />
      <div className={`mt-4 grid w-full gap-3 grid-cols-1 md:grid-cols-${cols}`}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="rounded-[8px] border border-border bg-white p-4">
            <div className="mb-2 h-7 w-7 rounded-[6px] bg-primary/10" />
            <div className="text-[13px] font-semibold">Feature {i + 1}</div>
            <div className="mt-1 text-[12px] text-muted-foreground">A short description of this feature.</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Pricing({ section }: { section: Section }) {
  const plans = num(section.props.plans, 3);
  return (
    <Frame section={section}>
      <h2 className="text-2xl font-semibold tracking-tight">{str(section.props.heading, "Pricing")}</h2>
      {Boolean(section.props.subheading) && <div className="text-[14px] text-muted-foreground">{str(section.props.subheading)}</div>}
      <div className={`mt-4 grid w-full gap-3 grid-cols-1 md:grid-cols-${plans}`}>
        {Array.from({ length: plans }).map((_, i) => (
          <div key={i} className="rounded-[8px] border border-border bg-white p-5">
            <div className="text-[12px] uppercase tracking-wider text-muted-foreground">Plan {i + 1}</div>
            <div className="mt-1 text-2xl font-semibold">${(i + 1) * 19}<span className="text-[12px] text-muted-foreground">/mo</span></div>
            <ul className="mt-3 space-y-1 text-[12px] text-muted-foreground">
              <li>· Feature A</li><li>· Feature B</li><li>· Feature C</li>
            </ul>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Testimonials({ section }: { section: Section }) {
  return (
    <Frame section={section}>
      <h2 className="text-2xl font-semibold tracking-tight">{str(section.props.heading, "Loved by teams")}</h2>
      <div className="mt-4 grid w-full grid-cols-1 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <blockquote key={i} className="rounded-[8px] border border-border bg-white p-4 text-[13px] text-muted-foreground">
            “This product changed how our team ships.” <div className="mt-2 text-[12px] text-foreground">Customer {i + 1}</div>
          </blockquote>
        ))}
      </div>
    </Frame>
  );
}

function Logos({ section }: { section: Section }) {
  const count = num(section.props.count, 6);
  return (
    <Frame section={section}>
      {Boolean(section.props.heading) && <div className="text-[12px] uppercase tracking-wider text-muted-foreground">{str(section.props.heading)}</div>}
      <div className="mt-2 grid w-full grid-cols-3 gap-4 md:grid-cols-6">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-8 rounded-[4px] bg-muted" />
        ))}
      </div>
    </Frame>
  );
}

function Cta({ section }: { section: Section }) {
  return (
    <Frame section={section}>
      <h2 className="text-2xl font-semibold tracking-tight">{str(section.props.heading, "Ready to start?")}</h2>
      {Boolean(section.props.subheading) && <div className="text-[14px] text-muted-foreground">{str(section.props.subheading)}</div>}
      <CTA section={section} />
    </Frame>
  );
}

function Faq({ section }: { section: Section }) {
  const items = num(section.props.items, 6);
  return (
    <Frame section={section}>
      <h2 className="text-2xl font-semibold tracking-tight">{str(section.props.heading, "Frequently asked questions")}</h2>
      <Rich html={str(section.props.body)} className="max-w-3xl text-[14px] text-muted-foreground" />
      <div className="mt-4 w-full divide-y divide-border rounded-[8px] border border-border bg-white">
        {Array.from({ length: items }).map((_, i) => (
          <details key={i} className="px-4 py-3 text-[13px]">
            <summary className="cursor-pointer font-medium">Question {i + 1}</summary>
            <div className="mt-1 text-muted-foreground">Answer placeholder text for question {i + 1}.</div>
          </details>
        ))}
      </div>
    </Frame>
  );
}

function Content({ section }: { section: Section }) {
  return (
    <Frame section={section}>
      {Boolean(section.props.heading) && <h2 className="text-2xl font-semibold tracking-tight">{str(section.props.heading)}</h2>}
      <Rich html={str(section.props.body)} className="max-w-3xl text-[14px]" />
    </Frame>
  );
}

function Header({ section }: { section: Section }) {
  const links = str(section.props.links, "Product, Pricing, About").split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <header className="flex items-center justify-between border-b border-border bg-white px-6 py-4">
      <div className="text-[14px] font-semibold">{str(section.props.logo, "Brand")}</div>
      <nav className="flex items-center gap-5 text-[13px] text-muted-foreground">
        {links.map((l) => <a key={l} href="#" className="hover:text-foreground">{l}</a>)}
      </nav>
      <CTA section={section} />
    </header>
  );
}

function Footer({ section }: { section: Section }) {
  return (
    <footer className="border-t border-border bg-surface px-6 py-8 text-[12px] text-muted-foreground">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <span>{str(section.props.tagline)}</span>
        <span>{str(section.props.copyright, "© 2026")}</span>
      </div>
    </footer>
  );
}

function Navigation({ section }: { section: Section }) {
  const logo = str(section.props.logo, "Northwind AI");
  const linksMode = str(section.props.linksMode, "auto");
  const menuMode = str(section.props.menuMode, "current-page-sections");
  const linksLimit = num(section.props.linksLimit, 5);
  const menuLabel = str(section.props.menuLabel, "On this page");
  const showSearch = section.props.showSearch !== false;
  const language = str(section.props.language, "EN");
  const ctaText = str(section.props.ctaText, "Start free");

  // Resolve the project this nav belongs to, then pull its pages + sections.
  const projectId = useCMS((s) => s.pages.find((p) => p.id === section.pageId)?.projectId);
  const pages = useCMS((s) =>
    projectId
      ? s.pages.filter((p) => p.projectId === projectId && p.indexing !== "noindex" && !p.slug.startsWith("_"))
      : ([] as Page[]),
  );
  const menuSourcePageId = str(section.props.menuSourcePageId) || section.pageId;
  const sourceSections = useCMS((s) =>
    s.sections.filter(
      (x) =>
        x.pageId === (menuMode === "page-sections" ? menuSourcePageId : section.pageId) &&
        x.id !== section.id &&
        x.kind !== "footer" &&
        x.kind !== "navigation" &&
        x.kind !== "header",
    ),
  );

  // Primary links
  const primaryLinks = useMemo(() => {
    if (linksMode === "manual") {
      return str(section.props.links, "Product, Pricing, Docs")
        .split(",").map((s) => s.trim()).filter(Boolean)
        .map((label) => ({ label, href: "#", pageId: undefined as string | undefined }));
    }
    return pages.slice(0, linksLimit).map((p) => ({
      label: p.title,
      href: "/" + p.slug.replace(/^\//, ""),
      pageId: p.id,
    }));
  }, [linksMode, pages, linksLimit, section.props.links]);

  // Mega menu items
  const menuItems = useMemo(() => {
    if (menuMode === "manual") {
      return str(section.props.menuItems, "")
        .split(",").map((s) => s.trim()).filter(Boolean);
    }
    return sourceSections.map((s) => s.name || s.kind);
  }, [menuMode, sourceSections, section.props.menuItems]);

  // Search state
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages.slice(0, 8);
    return pages
      .filter((p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
      .slice(0, 8);
  }, [pages, query]);

  return (
    <header className="border-b border-border bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <div className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
          <span className="inline-block h-5 w-5 rounded-[5px] bg-gradient-to-br from-primary to-primary/50" />
          {logo}
        </div>
        <nav className="flex items-center gap-5 text-[13px] text-muted-foreground">
          {primaryLinks.map((l, i) => {
            const isActive = l.pageId && l.pageId === section.pageId;
            return (
              <a
                key={l.pageId ?? l.label + i}
                href={l.href}
                onClick={(e) => e.preventDefault()}
                className={
                  "relative inline-flex items-center gap-1 transition-colors " +
                  (isActive
                    ? "text-foreground after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-px after:bg-foreground"
                    : "hover:text-foreground")
                }
              >
                {l.label}
                {i === 1 && menuItems.length > 0 && (
                  <span className="ml-0.5 text-[10px]">▾</span>
                )}
              </a>
            );
          })}
          {primaryLinks.length === 0 && (
            <span className="italic text-muted-foreground/60">No pages yet</span>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {showSearch && (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="hidden h-8 items-center gap-1.5 rounded-[6px] border border-border bg-surface px-2 text-[12px] text-muted-foreground hover:border-border-strong md:inline-flex"
                  data-no-comment
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Search…</span>
                  <kbd className="ml-2 rounded bg-muted px-1 text-[10px]">⌘K</kbd>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0">
                <div className="border-b border-border p-2">
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search pages…"
                    className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <div className="max-h-72 overflow-auto py-1">
                  {matches.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                      No matches
                    </div>
                  ) : (
                    matches.map((p) => (
                      <a
                        key={p.id}
                        href={"/" + p.slug.replace(/^\//, "")}
                        onClick={(e) => {
                          e.preventDefault();
                          setOpen(false);
                        }}
                        className="flex items-center justify-between gap-3 px-3 py-1.5 text-[13px] hover:bg-muted"
                      >
                        <span className="truncate">{p.title}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">/{p.slug.replace(/^\//, "")}</span>
                      </a>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <div className="hidden h-8 items-center rounded-[6px] border border-border px-2 text-[12px] text-muted-foreground md:inline-flex">{language}</div>
          <a href="#" className="hidden text-[13px] text-muted-foreground hover:text-foreground md:inline">Sign in</a>
          <CTA section={section} />
          {!ctaText && (
            <a href="#" className="inline-flex h-8 items-center rounded-[6px] bg-primary px-3 text-[12px] font-medium text-primary-foreground">Start free</a>
          )}
        </div>
      </div>
      {menuItems.length > 0 && (
        <div className="border-t border-dashed border-border bg-surface/60 px-6 py-2 text-[11px] text-muted-foreground">
          <span className="mr-3 font-medium text-foreground">{menuLabel}:</span>
          {menuItems.map((m) => (
            <span key={m} className="mr-3 inline-block">{m}</span>
          ))}
        </div>
      )}
    </header>
  );
}


function Workflow({ section }: { section: Section }) {
  const steps = num(section.props.steps, 4);
  return (
    <Frame section={section}>
      <h2 className="text-2xl font-semibold tracking-tight">{str(section.props.heading, "How it works")}</h2>
      {Boolean(section.props.subheading) && <div className="text-[14px] text-muted-foreground">{str(section.props.subheading)}</div>}
      <div className="relative mt-6 grid w-full gap-3 md:grid-cols-4">
        {Array.from({ length: steps }).map((_, i) => (
          <div key={i} className="relative rounded-[10px] border border-border bg-white p-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[12px] font-semibold text-primary">{i + 1}</div>
            <div className="mt-3 text-[13px] font-semibold">Step {i + 1}</div>
            <div className="mt-1 text-[12px] text-muted-foreground">Connect, configure, automate, and ship.</div>
            {i < steps - 1 && (
              <div className="absolute right-[-8px] top-1/2 hidden h-px w-4 bg-border md:block" />
            )}
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Integrations({ section }: { section: Section }) {
  const count = num(section.props.count, 12);
  return (
    <Frame section={section}>
      <h2 className="text-2xl font-semibold tracking-tight">{str(section.props.heading, "Connect everything")}</h2>
      {Boolean(section.props.subheading) && <div className="text-[14px] text-muted-foreground">{str(section.props.subheading)}</div>}
      <div className="mt-4 grid w-full grid-cols-3 gap-3 md:grid-cols-6">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex aspect-square items-center justify-center rounded-[10px] border border-border bg-white">
            <div className="h-8 w-8 rounded-[6px] bg-gradient-to-br from-muted to-surface" />
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Stats({ section }: { section: Section }) {
  const count = num(section.props.count, 4);
  const samples = [
    { v: "10M+", l: "requests / day" },
    { v: "99.99%", l: "uptime SLA" },
    { v: "120ms", l: "median latency" },
    { v: "4.9 ★", l: "G2 rating" },
  ];
  return (
    <Frame section={section}>
      <h2 className="text-2xl font-semibold tracking-tight">{str(section.props.heading, "Trusted at scale")}</h2>
      <div className="mt-4 grid w-full grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => {
          const s = samples[i % samples.length];
          return (
            <div key={i} className="rounded-[10px] border border-border bg-white p-5 text-left">
              <div className="text-3xl font-semibold tracking-tight">{s.v}</div>
              <div className="mt-1 text-[12px] text-muted-foreground">{s.l}</div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

function Blog({ section }: { section: Section }) {
  const count = num(section.props.count, 3);
  const posts = [
    { t: "Designing AI workflows that actually ship", d: "Patterns we use at Northwind to keep autonomous agents reliable.", a: "Jane Park", r: "5 min read" },
    { t: "Inside the Northwind realtime sync engine", d: "How we kept writes ordered without sacrificing edge latency.", a: "Devon Lee", r: "8 min read" },
    { t: "From prototype to production in a week", d: "A look at our internal velocity stack and CI pipeline.", a: "Alex Rivera", r: "4 min read" },
  ];
  return (
    <Frame section={section}>
      <h2 className="text-2xl font-semibold tracking-tight">{str(section.props.heading, "From the blog")}</h2>
      {Boolean(section.props.subheading) && <div className="text-[14px] text-muted-foreground">{str(section.props.subheading)}</div>}
      <div className="mt-4 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => {
          const p = posts[i % posts.length];
          return (
            <article key={i} className="overflow-hidden rounded-[10px] border border-border bg-white">
              <div className="aspect-[16/9] bg-gradient-to-br from-primary/15 via-surface to-muted" />
              <div className="p-4 text-left">
                <div className="text-[13px] font-semibold leading-snug">{p.t}</div>
                <div className="mt-1 text-[12px] text-muted-foreground">{p.d}</div>
                <div className="mt-3 text-[11px] text-muted-foreground">{p.a} · {p.r}</div>
              </div>
            </article>
          );
        })}
      </div>
    </Frame>
  );
}

function Docs({ section }: { section: Section }) {
  const count = num(section.props.count, 6);
  const cards = ["Quickstart", "Authentication", "SDKs", "Webhooks", "Realtime", "Agents API"];
  return (
    <Frame section={section}>
      <h2 className="text-2xl font-semibold tracking-tight">{str(section.props.heading, "Documentation")}</h2>
      <div className="mt-4 grid w-full grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <a key={i} href="#" className="rounded-[10px] border border-border bg-white p-4 text-left transition-colors hover:border-foreground/20">
            <div className="text-[13px] font-semibold">{cards[i % cards.length]}</div>
            <div className="mt-1 text-[12px] text-muted-foreground">Read the guide →</div>
          </a>
        ))}
      </div>
    </Frame>
  );
}

function Contact({ section }: { section: Section }) {
  return (
    <Frame section={section}>
      <h2 className="text-2xl font-semibold tracking-tight">{str(section.props.heading, "Talk to us")}</h2>
      {Boolean(section.props.subheading) && <div className="text-[14px] text-muted-foreground">{str(section.props.subheading)}</div>}
      <form className="mt-4 grid w-full max-w-xl grid-cols-1 gap-3 text-left">
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Full name" className="h-10 rounded-[6px] border border-border bg-white px-3 text-[13px]" />
          <input placeholder="Work email" className="h-10 rounded-[6px] border border-border bg-white px-3 text-[13px]" />
        </div>
        <input placeholder="Company" className="h-10 rounded-[6px] border border-border bg-white px-3 text-[13px]" />
        <textarea placeholder="How can we help?" rows={4} className="rounded-[6px] border border-border bg-white px-3 py-2 text-[13px]" />
        <CTA section={section} />
      </form>
    </Frame>
  );
}

const RENDERERS: Record<SectionKind, (props: { section: Section }) => React.ReactElement> = {
  hero: Hero, features: Features, pricing: Pricing, testimonials: Testimonials,
  logos: Logos, cta: Cta, faq: Faq, content: Content, header: Header, footer: Footer,
  navigation: Navigation, workflow: Workflow, integrations: Integrations, stats: Stats,
  blog: Blog, docs: Docs, contact: Contact,
};

/**
 * Section preview dispatch.
 *
 *  1) If the section has blocks → render the block tree inside the frame.
 *  2) Otherwise → render the empty-state placeholder (single source of truth).
 *
 * Note: `RENDERERS` and `DEFAULT_SECTION_PROPS` are retained for potential
 *  legacy fallbacks but are no longer used at dispatch time — every kind
 *  now seeds its own block tree on creation (and via store backfill).
 */
void RENDERERS;
void DEFAULT_SECTION_PROPS;

export function SectionPreview({ section }: { section: Section }) {
  if (section.blocks && section.blocks.length > 0) {
    return (
      <Frame section={section}>
        <BlockTree blocks={section.blocks} />
      </Frame>
    );
  }
  return (
    <Frame section={section}>
      <EmptySectionPlaceholder section={section} />
    </Frame>
  );
}


