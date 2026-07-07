import type { WebhookEvent } from "./types";

export interface EventDescriptor {
  key: WebhookEvent;
  label: string;
  description: string;
  group: "Pages" | "Content" | "Media" | "Members" | "Deployments";
}

export const EVENT_CATALOG: EventDescriptor[] = [
  { key: "page.published", label: "Page published", description: "Fires when any page transitions to published.", group: "Pages" },
  { key: "page.unpublished", label: "Page unpublished", description: "Fires when a published page is archived or unpublished.", group: "Pages" },
  { key: "collection.entry.created", label: "Entry created", description: "Fires for new entries in any collection.", group: "Content" },
  { key: "collection.entry.updated", label: "Entry updated", description: "Fires when an existing entry is edited.", group: "Content" },
  { key: "collection.entry.deleted", label: "Entry deleted", description: "Fires when an entry is removed.", group: "Content" },
  { key: "media.uploaded", label: "Media uploaded", description: "Fires when a new asset is uploaded.", group: "Media" },
  { key: "member.invited", label: "Member invited", description: "Fires when a workspace invitation is sent.", group: "Members" },
  { key: "member.removed", label: "Member removed", description: "Fires when a workspace member is removed.", group: "Members" },
  { key: "site.deployed", label: "Site deployed", description: "Fires after a successful deployment.", group: "Deployments" },
];
