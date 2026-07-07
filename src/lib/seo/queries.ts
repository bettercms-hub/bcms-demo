/**
 * SEO/Analytics persistence layer.
 *
 * Phase 1 has no auth — RLS on these tables is open. When auth lands,
 * scope reads/writes to `auth.uid()` via project membership.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type SeoPageRow = Tables["seo_page"]["Row"];
export type SeoProjectSettingsRow = Tables["seo_project_settings"]["Row"];
export type SeoRedirectRow = Tables["seo_redirect"]["Row"];
export type SeoKeywordRow = Tables["seo_keyword"]["Row"];
export type SeoIntegrationRow = Tables["seo_integration"]["Row"];
export type SeoPageVersionRow = Tables["seo_page_version"]["Row"];

type Scope = { workspace: string; project: string };

const k = {
  page: (s: Scope, pageId: string) => ["seo-page", s.workspace, s.project, pageId] as const,
  pageVersions: (s: Scope, pageId: string) =>
    ["seo-page-versions", s.workspace, s.project, pageId] as const,
  settings: (s: Scope) => ["seo-settings", s.workspace, s.project] as const,
  redirects: (s: Scope) => ["seo-redirects", s.workspace, s.project] as const,
  keywords: (s: Scope) => ["seo-keywords", s.workspace, s.project] as const,
  integrations: (s: Scope) => ["seo-integrations", s.workspace, s.project] as const,
};

// ---------------- Page ----------------

export function useSeoPage(scope: Scope, pageId: string) {
  return useQuery({
    queryKey: k.page(scope, pageId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seo_page")
        .select("*")
        .eq("workspace_slug", scope.workspace)
        .eq("project_slug", scope.project)
        .eq("page_id", pageId)
        .maybeSingle();
      if (error) throw error;
      return data as SeoPageRow | null;
    },
    staleTime: 10_000,
  });
}

export function useSaveSeoPage(scope: Scope, pageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<Omit<SeoPageRow, "id" | "created_at" | "updated_at">> & { label?: string },
    ) => {
      const { label, ...patch } = input;
      const { data, error } = await supabase
        .from("seo_page")
        .upsert(
          {
            workspace_slug: scope.workspace,
            project_slug: scope.project,
            page_id: pageId,
            ...patch,
          },
          { onConflict: "workspace_slug,project_slug,page_id" },
        )
        .select("*")
        .single();
      if (error) throw error;

      // Append a version snapshot. version_num = (max + 1) — we read
      // the current max client-side; collisions are rare with a single
      // editor and the unique constraint will surface any conflict.
      const { data: last } = await supabase
        .from("seo_page_version")
        .select("version_num")
        .eq("workspace_slug", scope.workspace)
        .eq("project_slug", scope.project)
        .eq("page_id", pageId)
        .order("version_num", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextNum = (last?.version_num ?? 0) + 1;
      const { snapshot } = buildSnapshot(data as SeoPageRow);
      await supabase.from("seo_page_version").insert({
        workspace_slug: scope.workspace,
        project_slug: scope.project,
        page_id: pageId,
        version_num: nextNum,
        label: label ?? null,
        snapshot,
      });
      return data as SeoPageRow;
    },
    onSuccess: (row) => {
      qc.setQueryData(k.page(scope, pageId), row);
      qc.invalidateQueries({ queryKey: k.pageVersions(scope, pageId) });
    },
  });
}

// Fields included in a version snapshot. Excludes ids / timestamps so
// restoring is a clean patch.
const SNAPSHOT_FIELDS = [
  "meta_title",
  "meta_description",
  "slug",
  "canonical",
  "og_title",
  "og_description",
  "og_image",
  "twitter_image",
  "structured_data",
  "indexing",
  "ai_summary",
  "key_takeaways",
  "faqs",
  "entities",
  "topics",
  "seo_score",
  "aeo_score",
  "aeo_breakdown",
] as const;

export type SeoPageSnapshot = Pick<SeoPageRow, (typeof SNAPSHOT_FIELDS)[number]>;

function buildSnapshot(row: SeoPageRow): { snapshot: SeoPageSnapshot } {
  const snapshot = {} as SeoPageSnapshot;
  for (const f of SNAPSHOT_FIELDS) {
    (snapshot as Record<string, unknown>)[f] = (row as Record<string, unknown>)[f];
  }
  return { snapshot };
}

export function useSeoPageVersions(scope: Scope, pageId: string, enabled = true) {
  return useQuery({
    queryKey: k.pageVersions(scope, pageId),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seo_page_version")
        .select("*")
        .eq("workspace_slug", scope.workspace)
        .eq("project_slug", scope.project)
        .eq("page_id", pageId)
        .order("version_num", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SeoPageVersionRow[];
    },
  });
}

export function useRestoreSeoPageVersion(scope: Scope, pageId: string) {
  const save = useSaveSeoPage(scope, pageId);
  return useMutation({
    mutationFn: async (version: SeoPageVersionRow) => {
      const snap = version.snapshot as Partial<SeoPageRow>;
      return save.mutateAsync({
        ...snap,
        label: `Restored v${version.version_num}`,
      });
    },
  });
}

// ---------------- Project settings (defaults / analytics / robots / schema) ----------------

export function useSeoSettings(scope: Scope) {
  return useQuery({
    queryKey: k.settings(scope),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seo_project_settings")
        .select("*")
        .eq("workspace_slug", scope.workspace)
        .eq("project_slug", scope.project)
        .maybeSingle();
      if (error) throw error;
      return data as SeoProjectSettingsRow | null;
    },
    staleTime: 10_000,
  });
}

export function useSaveSeoSettings(scope: Scope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      patch: Partial<Omit<SeoProjectSettingsRow, "workspace_slug" | "project_slug" | "created_at" | "updated_at">>,
    ) => {
      const { data, error } = await supabase
        .from("seo_project_settings")
        .upsert(
          { workspace_slug: scope.workspace, project_slug: scope.project, ...patch },
          { onConflict: "workspace_slug,project_slug" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return data as SeoProjectSettingsRow;
    },
    onSuccess: (row) => qc.setQueryData(k.settings(scope), row),
  });
}

// ---------------- Redirects ----------------

export function useRedirects(scope: Scope) {
  return useQuery({
    queryKey: k.redirects(scope),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seo_redirect")
        .select("*")
        .eq("workspace_slug", scope.workspace)
        .eq("project_slug", scope.project)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SeoRedirectRow[];
    },
  });
}

export function useAddRedirect(scope: Scope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { from_path: string; to_path: string; code: number }) => {
      const { data, error } = await supabase
        .from("seo_redirect")
        .insert({ workspace_slug: scope.workspace, project_slug: scope.project, ...input })
        .select("*")
        .single();
      if (error) throw error;
      return data as SeoRedirectRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k.redirects(scope) }),
  });
}

export function useDeleteRedirect(scope: Scope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("seo_redirect").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k.redirects(scope) }),
  });
}

// ---------------- Keywords ----------------

export function useKeywords(scope: Scope) {
  return useQuery({
    queryKey: k.keywords(scope),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seo_keyword")
        .select("*")
        .eq("workspace_slug", scope.workspace)
        .eq("project_slug", scope.project)
        .order("rank", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as SeoKeywordRow[];
    },
  });
}

export function useAddKeyword(scope: Scope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<SeoKeywordRow> & { term: string }) => {
      const { data, error } = await supabase
        .from("seo_keyword")
        .upsert(
          { workspace_slug: scope.workspace, project_slug: scope.project, ...input },
          { onConflict: "workspace_slug,project_slug,term" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return data as SeoKeywordRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k.keywords(scope) }),
  });
}

export function useDeleteKeyword(scope: Scope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("seo_keyword").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k.keywords(scope) }),
  });
}

// ---------------- Integrations ----------------

export function useIntegrations(scope: Scope) {
  return useQuery({
    queryKey: k.integrations(scope),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seo_integration")
        .select("*")
        .eq("workspace_slug", scope.workspace)
        .eq("project_slug", scope.project);
      if (error) throw error;
      return (data ?? []) as SeoIntegrationRow[];
    },
  });
}

export function useToggleIntegration(scope: Scope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { provider_id: string; status: "connected" | "disconnected" }) => {
      const { data, error } = await supabase
        .from("seo_integration")
        .upsert(
          {
            workspace_slug: scope.workspace,
            project_slug: scope.project,
            provider_id: input.provider_id,
            status: input.status,
            connected_at: input.status === "connected" ? new Date().toISOString() : null,
          },
          { onConflict: "workspace_slug,project_slug,provider_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return data as SeoIntegrationRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k.integrations(scope) }),
  });
}
