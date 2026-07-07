import type { SitePermissionMatrix, PermissionResource, SiteRole } from "./types";

export const PERMISSION_RESOURCES: PermissionResource[] = [
  "pages", "components", "collections", "media",
  "seo", "publishing", "analytics", "settings",
];

export const SITE_ROLES: SiteRole[] = [
  "site_manager", "designer", "content_editor", "marketer", "reviewer", "viewer",
];

const full = { view: true, edit: true, publish: true };
const editNoPublish = { view: true, edit: true, publish: false };
const viewOnly = { view: true, edit: false, publish: false };
const none = { view: false, edit: false, publish: false };

export const SITE_PERMISSION_MATRIX: SitePermissionMatrix = {
  site_manager: {
    pages: full, components: full, collections: full, media: full,
    seo: full, publishing: full, analytics: full, settings: full,
  },
  designer: {
    pages: editNoPublish, components: editNoPublish, collections: editNoPublish,
    media: editNoPublish, seo: viewOnly, publishing: viewOnly,
    analytics: viewOnly, settings: viewOnly,
  },
  content_editor: {
    pages: editNoPublish, components: viewOnly, collections: editNoPublish,
    media: editNoPublish, seo: editNoPublish, publishing: viewOnly,
    analytics: viewOnly, settings: none,
  },
  marketer: {
    pages: viewOnly, components: viewOnly, collections: viewOnly, media: viewOnly,
    seo: full, publishing: full, analytics: full, settings: viewOnly,
  },
  reviewer: {
    pages: viewOnly, components: viewOnly, collections: viewOnly, media: viewOnly,
    seo: viewOnly, publishing: viewOnly, analytics: viewOnly, settings: none,
  },
  viewer: {
    pages: viewOnly, components: viewOnly, collections: viewOnly, media: viewOnly,
    seo: viewOnly, publishing: viewOnly, analytics: viewOnly, settings: none,
  },
};

export const SITE_ROLE_LABELS: Record<SiteRole, string> = {
  site_manager: "Site Manager",
  designer: "Designer",
  content_editor: "Content Editor",
  marketer: "Marketer",
  reviewer: "Reviewer",
  viewer: "Viewer",
};

export const WORKSPACE_ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  content_manager: "Content Manager",
  developer: "Developer",
  viewer: "Viewer",
} as const;
