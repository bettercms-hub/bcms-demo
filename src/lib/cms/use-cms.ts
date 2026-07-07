/** Re-exports the store selectors for backward compat. New code should use `useCMS` from ./store. */
import { select } from "./store";

export const getWorkspaceBySlug = select.workspaceBySlug;
export const getProjectBySlug = select.projectBySlug;
export const getWebsiteForProject = select.websiteForProject;
export const getPage = select.page;
export const getSection = select.section;
export const getComponent = select.component;
export const getCollection = select.collection;
export const getEntry = select.entry;
export const getSchema = select.schema;
export const getMedia = select.media;
export const getMember = select.member;
export const getSectionsForPage = select.sectionsForPage;
export const getEntriesForCollection = select.entriesForCollection;

// Static seed re-exports kept for routes that just enumerate everything.
export { workspaces, projects, members, components, collections, entries, media, pages, sections, schemas, websites } from "./mock-data";
export const cms = {
  get workspaces() { return select; },
};
