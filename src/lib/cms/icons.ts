/**
 * Unified icon source for CMS surfaces.
 *
 * Phase 4C: every section, block, node-kind and inspector header pulls its
 * icon from this module so we keep one stroke + optical size across the app.
 * Pair with the `<Icon />` wrapper for consistent rendering.
 */
import {
  Building2,
  Component as ComponentIcon,
  Compass,
  CreditCard,
  Database,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  Megaphone,
  MessageSquare,
  Newspaper,
  PanelBottom,
  PanelTop,
  Plug,
  Sparkles,
  TrendingUp,
  Workflow as WorkflowIcon,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { Folder, Settings2 } from "lucide-react";
import type { SectionKind, TreeNodeKind } from "@/lib/cms/types";

/** Default stroke width across every CMS icon. */
export const ICON_STROKE = 1.75;

/** Standard optical sizes. */
export const ICON_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
} as const;

export const SECTION_ICON: Record<SectionKind, LucideIcon> = {
  hero: Sparkles,
  features: LayoutGrid,
  pricing: CreditCard,
  testimonials: MessageSquare,
  logos: Building2,
  cta: Megaphone,
  faq: HelpCircle,
  content: FileText,
  header: PanelTop,
  footer: PanelBottom,
  navigation: Compass,
  workflow: WorkflowIcon,
  integrations: Plug,
  stats: TrendingUp,
  blog: Newspaper,
  docs: BookOpen,
  contact: Mail,
};

export const NODE_KIND_ICON: Record<TreeNodeKind, LucideIcon> = {
  group: Folder,
  page: FileText,
  section: LayoutTemplate,
  block: LayoutGrid,
  collection: Database,
  entry: FileText,
  component: ComponentIcon,
  media: ImageIcon,
  settings: Settings2,
};
